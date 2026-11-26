import "server-only";

import { monthBounds } from "@/lib/dates";
import { AppError } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import { assertNoError } from "@/lib/supabase/errors";
import type { DashboardSummary } from "@/types/database";

export async function getDashboardSummary(
  workspaceId: string,
  from: string,
  to: string,
): Promise<DashboardSummary> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_dashboard_summary", {
    p_workspace_id: workspaceId,
    p_from: from,
    p_to: to,
  });

  if (error) throw assertNoError(error, "Could not load your dashboard.");
  if (!data) throw new AppError("not_found", "Workspace not found.");
  return data as DashboardSummary;
}

export async function getDashboardForMonth(workspaceId: string, timezone: string) {
  const { start, end } = monthBounds(new Date(), timezone);
  return getDashboardSummary(workspaceId, start, end);
}
