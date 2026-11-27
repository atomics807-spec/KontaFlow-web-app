import "server-only";

import type OpenAI from "openai";
import { getAiClient, getAiModel } from "./client";
import {
  INTERACTIVE_TOOL_DEFINITIONS,
  TOOL_DEFINITIONS,
  executeInteractiveTool,
  executeTool,
  type InteractiveToolContext,
  type ToolContext,
} from "./tools";
import { buildInteractivePrompt, buildSystemPrompt } from "./prompt";
import { loadAiReference } from "./reference";
import type { AiCommandView, Clarification } from "./types";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getWorkspaceEntitlements, getWorkspaceEntitlementsAsService } from "@/lib/entitlements/service";
import { createAiCommand, confirmAiCommand, setAiCommandReply } from "@/services/ai-commands";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { todayInZone } from "@/lib/dates";
import { getDictionary } from "@/lib/i18n/server";
import { getServerEnv } from "@/lib/env";
import { interpolate } from "@/lib/i18n/interpolate";
import type { Dictionary } from "@/lib/i18n/dictionaries/en";
import type { Locale } from "@/lib/i18n/config";
import type { WorkspaceRow } from "@/types/database";

export type AssistantMode = "interactive" | "direct";

export type AssistantReply = {
  conversationId: string;
  reply: string;
  toolsUsed: string[];
  command: AiCommandView | null;
  clarification: boolean;
};

type HistoryRow = { role: string; content: string };

function clarificationMessage(dict: Dictionary, clarification: Clarification): string {
  const subject = clarification.subject.trim() || dict.assistant.thisEntry;
  switch (clarification.code) {
    case "amount":
      return interpolate(dict.assistant.clarifyAmount, { subject });
    case "description":
      return interpolate(dict.assistant.clarifyDescription, { subject });
    case "category":
      return interpolate(dict.assistant.clarifyCategory, { subject });
    case "date":
      return interpolate(dict.assistant.clarifyDate, { subject });
    case "account":
      return interpolate(dict.assistant.clarifyAccount, { subject });
    case "contact":
      return interpolate(dict.assistant.clarifyContact, { subject });
    case "debt":
      return interpolate(dict.assistant.clarifyDebt, { subject });
    case "debt_amount":
      return interpolate(dict.assistant.clarifyDebtAmount, { subject });
    default:
      return dict.assistant.clarifyGeneric;
  }
}

