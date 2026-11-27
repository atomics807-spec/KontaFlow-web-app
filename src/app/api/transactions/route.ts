import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceContext } from "@/lib/supabase/auth";
import { can } from "@/lib/permissions";
import { consumeRateLimitDetailed, rateLimitHeaders } from "@/lib/security/durable-rate-limit";
import { listTransactionsPage, type TransactionFilters } from "@/services/transactions";
import { isAppError } from "@/lib/errors";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const context = await getWorkspaceContext();
  if (!context) return NextResponse.json({ error: "no_workspace" }, { status: 403 });
  if (!can(context.role, "transactions:read")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const limit = await consumeRateLimitDetailed(`transactions-list:${user.id}`, 120, 60);
  if (!limit.allowed) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: rateLimitHeaders(limit) });
  }

  const params = new URL(request.url).searchParams;
  const filters: TransactionFilters & { cursor?: string | null } = {
    kind: (params.get("kind") as TransactionFilters["kind"]) ?? "all",
    status: (params.get("status") as TransactionFilters["status"]) ?? "all",
    categoryId: params.get("categoryId") ?? undefined,
    search: params.get("search") ?? undefined,
    from: params.get("from") ?? undefined,
    to: params.get("to") ?? undefined,
    limit: Number.isFinite(Number(params.get("limit"))) ? Number(params.get("limit")) : 50,
    cursor: params.get("cursor"),
  };

  try {
    const page = await listTransactionsPage(context.workspace.id, filters);
    return NextResponse.json(page, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    if (isAppError(error)) {
      return NextResponse.json({ error: error.code, message: error.publicMessage }, { status: error.status });
    }
    logger.error("transactions.list_failed", { error });
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
