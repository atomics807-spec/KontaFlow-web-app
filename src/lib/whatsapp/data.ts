import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { toMinorUnits } from "@/lib/money";
import type { DashboardSummary, ReportResult } from "@/types/database";

export async function dashboardSummaryAsService(
  workspaceId: string,
  from: string,
  to: string,
): Promise<DashboardSummary> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("get_workspace_summary_as_service", {
    p_workspace_id: workspaceId,
    p_from: from,
    p_to: to,
  });
  if (error || !data) throw new Error("Could not read the workspace summary");
  return data as DashboardSummary;
}

export async function reportAsService(
  workspaceId: string,
  from: string,
  to: string,
): Promise<ReportResult> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("get_report_as_service", {
    p_workspace_id: workspaceId,
    p_from: from,
    p_to: to,
  });
  if (error || !data) throw new Error("Could not build the workspace report");
  return data as ReportResult;
}

export type ReceivablesSummary = {
  totalMinor: bigint;
  overdueMinor: bigint;
  count: number;
  overdueCount: number;
  currency: string;
  top: { contactName: string; remainingMinor: bigint; dueOn: string | null; overdue: boolean }[];
};

type ReceivableRow = {
  contact_name: string;
  remaining_minor: number;
  currency: string;
  due_on: string | null;
  is_overdue: boolean;
};

export async function receivablesAsService(workspaceId: string): Promise<ReceivablesSummary> {
  const admin = createAdminClient();
  const pageSize = 1000;
  const rows: ReceivableRow[] = [];

  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await admin
      .from("v_debts")
      .select("contact_name, remaining_minor, currency, due_on, is_overdue")
      .eq("workspace_id", workspaceId)
      .eq("direction", "receivable")
      .in("status", ["open", "partially_paid"])
      .gt("remaining_minor", 0)
      .order("remaining_minor", { ascending: false })
      .order("id", { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (error) throw new Error("Could not read receivables");
    rows.push(...((data ?? []) as ReceivableRow[]));
    if (!data || data.length < pageSize) break;
  }

  const totalMinor = rows.reduce((sum, row) => sum + toMinorUnits(row.remaining_minor), 0n);
  const overdueRows = rows.filter((row) => row.is_overdue);
  const overdueMinor = overdueRows.reduce((sum, row) => sum + toMinorUnits(row.remaining_minor), 0n);

  return {
    totalMinor,
    overdueMinor,
    count: rows.length,
    overdueCount: overdueRows.length,
    currency: rows[0]?.currency ?? "XAF",
    top: rows.slice(0, 3).map((row) => ({
      contactName: row.contact_name,
      remainingMinor: toMinorUnits(row.remaining_minor),
      dueOn: row.due_on,
      overdue: Boolean(row.is_overdue),
    })),
  };
}
