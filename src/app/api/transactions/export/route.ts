import { NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/supabase/auth";
import { can } from "@/lib/permissions";
import { exportTransactionRecordsCsv } from "@/services/reports";
import { resolveLocale } from "@/lib/i18n/config";
import { logger } from "@/lib/logger";

const KINDS = ["income", "expense", "transfer", "all"] as const;

export async function GET(request: Request) {
  const context = await getWorkspaceContext();
  if (!context) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (!can(context.role, "reports:export")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const requestedKind = url.searchParams.get("kind") ?? "all";
  const kind = KINDS.includes(requestedKind as (typeof KINDS)[number])
    ? (requestedKind as (typeof KINDS)[number])
    : "all";
  const search = (url.searchParams.get("q") ?? "").slice(0, 80);
  const fromParam = url.searchParams.get("from") ?? "";
  const toParam = url.searchParams.get("to") ?? "";
  const from = /^\d{4}-\d{2}-\d{2}$/.test(fromParam) ? fromParam : undefined;
  const to = /^\d{4}-\d{2}-\d{2}$/.test(toParam) ? toParam : undefined;
  const locale = resolveLocale(url.searchParams.get("locale") ?? context.workspace.locale);

  try {
    const csv = await exportTransactionRecordsCsv(context.workspace.id, { kind, search, from, to }, locale);
    return new NextResponse(`\uFEFF${csv}`, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="kontaflow-transactions-${new Date().toISOString().slice(0, 10)}.csv"`,
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    logger.error("transactions.export_failed", { error });
    return NextResponse.json({ error: "export_failed" }, { status: 500 });
  }
}
