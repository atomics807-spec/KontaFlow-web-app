import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceContext } from "@/lib/supabase/auth";
import { can } from "@/lib/permissions";
import { getReport } from "@/services/reports";
import { renderReportPdf } from "@/services/report-pdf";
import { resolveLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/server";
import { logger } from "@/lib/logger";
import { consumeExportAllowance } from "@/lib/entitlements/service";
import { isAppError } from "@/lib/errors";

export const dynamic = "force-dynamic";

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

  const locale = resolveLocale(requestedLocale ?? context.workspace.locale);

  try {
    await consumeExportAllowance(context.workspace.id, user.id, "advanced_exports");
    const [report, dict] = await Promise.all([getReport(context.workspace.id, from, to), getDictionary(locale)]);
    const pdf = await renderReportPdf({
      report,
      workspace: {
        name: context.workspace.name,
        currency: context.workspace.currency,
        timezone: context.workspace.timezone,
      },
      locale,
      dict,
    });

    const body = pdf.buffer.slice(pdf.byteOffset, pdf.byteOffset + pdf.byteLength) as ArrayBuffer;
    return new NextResponse(body, {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="kontaflow-report-${from}-${to}-${locale}.pdf"`,
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    if (isAppError(error)) {
      return NextResponse.json({ error: error.code, message: error.publicMessage }, { status: error.status });
    }
    logger.error("reports.pdf_failed", { error });
    return NextResponse.json({ error: "export_failed" }, { status: 500 });
  }
}
