import "server-only";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertNoError } from "@/lib/supabase/errors";
import { AppError } from "@/lib/errors";
import { toSafeNumber } from "@/lib/money";
import type { AiCommandDraft, AiCommandResult, AiCommandView } from "@/lib/ai/types";
import { aiCommandPreviewSchema } from "@/lib/ai/schemas";
import type { AiCommandRow } from "@/types/database";

export function commandRowToView(row: AiCommandRow, now = new Date()): AiCommandView {
  const parsed = aiCommandPreviewSchema.safeParse(row.preview);
  const actions = parsed.success ? parsed.data.actions : [];
  const warnings = parsed.success ? parsed.data.warnings : [];
  const result = (row.result ?? null) as AiCommandResult | null;
  const undoOpen = !row.undo_expires_at || new Date(row.undo_expires_at).getTime() > now.getTime();
  return {
    id: row.id,
    conversationId: row.conversation_id,
    status: row.status,
    autoPosted: row.auto_posted,
    actions,
    warnings,
    reply: row.reply,
    createdAt: row.created_at,
    confirmedAt: row.confirmed_at,
    undoExpiresAt: row.undo_expires_at,
    canUndo:
      row.status === "confirmed" &&
      undoOpen &&
      actions.length > 0 &&
      actions.every((action) => action.type === "transaction"),
    result,
  };
}

export async function findAiCommandByRequest(
  workspaceId: string,
  requestId: string,
  options: { userId?: string; serviceRole?: boolean } = {},
): Promise<AiCommandView | null> {
  const supabase = options.serviceRole ? createAdminClient() : await createClient();
  const base = supabase
    .from("ai_commands")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("request_id", requestId);
  const { data, error } = options.userId
    ? await base.eq("user_id", options.userId).maybeSingle()
    : await base.maybeSingle();
  if (error) throw assertNoError(error, "Could not load the AI draft.");
  return data ? commandRowToView(data as AiCommandRow) : null;
}

export async function getAiCommand(workspaceId: string, commandId: string): Promise<AiCommandView | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ai_commands")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("id", commandId)
    .maybeSingle();
  if (error) throw assertNoError(error, "Could not load the AI draft.");
  return data ? commandRowToView(data as AiCommandRow) : null;
}

export async function createAiCommand(params: {
  workspaceId: string;
  userId: string;
  conversationId: string;
  messageId: string | null;
  requestId: string;
  commandText: string;
  reply: string;
  locale: string;
  draft: AiCommandDraft;
  serviceRole?: boolean;
}): Promise<AiCommandView> {
  const supabase = params.serviceRole ? createAdminClient() : await createClient();
  const { data, error } = await supabase
    .from("ai_commands")
    .insert({
      workspace_id: params.workspaceId,
      user_id: params.userId,
      conversation_id: params.conversationId,
      message_id: params.messageId,
      request_id: params.requestId,
      command_text: params.commandText,
      reply: params.reply,
      locale: params.locale,
      interpretation: params.draft.interpretation as never,
      preview: params.draft.preview as never,
    })
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") {
      const existing = await findAiCommandByRequest(params.workspaceId, params.requestId, {
        userId: params.userId,
        serviceRole: params.serviceRole,
      });
      if (existing) return existing;
    }
    throw assertNoError(error, "Could not save the AI draft.");
  }

  return commandRowToView(data as AiCommandRow);
}

export async function confirmAiCommand(
  commandId: string,
  autoPosted = false,
  serviceRole = false,
): Promise<AiCommandView> {
  const supabase = serviceRole ? createAdminClient() : await createClient();
  const { error } = await supabase.rpc("confirm_ai_command", {
    p_command_id: commandId,
    p_auto_posted: autoPosted,
  });
  if (error) throw assertNoError(error, "Could not post the AI draft.");
  return requireCommand(commandId, serviceRole);
}

export async function dismissAiCommand(commandId: string): Promise<AiCommandView> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("dismiss_ai_command", { p_command_id: commandId });
  if (error) throw assertNoError(error, "Could not dismiss the AI draft.");
  return requireCommand(commandId);
}

export async function setAiCommandReply(
  commandId: string,
  reply: string,
  serviceRole = false,
): Promise<void> {
  const supabase = serviceRole ? createAdminClient() : await createClient();
  const { error } = await supabase.rpc("set_ai_command_reply", {
    p_command_id: commandId,
    p_reply: reply.slice(0, 8000),
  });
  if (error) throw assertNoError(error, "Could not save the AI reply.");
}

export async function undoAiCommand(commandId: string, reason?: string): Promise<AiCommandView> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("undo_ai_command", {
    p_command_id: commandId,
    p_reason: reason ?? null,
  });
  if (error) throw assertNoError(error, "Could not undo the AI command.");
  return requireCommand(commandId);
}

async function requireCommand(commandId: string, serviceRole = false): Promise<AiCommandView> {
  const supabase = serviceRole ? createAdminClient() : await createClient();
  const { data, error } = await supabase
    .from("ai_commands")
    .select("*")
    .eq("id", commandId)
    .maybeSingle();
  if (error) throw assertNoError(error, "Could not load the AI draft.");
  if (!data) throw new AppError("not_found", "Could not load the AI draft.");
  return commandRowToView(data as AiCommandRow);
}

export async function getLatestActionableCommand(
  workspaceId: string,
  userId: string,
): Promise<AiCommandView | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ai_commands")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .in("status", ["pending", "confirmed"])
    .order("created_at", { ascending: false })
    .limit(5);
  if (error) throw assertNoError(error, "Could not load recent AI drafts.");
  const now = new Date();
  for (const row of (data ?? []) as AiCommandRow[]) {
    const view = commandRowToView(row, now);
    if (view.status === "pending" || view.canUndo) return view;
  }
  return null;
}

export async function getAiSettings(workspaceId: string): Promise<{
  autoPost: boolean;
  autoPostMaxMinor: bigint;
}> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("business_settings")
    .select("ai_auto_post, ai_auto_post_max_minor")
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (error) throw assertNoError(error, "Could not load AI settings.");
  return {
    autoPost: Boolean(data?.ai_auto_post),
    autoPostMaxMinor: BigInt(String(data?.ai_auto_post_max_minor ?? 5000)),
  };
}

export async function updateAiSettings(params: {
  workspaceId: string;
  autoPost: boolean;
  autoPostMaxMinor: bigint;
}): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("business_settings")
    .update({
      ai_auto_post: params.autoPost,
      ai_auto_post_max_minor: toSafeNumber(params.autoPostMaxMinor),
    })
    .eq("workspace_id", params.workspaceId);
  if (error) throw assertNoError(error, "Could not save AI settings.");
}
