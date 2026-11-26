import "server-only";

import { createClient } from "@/lib/supabase/server";
import { assertNoError } from "@/lib/supabase/errors";
import { AppError } from "@/lib/errors";
import type { AdvisorFocus, AiWorkspacePreferences } from "@/types/ai-advisor";
import type { AiWorkspacePreferencesRow } from "@/types/database";

export const DEFAULT_AI_PREFERENCES: Omit<AiWorkspacePreferences, "workspaceId"> = {
  insightsEnabled: true,
  analysisWindowDays: 180,
  historyRetentionDays: 90,
  advisorFocus: "balanced",
  advisorNote: null,
};

function toPreferences(row: AiWorkspacePreferencesRow | null): AiWorkspacePreferences | null {
  if (!row) return null;
  return {
    workspaceId: row.workspace_id,
    insightsEnabled: row.insights_enabled,
    analysisWindowDays: row.analysis_window_days,
    historyRetentionDays: row.history_retention_days,
    advisorFocus: row.advisor_focus,
    advisorNote: row.advisor_note,
  };
}

export async function getAiPreferences(workspaceId: string): Promise<AiWorkspacePreferences> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ai_workspace_preferences")
    .select("*")
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (error) throw assertNoError(error, "Could not load AI preferences.");

  return (
    toPreferences(data as AiWorkspacePreferencesRow | null) ?? {
      workspaceId,
      ...DEFAULT_AI_PREFERENCES,
    }
  );
}

export async function updateAiPreferences(params: {
  workspaceId: string;
  insightsEnabled: boolean;
  analysisWindowDays: number;
  historyRetentionDays: number;
  advisorFocus: AdvisorFocus;
  advisorNote: string | null;
}): Promise<AiWorkspacePreferences> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("update_ai_preferences", {
    p_workspace_id: params.workspaceId,
    p_insights_enabled: params.insightsEnabled,
    p_analysis_window_days: params.analysisWindowDays,
    p_history_retention_days: params.historyRetentionDays,
    p_advisor_focus: params.advisorFocus,
    p_advisor_note: params.advisorNote,
  });
  if (error) throw assertNoError(error, "Could not save AI preferences.");
  if (!data) throw new AppError("not_found", "Workspace not found.");

  return {
    workspaceId: data.workspace_id,
    insightsEnabled: data.insights_enabled,
    analysisWindowDays: data.analysis_window_days,
    historyRetentionDays: data.history_retention_days,
    advisorFocus: data.advisor_focus,
    advisorNote: data.advisor_note,
  };
}

export async function purgeAiHistory(
  workspaceId: string,
  options: { olderThanDays?: number; deleteAll?: boolean } = {},
): Promise<{ messages: number; interactions: number; conversations: number; olderThanDays: number }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("purge_ai_history", {
    p_workspace_id: workspaceId,
    p_older_than_days: options.olderThanDays ?? null,
    p_delete_all: options.deleteAll ?? false,
  });
  if (error) throw assertNoError(error, "Could not purge AI history.");
  if (!data) throw new AppError("not_found", "Workspace not found.");
  return {
    messages: data.messages,
    interactions: data.interactions,
    conversations: data.conversations,
    olderThanDays: data.older_than_days,
  };
}
