import { NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/supabase/auth";
import { can } from "@/lib/permissions";
import { consumeRateLimit } from "@/lib/security/durable-rate-limit";
import { AppError, isAppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { paymentInitiateSchema } from "@/lib/validation/payments";
import { resolveLocale } from "@/lib/i18n/config";
import { initiateSubscriptionPayment } from "@/services/payments";
import { rejectCrossOrigin } from "@/lib/security/csrf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const blocked = rejectCrossOrigin(request);
  if (blocked) return blocked;

  const context = await getWorkspaceContext();
  if (!context) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (!can(context.role, "billing:manage")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (!(await consumeRateLimit(`payment-initiate:${context.user.id}`, 10, 60))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const payload = await request.json().catch(() => null);
  const parsed = paymentInitiateSchema.safeParse({
    ...(payload && typeof payload === "object" ? payload : {}),
    idempotencyKey:
      (payload && typeof payload === "object" && "idempotencyKey" in payload
        ? (payload as { idempotencyKey?: unknown }).idempotencyKey
        : null) ?? request.headers.get("idempotency-key"),
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_payload", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  try {
    const payment = await initiateSubscriptionPayment({
      workspaceId: context.workspace.id,
      userId: context.user.id,
      planCode: parsed.data.planCode,
      provider: parsed.data.provider,
      payerMsisdn: parsed.data.payerMsisdn ?? null,
      idempotencyKey: parsed.data.idempotencyKey ?? null,
      locale: resolveLocale(context.profile.locale ?? context.workspace.locale),
    });
    return NextResponse.json({ payment }, { status: 200, headers: { "cache-control": "no-store" } });
  } catch (error) {
    const appError = isAppError(error)
      ? error
      : new AppError("internal_error", "The payment could not be started. Please try again.");
    if (!isAppError(error)) logger.error("payments.initiate_failed", { error });
    return NextResponse.json(
      { error: appError.code, message: appError.publicMessage },
      { status: appError.status, headers: { "cache-control": "no-store" } },
    );
  }
}
