import { NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/supabase/auth";
import { can } from "@/lib/permissions";
import { listTransactions } from "@/services/transactions";
import { renderTransactionsPdf } from "@/services/transactions-pdf";
import { resolveLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/server";
import { logger } from "@/lib/logger";
import { consumeExportAllowance } from "@/lib/entitlements/service";
import { isAppError } from "@/lib/errors";

export const dynamic = "force-dynamic";

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
    await consumeExportAllowance(context.workspace.id, context.user.id, "advanced_exports");
    const [rows, dict] = await Promise.all([
      listTransactions(context.workspace.id, { kind, search, from, to, limit: 5000 }),
      getDictionary(locale),
    ]);
    const pdf = await renderTransactionsPdf({
      workspace: {
        name: context.workspace.name,
        currency: context.workspace.currency,
        timezone: context.workspace.timezone,
      },
      rows,
      locale,
      dict,
    });
    const body = pdf.buffer.slice(pdf.byteOffset, pdf.byteOffset + pdf.byteLength) as ArrayBuffer;
    const suffix = from && to ? `-${from}-${to}` : "";
    return new NextResponse(body, {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="kontaflow-transactions${suffix}-${locale}.pdf"`,
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    if (isAppError(error)) {
      return NextResponse.json({ error: error.code, message: error.publicMessage }, { status: error.status });
    }
    logger.error("transactions.pdf_failed", { error });
    return NextResponse.json({ error: "export_failed" }, { status: 500 });
  }
}
