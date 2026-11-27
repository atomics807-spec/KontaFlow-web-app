import { NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/supabase/auth";
import { can } from "@/lib/permissions";
import { consumeRateLimit } from "@/lib/security/durable-rate-limit";
import { AppError, isAppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { refreshPaymentStatus } from "@/services/payments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
  const workspace = await getWorkspaceContext();
  if (!workspace) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (!can(workspace.role, "billing:manage")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (!(await consumeRateLimit(`payment-status:${workspace.user.id}`, 30, 60))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const { id } = await context.params;
  try {
    const payment = await refreshPaymentStatus(id, workspace.workspace.id);
    return NextResponse.json({ payment }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    const appError = isAppError(error)
      ? error
      : new AppError("internal_error", "The payment status could not be checked.");
    if (!isAppError(error)) logger.error("payments.status_failed", { error });
    return NextResponse.json(
      { error: appError.code, message: appError.publicMessage },
      { status: appError.status, headers: { "cache-control": "no-store" } },
    );
  }
}