export async function runAssistant(params: {
  workspace: WorkspaceRow;
  userId: string;
  locale: Locale;
  message: string;
  requestId: string;
  conversationId?: string | null;
  mode?: AssistantMode;
  /** Offline queues set this to false so the person must confirm the preview. */
  autoPost?: boolean;
  /** Webhook channels have no user session; they run on the service role. */
  serviceRole?: boolean;
}): Promise<AssistantReply> {
  const mode = params.mode ?? "interactive";
  const startedAt = Date.now();
  const dict = await getDictionary(params.locale);
  const openai = getAiClient();
  if (!openai) {
    throw new AppError("integration_unavailable", dict.assistant.notConfigured);
  }

  const supabase = params.serviceRole ? createAdminClient() : await createClient();
  const { workspace, userId, locale } = params;
  const entitlements = params.serviceRole
    ? await getWorkspaceEntitlementsAsService(workspace.id)
    : await getWorkspaceEntitlements(workspace.id, userId);
  if (!entitlements.features.ai_bookkeeping.included) {
    throw new AppError("plan_required", dict.assistant.quotaReached);
  }
  if (!entitlements.writable) {
    throw new AppError("plan_required", dict.assistant.quotaReached);
  }
  const limit = entitlements.limits.aiMessagesPerMonth ?? 0;

  const { data: allowed, error: quotaError } = params.serviceRole
    ? await supabase.rpc("consume_channel_quota", {
        p_workspace_id: workspace.id,
        p_actor_id: userId,
        p_kind: "ai_message",
        p_limit: limit,
      })
    : await supabase.rpc("consume_quota", {
        p_workspace_id: workspace.id,
        p_kind: "ai_message",
        p_limit: limit,
      });
  if (quotaError) {
    logger.error("ai.quota_failed", { code: quotaError.code });
    throw new AppError("internal_error", dict.assistant.quotaCheckFailed);
  }
  if (allowed === false) {
    throw new AppError("rate_limited", dict.assistant.quotaReached);
  }

  const conversationId = await ensureConversation(
    supabase,
    workspace.id,
    userId,
    params.conversationId,
    params.message,
    dict.assistant.startFailed,
  );

  const { data: userMessage, error: insertError } = await supabase
    .from("ai_messages")
    .insert({
      conversation_id: conversationId,
      workspace_id: workspace.id,
      role: "user",
      content: params.message.slice(0, 4000),
    })
    .select("id")
    .single();
  if (insertError || !userMessage) throw new AppError("internal_error", dict.assistant.saveFailed);

  const { data: historyRows } = await supabase
    .from("ai_messages")
    .select("role, content")
    .eq("conversation_id", conversationId)
    .in("role", ["user", "assistant"])
    .order("created_at", { ascending: false })
    .limit(12);

  const history = ((historyRows ?? []) as HistoryRow[]).reverse();
  const reference = mode === "interactive" ? await loadAiReference(workspace) : null;

  const systemPrompt =
    mode === "interactive" && reference
      ? buildInteractivePrompt({ reference, locale })
      : buildSystemPrompt({
          workspace,
          locale,
          today: todayInZone(workspace.timezone),
          plan: workspace.plan,
        });

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    ...history.map((row) => ({
      role: row.role === "assistant" ? ("assistant" as const) : ("user" as const),
      content: row.content,
    })),
  ];

  const baseContext: ToolContext = {
    workspace,
    userId,
    conversationId,
    requestId: params.requestId,
    serviceRole: Boolean(params.serviceRole),
  };
  const interactiveContext: InteractiveToolContext | null =
    reference
      ? {
          ...baseContext,
          requestId: params.requestId,
          locale,
          reference,
          draft: null,
          clarification: null,
        }
      : null;

  const tools = mode === "interactive" ? INTERACTIVE_TOOL_DEFINITIONS : TOOL_DEFINITIONS;
  const toolsUsed: string[] = [];
  let reply = "";
  let model = getAiModel();
  let promptTokens: number | null = null;
  let completionTokens: number | null = null;

  try {
    for (let step = 0; step < 4; step += 1) {
      const completion = await openai.chat.completions.create({
        model,
        messages,
        tools,
        tool_choice: "auto",
        temperature: mode === "interactive" ? 0.1 : 0.2,
        max_completion_tokens:
          mode === "interactive"
            ? Math.min(getServerEnv().AI_MAX_OUTPUT_TOKENS, 1200)
            : Math.min(getServerEnv().AI_MAX_OUTPUT_TOKENS, 700),
      });

      const choice = completion.choices[0]?.message;
      if (!choice) break;

      model = completion.model ?? model;
      promptTokens = completion.usage?.prompt_tokens ?? promptTokens;
      completionTokens = completion.usage?.completion_tokens ?? completionTokens;

      if (choice.tool_calls?.length) {
        messages.push({
          role: "assistant",
          content: choice.content ?? "",
          tool_calls: choice.tool_calls,
        });

        for (const [callIndex, call] of choice.tool_calls.entries()) {
          if (call.type !== "function") continue;
          let args: Record<string, unknown> = {};
          try {
            args = JSON.parse(call.function.arguments || "{}") as Record<string, unknown>;
          } catch {
            args = {};
          }

          const toolCallKey = `${step}:${callIndex}`;
          const result =
            mode === "interactive" && interactiveContext
              ? await executeInteractiveTool(call.function.name, args, interactiveContext)
              : await executeTool(call.function.name, args, { ...baseContext, toolCallKey });
          toolsUsed.push(call.function.name);

          await supabase.from("ai_messages").insert({
            conversation_id: conversationId,
            workspace_id: workspace.id,
            role: "tool",
            content: result.ok ? "ok" : result.error,
            tool_name: call.function.name,
            tool_args: args as never,
            tool_result: result as never,
          });

          messages.push({
            role: "tool",
            tool_call_id: call.id,
            content: JSON.stringify(result).slice(0, 6000),
          });
        }
        continue;
      }

      reply = (choice.content ?? "").trim();
      break;
    }
  } catch (error) {
    logger.error("ai.completion_failed", { error });
    throw new AppError("integration_unavailable", dict.assistant.temporarilyUnavailable);
  }

  if (interactiveContext?.clarification && !interactiveContext.draft) {
    reply = clarificationMessage(dict, interactiveContext.clarification);
  }
  if (!reply) {
    reply = interactiveContext?.draft
      ? dict.assistant.preparedFallback
      : dict.assistant.fallback;
  }

  let command: AiCommandView | null = null;
  if (interactiveContext?.draft) {
    try {
      command = await createAiCommand({
        workspaceId: workspace.id,
        userId,
        conversationId,
        messageId: userMessage.id,
        requestId: params.requestId,
        commandText: params.message,
        reply,
        locale,
        draft: interactiveContext.draft,
      });

      if (
        params.autoPost !== false &&
        reference?.settings.autoPost &&
        interactiveContext.draft.preview.autoPostEligible
      ) {
        try {
          command = await confirmAiCommand(command.id, true);
          reply = `${reply}\n\n${dict.assistant.autoPosted}\n${dict.assistant.undoHint}`;
          await setAiCommandReply(command.id, reply).catch((error) => {
            logger.warn("ai.command_reply_update_failed", { error });
          });
        } catch (error) {
          logger.warn("ai.auto_post_failed", { error });
        }
      }
    } catch (error) {
      logger.error("ai.command_persist_failed", { error });
      throw new AppError("internal_error", dict.assistant.saveFailed);
    }
  }

  const { error: assistantError } = await supabase.from("ai_messages").insert({
    conversation_id: conversationId,
    workspace_id: workspace.id,
    role: "assistant",
    content: reply.slice(0, 8000),
    model,
    prompt_tokens: promptTokens,
    completion_tokens: completionTokens,
  });
  if (assistantError) logger.error("ai.persist_failed", { code: assistantError.code });

  await supabase
    .from("ai_conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", conversationId);

  await supabase
    .from("ai_interactions")
    .insert({
      workspace_id: workspace.id,
      user_id: userId,
      conversation_id: conversationId,
      channel: mode === "interactive" ? "web" : params.serviceRole ? "whatsapp" : "web",
      model,
      prompt_preview: params.message.slice(0, 500),
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      latency_ms: Date.now() - startedAt,
      tool_calls: toolsUsed as never,
      status: "ok",
    })
    .then(({ error }) => {
      if (error) logger.warn("ai.interaction_log_failed", { code: error.code });
    });

  return {
    conversationId,
    reply,
    toolsUsed,
    command,
    clarification: Boolean(interactiveContext?.clarification && !interactiveContext.draft),
  };
}

async function ensureConversation(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workspaceId: string,
  userId: string,
  conversationId: string | null | undefined,
  message: string,
  failureMessage: string,
): Promise<string> {
  if (conversationId) {
    const { data } = await supabase
      .from("ai_conversations")
      .select("id")
      .eq("id", conversationId)
      .eq("workspace_id", workspaceId)
      .eq("user_id", userId)
      .maybeSingle();
    if (data?.id) return data.id;
  }

  const { data, error } = await supabase
    .from("ai_conversations")
    .insert({
      workspace_id: workspaceId,
      user_id: userId,
      title: message.slice(0, 80),
    })
    .select("id")
    .single();

  if (error || !data) throw new AppError("internal_error", failureMessage);
  return data.id;
}
