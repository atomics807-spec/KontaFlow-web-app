import "server-only";

import { AppError } from "@/lib/errors";
import { getCurrency } from "@/lib/currency";
import { createClient } from "@/lib/supabase/server";
import { assertNoError } from "@/lib/supabase/errors";
import { getDictionary } from "@/lib/i18n/server";
import type { Locale } from "@/lib/i18n/config";
import type { ReportResult } from "@/types/database";

export async function getReport(workspaceId: string, from: string, to: string): Promise<ReportResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_report", {
    p_workspace_id: workspaceId,
    p_from: from,
    p_to: to,
  });

  if (error) throw assertNoError(error, "Could not build the report.");
  if (!data) throw new AppError("not_found", "Workspace not found.");
  return data as ReportResult;
}

/** CSV for accountants: one row per transaction, amounts in major units. */
export async function exportTransactionsCsv(
  workspaceId: string,
  from: string,
  to: string,
  locale: Locale = "en",
): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("v_transactions")
    .select("*")
    .eq("workspace_id", workspaceId)
    .gte("occurred_on", from)
    .lte("occurred_on", to)
    .order("occurred_on", { ascending: true });

  if (error) throw assertNoError(error, "Could not export transactions.");

  const dict = await getDictionary(locale);
  const labels = dict.reports.csv;
  const kindLabel = (kind: string) =>
    kind === "income" ? labels.income : kind === "expense" ? labels.expense : kind === "transfer" ? labels.transfer : kind;
  const statusLabel = (status: string) => (status === "void" || status === "voided" ? labels.voided : labels.posted);

  const header = [
    labels.date,
    labels.type,
    labels.description,
    labels.category,
    labels.contact,
    labels.account,
    labels.amount,
    labels.currency,
    labels.status,
    labels.reference,
  ];
  const rows = (data ?? []).map((row) => [
    row.occurred_on,
    kindLabel(row.kind),
    row.description,
    row.category_name ?? "",
    row.contact_name ?? "",
    row.account_name,
    formatMajor(row.amount_minor, row.currency),
    row.currency,
    statusLabel(row.status),
    row.reference ?? "",
  ]);

  return [header, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");
}

function formatMajor(amountMinor: number, currency: string): string {
  const { decimals } = getCurrency(currency);
  const divisor = 10 ** decimals;
  return (amountMinor / divisor).toFixed(decimals);
}
