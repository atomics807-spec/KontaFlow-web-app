import { getAiCommands, saveAiCommand, newClientId, type OfflineAiCommand, type OfflineIdentity } from "./db";
import { nextRetryDelay } from "./policy";
import type { AiCommandView } from "@/lib/ai/types";

type ChatResponse = {
  reply?: string;
  conversationId?: string;
  message?: string;
  error?: string;
  command?: AiCommandView | null;
};

const inFlight = new Map<string, Promise<void>>();

function key(identity: OfflineIdentity): string {
  return `${identity.userId}:${identity.workspaceId}`;
}

export async function enqueueAiCommand(
  identity: OfflineIdentity,
  input: { message: string; locale: string; conversationId: string | null; id?: string },
): Promise<OfflineAiCommand> {
  const now = Date.now();
  const command: OfflineAiCommand = {
    id: input.id ?? newClientId(),
    userId: identity.userId,
    workspaceId: identity.workspaceId,
    message: input.message.trim(),
    locale: input.locale,
    conversationId: input.conversationId,
    status: "queued",
    reply: null,
    command: null,
    attempts: 0,
    nextAttemptAt: 0,
    lastErrorCode: null,
    lastErrorMessage: null,
    createdAt: now,
    updatedAt: now,
  };
  await saveAiCommand(command);
  return command;
}

export async function retryAiCommand(command: OfflineAiCommand): Promise<void> {
  await saveAiCommand({
    ...command,
    status: "queued",
    nextAttemptAt: 0,
    lastErrorCode: null,
    lastErrorMessage: null,
    updatedAt: Date.now(),
  });
}

async function runQueue(identity: OfflineIdentity): Promise<void> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return;
  const now = Date.now();
  const all = await getAiCommands(identity.userId, identity.workspaceId, 50);
  const commands: OfflineAiCommand[] = [];
  for (const command of all) {
    // A closed tab must not strand a request in "processing" forever.
    if (command.status === "processing" && command.updatedAt < now - 2 * 60_000) {
      const queued = { ...command, status: "queued" as const, nextAttemptAt: 0, updatedAt: now };
      await saveAiCommand(queued);
      commands.push(queued);
    } else if (command.status === "queued" && command.nextAttemptAt <= now) {
      commands.push(command);
    }
  }

  for (const command of commands) {
    const processing: OfflineAiCommand = {
      ...command,
      status: "processing",
      updatedAt: Date.now(),
    };
    await saveAiCommand(processing);

    let response: Response;
    try {
      response = await fetch("/api/ai/chat", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          message: command.message,
          conversationId: command.conversationId,
          requestId: command.id,
          locale: command.locale,
          requireConfirmation: true,
        }),
      });
    } catch {
      await saveAiCommand({
        ...processing,
        status: "queued",
        attempts: command.attempts + 1,
        nextAttemptAt: Date.now() + nextRetryDelay(command.attempts + 1),
        lastErrorCode: "network_error",
        lastErrorMessage: "The connection dropped before the assistant replied.",
        updatedAt: Date.now(),
      });
      continue;
    }

    const body = (await response.json().catch(() => null)) as ChatResponse | null;
    if (response.ok && body?.reply) {
      await saveAiCommand({
        ...processing,
        status: "ready",
        reply: body.reply,
        command: body.command ?? null,
        conversationId: body.conversationId ?? command.conversationId,
        attempts: command.attempts + 1,
        nextAttemptAt: 0,
        lastErrorCode: null,
        lastErrorMessage: null,
        updatedAt: Date.now(),
      });
      continue;
    }

    if (response.status === 401 || response.status === 403 || response.status === 422) {
      await saveAiCommand({
        ...processing,
        status: "attention",
        attempts: command.attempts + 1,
        nextAttemptAt: 0,
        lastErrorCode: body?.error ?? "request_rejected",
        lastErrorMessage: body?.message ?? "The assistant could not process this request.",
        updatedAt: Date.now(),
      });
      continue;
    }

    await saveAiCommand({
      ...processing,
      status: "queued",
      attempts: command.attempts + 1,
      nextAttemptAt: Date.now() + nextRetryDelay(command.attempts + 1),
      lastErrorCode: body?.error ?? "server_error",
      lastErrorMessage: body?.message ?? "The assistant is temporarily unavailable.",
      updatedAt: Date.now(),
    });
  }
}

/** Processes queued natural-language commands; it never confirms transactions. */
export function processAiQueue(identity: OfflineIdentity): Promise<void> {
  const queueKey = key(identity);
  const existing = inFlight.get(queueKey);
  if (existing) return existing;
  const promise = runQueue(identity).finally(() => inFlight.delete(queueKey));
  inFlight.set(queueKey, promise);
  return promise;
}
