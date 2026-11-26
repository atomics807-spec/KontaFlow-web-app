import "server-only";

import type OpenAI from "openai";
import { getAiClient, getAiModel } from "./client";
import { TOOL_DEFINITIONS, executeTool, type ToolContext } from "./tools";
import { buildSystemPrompt } from "./prompt";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { planFor } from "@/lib/plans";
import { todayInZone } from "@/lib/dates";
import type { Locale } from "@/lib/i18n/config";
import type { WorkspaceRow } from "@/types/database";

export type AssistantReply = {
  conversationId: string;
  reply: string;
  toolsUsed: string[];
};

type HistoryRow = { role: string; content: string };

export async function runAssistant(params: {
  workspace: WorkspaceRow;
  userId: string;
  locale: Locale;
  message: string;
  conversationId?: string | null;
  /** Webhook channels have no user session; they run on the service role. */
  serviceRole?: boolean;
}): Promise<AssistantReply> {
  const openai = getAiClient();
  if (!openai) {
    throw new AppError("integration_unavailable", "The assistant is not configured on this deployment yet.");
  }

  const supabase = params.serviceRole ? createAdminClient() : await createClient();
  const { workspace, userId, locale } = params;
  const limit = planFor(workspace.plan).aiMessagesPerMonth;

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
    throw new AppError("internal_error", "Could not verify your assistant quota.");
  }
  if (allowed === false) {
    throw new AppError("rate_limited", "You have reached this month's AI message limit.");
  }

  const conversationId = await ensureConversation(supabase, workspace.id, userId, params.conversationId, params.message);

  const { error: insertError } = await supabase.from("ai_messages").insert({
    conversation_id: conversationId,
    workspace_id: workspace.id,
    role: "user",
    content: params.message.slice(0, 4000),
  });
  if (insertError) throw new AppError("internal_error", "Could not save your message.");

  const { data: historyRows } = await supabase
    .from("ai_messages")
    .select("role, content")
    .eq("conversation_id", conversationId)
    .in("role", ["user", "assistant"])
    .order("created_at", { ascending: false })
    .limit(12);

  const history = ((historyRows ?? []) as HistoryRow[]).reverse();

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    {
      role: "system",
      content: buildSystemPrompt({
        workspace,
        locale,
        today: todayInZone(workspace.timezone),
        plan: workspace.plan,
      }),
    },
    ...history.map((row) => ({
      role: row.role === "assistant" ? ("assistant" as const) : ("user" as const),
      content: row.content,
    })),
  ];

  const context: ToolContext = { workspace, userId, conversationId };
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
        tools: TOOL_DEFINITIONS,
        tool_choice: "auto",
        temperature: 0.2,
        max_completion_tokens: 700,
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

        for (const call of choice.tool_calls) {
          if (call.type !== "function") continue;
          let args: Record<string, unknown> = {};
          try {
            args = JSON.parse(call.function.arguments || "{}") as Record<string, unknown>;
          } catch {
            args = {};
          }

          const result = await executeTool(call.function.name, args, context);
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
    throw new AppError("integration_unavailable", "The assistant is temporarily unavailable. Try again.");
  }

  if (!reply) {
    reply =
      locale === "fr"
        ? "Je n'ai pas pu terminer cette réponse. Pouvez-vous reformuler ?"
        : locale === "wes"
          ? "I no fit finish that answer. Abeg talk am another way."
          : "I could not finish that answer. Could you ask it another way?";
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

  return { conversationId, reply, toolsUsed };
}

async function ensureConversation(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workspaceId: string,
  userId: string,
  conversationId: string | null | undefined,
  message: string,
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

  if (error || !data) throw new AppError("internal_error", "Could not start the conversation.");
  return data.id;
}
