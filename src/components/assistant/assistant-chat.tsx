"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CloudOff, RefreshCw, Send, Settings2, Sparkles } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/components/layout/i18n-provider";
import { CommandPreview } from "@/components/assistant/command-preview";
import { useOfflineIdentity } from "@/components/offline/offline-identity-provider";
import { useOfflineAiCommands } from "@/components/offline/use-offline-outbox";
import { enqueueAiCommand, processAiQueue, retryAiCommand } from "@/lib/offline/ai";
import { deleteAiCommand, type OfflineAiCommand } from "@/lib/offline/db";
import { cn } from "@/lib/utils";
import { formatMoney, moneyLocale } from "@/lib/money";
import { interpolate } from "@/lib/i18n/interpolate";
import type { AiCommandView } from "@/lib/ai/types";

export type ChatMessage = { id: string; role: "user" | "assistant"; content: string; command?: AiCommandView | null };

type Retry = { text: string; requestId: string } | null;
type BusyAction = "confirm" | "dismiss" | "undo" | null;

let localMessageSeq = 0;
function nextLocalMessageId(): string {
  localMessageSeq += 1;
  return `local-${localMessageSeq}`;
}

export function AssistantChat({
  conversationId,
  initialMessages,
  initialCommand,
  configured,
  autoPostEnabled,
  autoPostMaxMinor,
  currency,
  canManageAiSettings,
}: {
  conversationId: string | null;
  initialMessages: ChatMessage[];
  initialCommand: AiCommandView | null;
  configured: boolean;
  autoPostEnabled: boolean;
  autoPostMaxMinor: bigint;
  currency: string;
  canManageAiSettings: boolean;
}) {
  const { locale, dict } = useI18n();
  const router = useRouter();
  const identity = useOfflineIdentity();
  const offlineCommands = useOfflineAiCommands(identity);
  const [retryingAi, setRetryingAi] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [conversation, setConversation] = useState<string | null>(conversationId);
  const [restoredCommand, setRestoredCommand] = useState<AiCommandView | null>(initialCommand);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState<Retry>(null);
  const [busyCommand, setBusyCommand] = useState<{ id: string; action: BusyAction } | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, pending, restoredCommand]);

  async function send(text: string) {
    const message = text.trim();
    if (!message || pending) return;

    const requestId = retry && retry.text === message ? retry.requestId : globalThis.crypto.randomUUID();
    setRetry(null);
    setError(null);
    setInput("");
    setPending(true);

    const optimistic: ChatMessage = { id: nextLocalMessageId(), role: "user", content: message };
    setMessages((current) => [...current, optimistic]);

    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      if (identity) {
        await enqueueAiCommand(identity, {
          id: requestId,
          message,
          locale,
          conversationId: conversation,
        }).catch(() => undefined);
      }
      setError(dict.assistant.offlineQueued);
      setMessages((current) => [
        ...current,
        { id: `offline-${requestId}`, role: "assistant", content: dict.assistant.offlineQueuedHint },
      ]);
      setPending(false);
      setInput("");
      return;
    }

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message, conversationId: conversation, requestId, locale }),
      });

      const body = (await response.json().catch(() => null)) as
        | { reply?: string; conversationId?: string; message?: string; command?: AiCommandView | null }
        | null;

      if (!response.ok || !body?.reply) {
        setError(
          response.status === 503
            ? dict.assistant.notConfigured
            : response.status === 429
              ? dict.assistant.quotaReached
              : (body?.message ?? dict.errors.generic),
        );
        setInput(message);
        setMessages((current) => current.filter((item) => item.id !== optimistic.id));
        if (response.status >= 500 || response.status === 429) setRetry({ text: message, requestId });
        return;
      }

      setConversation(body.conversationId ?? conversation);
      setRestoredCommand(null);
      setMessages((current) => [
        ...current,
        {
          id: globalThis.crypto.randomUUID(),
          role: "assistant",
          content: body.reply as string,
          command: body.command ?? null,
        },
      ]);
    } catch {
      if (identity) {
        await enqueueAiCommand(identity, {
          id: requestId,
          message,
          locale,
          conversationId: conversation,
        }).catch(() => undefined);
        setError(dict.assistant.offlineQueued);
        setMessages((current) => [
          ...current,
          { id: `offline-${requestId}`, role: "assistant", content: dict.assistant.offlineQueuedHint },
        ]);
        setInput("");
      } else {
        setError(dict.errors.network);
        setInput(message);
        setMessages((current) => current.filter((item) => item.id !== optimistic.id));
        setRetry({ text: message, requestId });
      }
    } finally {
      setPending(false);
    }
  }

  async function runCommand(
    command: AiCommandView,
    action: "confirm" | "dismiss" | "undo",
    offlineId?: string,
  ) {
    if (busyCommand) return;
    setBusyCommand({ id: command.id, action });
    setError(null);

    try {
      const response = await fetch(`/api/ai/commands/${command.id}/${action}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: action === "undo" ? JSON.stringify({ reason: "Undo from assistant" }) : "{}",
      });
      const body = (await response.json().catch(() => null)) as
        | { command?: AiCommandView; message?: string }
        | null;

      if (!response.ok || !body?.command) {
        setError(
          action === "confirm"
            ? dict.assistant.confirmError
            : action === "dismiss"
              ? dict.assistant.dismissError
              : dict.assistant.undoError,
        );
        return;
      }

      const next = body.command;
      if (offlineId) await deleteAiCommand(offlineId).catch(() => undefined);
      setMessages((current) =>
        current.map((message) =>
          message.command?.id === next.id ? { ...message, command: next.status === "dismissed" ? null : next } : message,
        ),
      );
      setRestoredCommand((current) =>
        current?.id === next.id ? (next.status === "dismissed" ? null : next) : current,
      );
      router.refresh();
    } catch {
      setError(
        action === "confirm"
          ? dict.assistant.confirmError
          : action === "dismiss"
            ? dict.assistant.dismissError
            : dict.assistant.undoError,
      );
    } finally {
      setBusyCommand(null);
    }
  }

  useEffect(() => {
    if (!identity) return;
    const run = () => {
      if (typeof navigator !== "undefined" && navigator.onLine) void processAiQueue(identity);
    };
    run();
    window.addEventListener("online", run);
    const interval = window.setInterval(run, 30_000);
    return () => {
      window.removeEventListener("online", run);
      window.clearInterval(interval);
    };
  }, [identity]);

  const retryOfflineCommand = async (command: OfflineAiCommand) => {
    if (!identity || retryingAi) return;
    setRetryingAi(command.id);
    try {
      await retryAiCommand(command);
      await processAiQueue(identity);
    } finally {
      setRetryingAi(null);
    }
  };

  const suggestions = [
    dict.assistant.suggestion1,
    dict.assistant.suggestion2,
    dict.assistant.suggestion3,
    dict.assistant.suggestion4,
  ];

  if (!configured) {
    return <Alert tone="warning">{dict.assistant.notConfigured}</Alert>;
  }

  const autoPostText = autoPostEnabled
    ? interpolate(dict.assistant.autoPostOn, {
        amount: formatMoney(autoPostMaxMinor, currency, moneyLocale(locale, currency)),
      })
    : dict.assistant.autoPostOff;

  return (
    <div className="flex h-[calc(100dvh-13rem)] min-h-[28rem] flex-col">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-page/70 px-3 py-2">
        <p className="flex items-start gap-2 text-xs text-muted">
          <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent-strong" aria-hidden />
          {autoPostText}
        </p>
        {canManageAiSettings ? (
          <Link
            href={`/${locale}/settings`}
            className="inline-flex items-center gap-1 text-xs font-semibold text-accent-strong hover:underline"
          >
            <Settings2 className="h-3.5 w-3.5" aria-hidden />
            {dict.assistant.autoPostSettings}
          </Link>
        ) : null}
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto pb-4" aria-live="polite" aria-relevant="additions">
        {messages.length === 0 && !restoredCommand ? (
          <div className="rounded-2xl border border-line bg-panel p-5">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-forest text-mango-400">
              <Sparkles className="h-5 w-5" aria-hidden />
            </span>
            <p className="mt-3 text-sm font-bold text-heading">{dict.assistant.empty}</p>
            <p className="mt-1 text-sm text-muted">{dict.assistant.emptyHint}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => void send(suggestion)}
                  className="rounded-full border border-line bg-page px-3 py-1.5 text-left text-xs font-medium text-heading transition hover:border-accent-line hover:bg-accent-soft"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <div key={message.id} className="space-y-1">
              <div className={cn("flex", message.role === "user" ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[85%] whitespace-pre-line rounded-2xl px-4 py-3 text-sm leading-relaxed",
                    message.role === "user" ? "bg-forest text-white" : "border border-line bg-panel text-heading",
                  )}
                >
                  {message.content}
                </div>
              </div>
              {message.command ? (
                <div className="max-w-3xl">
                  <CommandPreview
                    command={message.command}
                    busy={busyCommand?.id === message.command.id ? busyCommand.action : null}
                    onConfirm={() => void runCommand(message.command as AiCommandView, "confirm")}
                    onDismiss={() => void runCommand(message.command as AiCommandView, "dismiss")}
                    onUndo={() => void runCommand(message.command as AiCommandView, "undo")}
                  />
                </div>
              ) : null}
            </div>
          ))
        )}

        {restoredCommand ? (
          <CommandPreview
            command={restoredCommand}
            busy={busyCommand?.id === restoredCommand.id ? busyCommand.action : null}
            onConfirm={() => void runCommand(restoredCommand, "confirm")}
            onDismiss={() => void runCommand(restoredCommand, "dismiss")}
            onUndo={() => void runCommand(restoredCommand, "undo")}
          />
        ) : null}

        {offlineCommands.length > 0 ? (
          <div className="space-y-2">
            {offlineCommands
              .slice()
              .reverse()
              .map((entry) => (
                <div key={entry.id} className="rounded-2xl border border-warn-soft bg-warn-soft/25 p-3">
                  <div className="flex items-start gap-2">
                    <CloudOff className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warn" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-heading">{entry.message}</p>
                      <p className="mt-1 flex items-center gap-1.5 text-[0.7rem] font-semibold text-warn">
                        {entry.status === "processing" || retryingAi === entry.id ? (
                          <RefreshCw className="h-3 w-3 animate-spin" aria-hidden />
                        ) : null}
                        {entry.status === "queued"
                          ? dict.assistant.offlineWaiting
                          : entry.status === "processing"
                            ? dict.assistant.offlineProcessing
                            : entry.status === "ready"
                              ? dict.assistant.offlineReady
                              : dict.assistant.offlineAttention}
                      </p>
                      {entry.status === "attention" ? (
                        <div className="mt-2">
                          <p className="text-xs text-danger">{entry.lastErrorMessage}</p>
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            className="mt-2"
                            onClick={() => void retryOfflineCommand(entry)}
                            disabled={retryingAi !== null}
                          >
                            <RefreshCw className={`h-3.5 w-3.5 ${retryingAi === entry.id ? "animate-spin" : ""}`} aria-hidden />
                            {dict.assistant.offlineRetry}
                          </Button>
                        </div>
                      ) : null}
                      {entry.status === "ready" && entry.reply ? (
                        <div className="mt-2 rounded-xl border border-line bg-panel p-3 text-sm leading-relaxed text-heading">
                          <p className="whitespace-pre-line">{entry.reply}</p>
                          <p className="mt-2 text-[0.7rem] font-semibold text-warn">
                            {dict.assistant.offlineRequiresConfirmation}
                          </p>
                          {entry.command ? (
                            <CommandPreview
                              command={entry.command}
                              busy={busyCommand?.id === entry.command.id ? busyCommand.action : null}
                              onConfirm={() => void runCommand(entry.command as AiCommandView, "confirm", entry.id)}
                              onDismiss={() => void runCommand(entry.command as AiCommandView, "dismiss", entry.id)}
                              onUndo={() => void runCommand(entry.command as AiCommandView, "undo", entry.id)}
                            />
                          ) : (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="mt-2"
                              onClick={() => void deleteAiCommand(entry.id)}
                            >
                              {dict.assistant.offlineDismiss}
                            </Button>
                          )}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
          </div>
        ) : null}

        {pending ? (
          <div className="flex items-center gap-2 text-xs text-muted">
            <span className="flex gap-1" aria-hidden>
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-jade-500 [animation-delay:0ms]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-jade-500 [animation-delay:120ms]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-jade-500 [animation-delay:240ms]" />
            </span>
            {dict.assistant.thinking}
          </div>
        ) : null}

        <div ref={bottomRef} />
      </div>

      {error ? (
        <Alert tone="error" className="mb-3">
          {error}
        </Alert>
      ) : null}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void send(input);
        }}
        className="flex items-end gap-2 border-t border-line pt-3"
      >
        <label htmlFor="assistant-input" className="sr-only">
          {dict.assistant.placeholder}
        </label>
        <Input
          id="assistant-input"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder={dict.assistant.placeholder}
          maxLength={2000}
          autoComplete="off"
          className="h-12 flex-1"
          disabled={pending}
        />
        <Button type="submit" size="icon" className="h-12 w-12 shrink-0" disabled={pending || !input.trim()}>
          <Send className="h-4 w-4" aria-hidden />
          <span className="sr-only">{dict.assistant.send}</span>
        </Button>
      </form>

      <p className="mt-2 text-[0.7rem] leading-relaxed text-muted">{dict.assistant.disclaimer}</p>
    </div>
  );
}
