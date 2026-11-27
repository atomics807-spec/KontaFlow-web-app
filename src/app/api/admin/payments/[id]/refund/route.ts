import { NextResponse } from "next/server";
import { z } from "zod";
import { getPlatformAdmin, canManageAccounts } from "@/lib/platform-admin";
import { createAdminClient, hasServiceRole } from "@/lib/supabase/admin";
import { AppError, isAppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { paymentRefundSchema } from "@/lib/validation/payments";
import { refundSubscriptionPayment } from "@/services/payments";
import { rejectCrossOrigin } from "@/lib/security/csrf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  const blocked = rejectCrossOrigin(request);
  if (blocked) return blocked;

  const admin = await getPlatformAdmin();
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (!canManageAccounts(admin.role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (!hasServiceRole()) {
    return NextResponse.json({ error: "configuration_missing" }, { status: 503 });
  }

  const payload = await request.json().catch(() => null);
  const parsed = paymentRefundSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_payload", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const supabase = createAdminClient();
  const { data: payment, error } = await supabase
    .from("payment_transactions")
    .select("id, workspace_id")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    logger.error("admin.payment_lookup_failed", { code: error.code });
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
  if (!payment) return NextResponse.json({ error: "not_found" }, { status: 404 });

  try {
    const result = await refundSubscriptionPayment({
      paymentId: payment.id,
      workspaceId: payment.workspace_id,
      actorId: admin.user_id,
      amountMinor: parsed.data.amountMinor,
      reason: parsed.data.reason,
      kind: parsed.data.kind,
    });
    return NextResponse.json({ refund: result }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    const appError = isAppError(error)
      ? error
      : new AppError("internal_error", "The refund could not be completed.");
    if (!isAppError(error)) logger.error("admin.payment_refund_failed", { error });
    return NextResponse.json(
      { error: appError.code, message: appError.publicMessage },
      { status: appError.status, headers: { "cache-control": "no-store" } },
    );
  }
}
