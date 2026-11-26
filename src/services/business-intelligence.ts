import "server-only";

import { addDays, todayInZone } from "@/lib/dates";
import { AppError } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import { assertNoError } from "@/lib/supabase/errors";
import type { AiWorkspacePreferences, BusinessIntelligence } from "@/types/ai-advisor";
import { getAiPreferences } from "./ai-preferences";

export function analysisBounds(today: string, windowDays: number): { from: string; to: string } {
  const days = Math.min(Math.max(Math.trunc(windowDays), 30), 730);
  return { from: addDays(today, -(days - 1)), to: today };
}

export async function getBusinessIntelligence(
  workspaceId: string,
  from: string,
  to: string,
): Promise<BusinessIntelligence> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_business_intelligence", {
    p_workspace_id: workspaceId,
    p_from: from,
    p_to: to,
  });
  if (error) throw assertNoError(error, "Could not build business intelligence.");
  if (!data) throw new AppError("not_found", "Workspace not found.");
  return data as BusinessIntelligence;
}

export async function getAdvisorWorkspaceData(params: {
  workspaceId: string;
  timezone: string;
  windowDays?: number;
}): Promise<{
  preferences: AiWorkspacePreferences;
  intelligence: BusinessIntelligence;
  from: string;
  to: string;
}> {
  const preferences = await getAiPreferences(params.workspaceId);
  if (!preferences.insightsEnabled) {
    throw new AppError("forbidden", "Business intelligence is disabled for this workspace.");
  }
  const { from, to } = analysisBounds(
    todayInZone(params.timezone),
    params.windowDays ?? preferences.analysisWindowDays,
  );
  return {
    preferences,
    intelligence: await getBusinessIntelligence(params.workspaceId, from, to),
    from,
    to,
  };
}
