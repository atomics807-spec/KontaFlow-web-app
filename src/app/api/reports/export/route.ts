import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceContext } from "@/lib/supabase/auth";
import { can } from "@/lib/permissions";
import { exportTransactionsCsv } from "@/services/reports";
import { resolveLocale } from "@/lib/i18n/config";
import { logger } from "@/lib/logger";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const from = url.searchParams.get("from") ?? "";
  const to = url.searchParams.get("to") ?? "";
  const requestedLocale = url.searchParams.get("locale");

  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return NextResponse.json({ error: "invalid_period" }, { status: 422 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const context = await getWorkspaceContext();
  if (!context) return NextResponse.json({ error: "no_workspace" }, { status: 403 });
  if (!can(context.role, "reports:export")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  try {
    const csv = await exportTransactionsCsv(
      context.workspace.id,
      from,
      to,
      resolveLocale(requestedLocale ?? context.workspace.locale),
    );
    return new NextResponse(`\uFEFF${csv}`, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="kontaflow-${context.workspace.id.slice(0, 8)}-${from}-${to}.csv"`,
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    logger.error("reports.export_failed", { error });
    return NextResponse.json({ error: "export_failed" }, { status: 500 });
  }
}
