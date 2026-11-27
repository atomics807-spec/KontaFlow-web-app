import "server-only";

import { randomBytes, randomUUID } from "node:crypto";
import { AppError, isAppError } from "@/lib/errors";
import { getPublicEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import { normalizeMsisdn } from "@/lib/payments/phone";
import { hashWebhookToken } from "@/lib/payments/signature";
import { getPaymentAdapter } from "@/lib/payments/registry";
import { isPaymentProvider, type PaymentProviderId, type ProviderPaymentStatus } from "@/lib/payments/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertNoError } from "@/lib/supabase/errors";
import { sendPaymentConfirmationEmail } from "@/lib/integrations/email";
import { resolveLocale } from "@/lib/i18n/config";
import type { Json, PaymentTransactionRow } from "@/types/database";
import type { PaymentCheckout, PaymentHistoryItem, PaymentPublicStatus } from "@/types/payments";

const PAYMENT_EXPIRY_MINUTES = 20;
const PAYMENT_GRACE_MINUTES = 10;
const STATUS_REFRESH_MS = 4_000;

type CreateIntentResult = {
  payment_id: string;
  merchant_reference: string;
  provider: string;
  plan_code: string;
  amount_minor: number;
  currency: string;
  status: PaymentTransactionRow["status"];
  checkout_url: string | null;
  expires_at: string | null;
  reused: boolean;
};

type ConfirmResult = {
  duplicate: boolean;
  payment_id?: string;
  workspace_id?: string;
  workspace_name?: string;
  owner_id?: string;
  owner_locale?: string;
  plan_code?: string;
  plan_name?: string;
  amount_minor?: number;
  currency?: string;
  status?: string;
};

type WebhookResult = {
  status: "processed" | "ignored" | "retry" | "failed";
  paymentId?: string;
  reason?: string;
};

function appBaseUrl(): string {
  return getPublicEnv().NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
}

function parseProvider(value: string): PaymentProviderId {
  if (!isPaymentProvider(value)) {
    throw new AppError("internal_error", "This payment has an unsupported provider.");
  }
  return value;
}

function publicStatus(row: PaymentTransactionRow): PaymentPublicStatus {
  return {
    id: row.id,
    merchantReference: row.merchant_reference,
    provider: parseProvider(row.provider),
    planCode: row.plan_code,
    amountMinor: Number(row.amount_minor),
    currency: row.currency,
    status: row.status,
    checkoutUrl: ["pending", "processing"].includes(row.status) ? row.checkout_url : null,
    failureCode: row.failure_code,
    failureMessage: row.failure_message,
    paidAt: row.paid_at,
    expiresAt: row.expires_at,
    refundedAmountMinor: Number(row.refunded_amount_minor),
    createdAt: row.created_at,
  };
}

async function loadPayment(paymentId: string, workspaceId?: string): Promise<PaymentTransactionRow> {
  const admin = createAdminClient();
  let query = admin.from("payment_transactions").select("*").eq("id", paymentId);
  if (workspaceId) query = query.eq("workspace_id", workspaceId);
  const { data, error } = await query.maybeSingle();
  if (error) assertNoError(error, "Could not load this payment.");
  if (!data) throw new AppError("not_found", "We could not find that payment.");
  return data as PaymentTransactionRow;
}

async function reloadPayment(paymentId: string): Promise<PaymentTransactionRow> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("payment_transactions")
    .select("*")
    .eq("id", paymentId)
    .maybeSingle();
  if (error) assertNoError(error, "Could not reload this payment.");
  if (!data) throw new AppError("not_found", "We could not find that payment.");
  return data as PaymentTransactionRow;
}

async function markFailed(
  paymentId: string,
  code: string,
  message: string,
  status: "failed" | "expired" = "failed",
): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.rpc("fail_payment", {
    p_payment_id: paymentId,
    p_code: code,
    p_message: message,
    p_status: status,
  });
  if (error) logger.warn("payments.fail_transition_failed", { code: error.code });
}

async function sendConfirmation(result: ConfirmResult): Promise<void> {
  if (!result.owner_id || !result.workspace_name || !result.plan_name || !result.amount_minor) return;
  const admin = createAdminClient();
  const { data: owner } = await admin.auth.admin.getUserById(result.owner_id);
  const email = owner.user?.email;
  if (!email) return;

  const locale = resolveLocale(result.owner_locale ?? "en");
  try {
    await sendPaymentConfirmationEmail({
      to: email,
      workspaceName: result.workspace_name,
      planName: result.plan_name,
      amountMinor: result.amount_minor,
      currency: result.currency ?? "XAF",
      reference: result.payment_id ?? "",
      paidAt: new Date().toISOString(),
      locale,
      billingUrl: `${appBaseUrl()}/${locale}/billing`,
    });
  } catch (error) {
    logger.warn("payments.confirmation_email_failed", { error });
  }
}

async function confirm(
  row: PaymentTransactionRow,
  providerStatus: ProviderPaymentStatus,
): Promise<PaymentTransactionRow> {
  if (providerStatus.amountMinor === undefined || !providerStatus.currency) {
    await markFailed(
      row.id,
      "provider_amount_missing",
      "The provider did not return an amount that could be verified.",
    );
    throw new AppError(
      "integration_unavailable",
      "The provider did not return a verifiable payment amount. The subscription was not activated.",
    );
  }
  if (
    providerStatus.amountMinor !== BigInt(row.amount_minor) ||
    providerStatus.currency.toUpperCase() !== row.currency.toUpperCase()
  ) {
    await markFailed(
      row.id,
      "amount_mismatch",
      "The provider amount or currency did not match the pending payment.",
    );
    throw new AppError("validation_failed", "The payment amount or currency did not match this plan.");
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("confirm_payment", {
    p_payment_id: row.id,
    p_provider_ref: providerStatus.providerReference || row.provider_ref || "",
    p_paid_at: providerStatus.paidAt ?? new Date().toISOString(),
    p_amount_minor: Number(row.amount_minor),
    p_currency: row.currency,
    p_provider_status: providerStatus.providerStatus,
    p_metadata: {
      provider_status: providerStatus.providerStatus,
      ...(providerStatus.metadata ?? {}),
    } as Json,
  });
  if (error) assertNoError(error, "The payment could not be confirmed.");

  const result = (data ?? {}) as unknown as ConfirmResult;
  if (!result.duplicate) await sendConfirmation(result);
  return reloadPayment(row.id);
}

async function reconcileProviderStatus(
  row: PaymentTransactionRow,
  providerStatus: ProviderPaymentStatus,
): Promise<PaymentTransactionRow> {
  if (providerStatus.status === "succeeded") return confirm(row, providerStatus);

  if (providerStatus.status === "failed" || providerStatus.status === "expired") {
    await markFailed(
      row.id,
      providerStatus.failureCode ?? `provider_${providerStatus.status}`,
      providerStatus.failureMessage ?? "The payment did not complete.",
      providerStatus.status === "expired" ? "expired" : "failed",
    );
    return reloadPayment(row.id);
  }

  const expiredAt = row.expires_at ? new Date(row.expires_at).getTime() : 0;
  if (expiredAt && expiredAt + PAYMENT_GRACE_MINUTES * 60_000 < Date.now()) {
    await markFailed(row.id, "expired", "The payment window expired before the provider confirmed it.", "expired");
    return reloadPayment(row.id);
  }

  const admin = createAdminClient();
  const { error } = await admin.rpc("touch_payment", {
    p_payment_id: row.id,
    p_provider_status: providerStatus.providerStatus,
  });
  if (error) logger.warn("payments.touch_failed", { code: error.code });
  return reloadPayment(row.id);
}

export async function initiateSubscriptionPayment(input: {
  workspaceId: string;
  userId: string;
  planCode: string;
  provider: PaymentProviderId;
  payerMsisdn: string | null;
  idempotencyKey: string | null;
  locale: "en" | "fr" | "pcm";
}): Promise<PaymentCheckout> {
  const admin = createAdminClient();
  const adapter = getPaymentAdapter(input.provider);
  if (!["starter", "growth", "scale"].includes(input.planCode)) {
    throw new AppError("validation_failed", "That plan is not available.");
  }

  const { data: plan, error: planError } = await admin
    .from("subscription_plans")
    .select("code, name, price_minor, currency, is_active")
    .eq("code", input.planCode as "starter" | "growth" | "scale")
    .eq("is_active", true)
    .maybeSingle();
  if (planError) assertNoError(planError, "Could not load the selected plan.");
  if (!plan) throw new AppError("not_found", "That plan is not available.");
  if (Number(plan.price_minor) <= 0) {
    throw new AppError("validation_failed", "This plan does not require a mobile money payment.");
  }
  if (plan.currency.toUpperCase() !== "XAF") {
    throw new AppError("integration_unavailable", "MTN and Orange Money payments currently support XAF plans only.");
  }

  const payer = normalizeMsisdn(input.payerMsisdn);
  if (input.provider === "mtn_momo" && !payer) {
    throw new AppError("validation_failed", "Enter a valid MTN Mobile Money number (for example 6 71 23 45 67).");
  }
  if (input.provider === "orange_money" && input.payerMsisdn && !payer) {
    throw new AppError("validation_failed", "Enter a valid Orange Money number (for example 6 91 23 45 67).");
  }

  const merchantReference = `KF-${randomUUID().replace(/-/g, "")}`;
  const webhookToken = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + PAYMENT_EXPIRY_MINUTES * 60_000).toISOString();
  const locale = input.locale;
  const callbackUrl = `${appBaseUrl()}/api/webhooks/payments/${input.provider}?payment=${encodeURIComponent(merchantReference)}&token=${encodeURIComponent(webhookToken)}`;

  const { data, error } = await admin.rpc("create_payment_intent", {
    p_workspace_id: input.workspaceId,
    p_plan_code: plan.code,
    p_provider: input.provider,
    p_payer_msisdn: payer,
    p_idempotency_key: input.idempotencyKey,
    p_merchant_reference: merchantReference,
    p_webhook_token_hash: hashWebhookToken(webhookToken),
    p_actor_id: input.userId,
    p_expires_at: expiresAt,
  });
  if (error) assertNoError(error, "Could not create this payment.");

  const intent = (data ?? {}) as unknown as CreateIntentResult;
  if (intent.reused) {
    return {
      paymentId: intent.payment_id,
      merchantReference: intent.merchant_reference,
      provider: input.provider,
      planCode: intent.plan_code,
      amountMinor: Number(intent.amount_minor),
      currency: intent.currency,
      status: intent.status,
      checkoutUrl: ["pending", "processing"].includes(intent.status) ? intent.checkout_url : null,
      instructions: null,
      expiresAt: intent.expires_at,
    };
  }

  const returnUrl = `${appBaseUrl()}/${locale}/billing?payment=${encodeURIComponent(intent.payment_id)}`;

  try {
    const result = await adapter.initiate({
      merchantReference,
      workspaceId: input.workspaceId,
      planCode: input.planCode,
      amountMinor: BigInt(plan.price_minor),
      currency: plan.currency,
      payerMsisdn: payer,
      description: `KontaFlow ${plan.name} subscription`,
      returnUrl,
      cancelUrl: returnUrl,
      callbackUrl,
      locale,
    });

    const metadata: Record<string, string | null> = { ...(result.metadata ?? {}) };
    if (result.webhookToken) {
      metadata.provider_webhook_token_hash = hashWebhookToken(result.webhookToken);
    }
    const initiated = await admin.rpc("mark_payment_initiated", {
      p_payment_id: intent.payment_id,
      p_provider_ref: result.providerReference,
      p_checkout_url: result.checkoutUrl,
      p_provider_status: result.providerStatus,
      p_metadata: metadata as Json,
    });
    if (initiated.error) {
      logger.error("payments.mark_initiated_failed", { code: initiated.error.code, paymentId: intent.payment_id });
    }

    if (result.status === "succeeded") {
      const settled = await confirm(await reloadPayment(intent.payment_id), {
        status: "succeeded",
        providerReference: result.providerReference,
        providerStatus: result.providerStatus,
        amountMinor: BigInt(plan.price_minor),
        currency: plan.currency,
        paidAt: new Date().toISOString(),
      });
      return {
        paymentId: intent.payment_id,
        merchantReference,
        provider: input.provider,
        planCode: input.planCode,
        amountMinor: Number(plan.price_minor),
        currency: plan.currency,
        status: settled.status,
        checkoutUrl: null,
        instructions: result.instructions,
        expiresAt,
      };
    }

    return {
      paymentId: intent.payment_id,
      merchantReference,
      provider: input.provider,
      planCode: input.planCode,
      amountMinor: Number(plan.price_minor),
      currency: plan.currency,
      status: "processing",
      checkoutUrl: result.checkoutUrl,
      instructions: result.instructions,
      expiresAt,
    };
  } catch (error) {
    const appError = isAppError(error)
      ? error
      : new AppError("integration_unavailable", "The payment provider could not start this payment.");
    await markFailed(intent.payment_id, appError.code, appError.publicMessage);
    throw appError;
  }
}

export async function refreshPaymentStatus(
  paymentId: string,
  workspaceId: string,
): Promise<PaymentPublicStatus> {
  const row = await loadPayment(paymentId, workspaceId);
  if (["succeeded", "failed", "expired", "refunded", "reversed"].includes(row.status)) {
    return publicStatus(row);
  }
  if (!row.provider_ref) return publicStatus(row);
  if (row.last_checked_at && Date.now() - new Date(row.last_checked_at).getTime() < STATUS_REFRESH_MS) {
    return publicStatus(row);
  }

  try {
    const adapter = getPaymentAdapter(parseProvider(row.provider));
    const providerStatus = await adapter.fetchStatus({
      merchantReference: row.merchant_reference,
      providerReference: row.provider_ref,
      amountMinor: BigInt(row.amount_minor),
      currency: row.currency,
      payerMsisdn: row.payer_msisdn,
      metadata: (row.metadata ?? {}) as Record<string, unknown>,
    });
    return publicStatus(await reconcileProviderStatus(row, providerStatus));
  } catch (error) {
    logger.warn("payments.status_refresh_failed", { paymentId, error });
    const latest = await loadPayment(paymentId, workspaceId).catch(() => null);
    return publicStatus(latest ?? row);
  }
}

export async function getPaymentWebhookContext(
  provider: PaymentProviderId,
  merchantReference: string,
): Promise<{
  paymentId: string;
  workspaceId: string;
  merchantReference: string;
  providerReference: string | null;
  webhookTokenHash: string | null;
  metadata: Record<string, unknown>;
} | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("payment_transactions")
    .select("id, workspace_id, merchant_reference, provider_ref, webhook_token_hash, metadata")
    .eq("merchant_reference", merchantReference)
    .eq("provider", provider)
    .maybeSingle();
  if (error) assertNoError(error, "Could not load the payment for this callback.");
  if (!data) return null;
  return {
    paymentId: data.id,
    workspaceId: data.workspace_id,
    merchantReference: data.merchant_reference,
    providerReference: data.provider_ref,
    webhookTokenHash: data.webhook_token_hash,
    metadata: (data.metadata ?? {}) as Record<string, unknown>,
  };
}

export async function processPaymentWebhook(
  provider: PaymentProviderId,
  event: {
    merchantReference: string;
    providerReference: string | null;
    amountMinor: bigint | null;
    currency: string | null;
  },
): Promise<WebhookResult> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("payment_transactions")
    .select("*")
    .eq("merchant_reference", event.merchantReference)
    .eq("provider", provider)
    .maybeSingle();
  if (error) throw assertNoError(error, "Could not load the payment for this callback.");
  if (!data) return { status: "ignored", reason: "payment_not_found" };

  const row = data as PaymentTransactionRow;
  if (row.provider_ref && event.providerReference && row.provider_ref !== event.providerReference) {
    return { status: "ignored", reason: "provider_reference_mismatch" };
  }
  // A callback is a hint, not proof. Never fail a payment from an unsigned
  // callback field; the authoritative status fetch below decides.
  if (event.amountMinor !== null && event.amountMinor !== BigInt(row.amount_minor)) {
    return { status: "ignored", paymentId: row.id, reason: "amount_mismatch" };
  }
  if (event.currency && event.currency.toUpperCase() !== row.currency.toUpperCase()) {
    return { status: "ignored", paymentId: row.id, reason: "currency_mismatch" };
  }
  if (row.status === "succeeded" || row.status === "refunded" || row.status === "reversed") {
    return { status: "processed", paymentId: row.id };
  }

  const providerReference = row.provider_ref ?? event.providerReference;
  if (!providerReference) return { status: "ignored", reason: "missing_provider_reference" };

  try {
    const adapter = getPaymentAdapter(provider);
    const providerStatus = await adapter.fetchStatus({
      merchantReference: row.merchant_reference,
      providerReference,
      amountMinor: BigInt(row.amount_minor),
      currency: row.currency,
      payerMsisdn: row.payer_msisdn,
      metadata: (row.metadata ?? {}) as Record<string, unknown>,
    });
    await reconcileProviderStatus(row, providerStatus);
    return { status: "processed", paymentId: row.id };
  } catch (error) {
    logger.warn("payments.webhook_reconcile_failed", { paymentId: row.id, error });
    return { status: "retry", paymentId: row.id, reason: "provider_status_unavailable" };
  }
}

export async function reconcilePendingPayments(limit = 100): Promise<{
  processed: number;
  confirmed: number;
  failed: number;
  skipped: number;
}> {
  const admin = createAdminClient();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await admin
    .from("payment_transactions")
    .select("*")
    .in("status", ["pending", "processing"])
    .gte("created_at", sevenDaysAgo)
    .order("created_at", { ascending: true })
    .limit(Math.min(Math.max(limit, 1), 200));
  if (error) throw assertNoError(error, "Could not load pending payments.");

  let confirmed = 0;
  let failed = 0;
  let skipped = 0;
  const rows = (data ?? []) as PaymentTransactionRow[];

  const reconcileOne = async (row: PaymentTransactionRow): Promise<"confirmed" | "failed" | "skipped"> => {
    if (!row.provider_ref) {
      const age = Date.now() - new Date(row.created_at).getTime();
      if (age > 60 * 60 * 1000) {
        await markFailed(row.id, "initiation_abandoned", "The payment provider was never reached.", "expired");
        return "failed";
      }
      return "skipped";
    }
    try {
      const adapter = getPaymentAdapter(parseProvider(row.provider));
      const providerStatus = await adapter.fetchStatus({
        merchantReference: row.merchant_reference,
        providerReference: row.provider_ref,
        amountMinor: BigInt(row.amount_minor),
        currency: row.currency,
        payerMsisdn: row.payer_msisdn,
        metadata: (row.metadata ?? {}) as Record<string, unknown>,
      });
      const updated = await reconcileProviderStatus(row, providerStatus);
      if (updated.status === "succeeded") return "confirmed";
      if (updated.status === "failed" || updated.status === "expired") return "failed";
      return "skipped";
    } catch (error) {
      logger.warn("payments.reconcile_failed", { paymentId: row.id, error });
      const expiredAt = row.expires_at ? new Date(row.expires_at).getTime() : 0;
      if (expiredAt && expiredAt + PAYMENT_GRACE_MINUTES * 60_000 < Date.now()) {
        await markFailed(row.id, "expired", "The payment window expired before the provider confirmed it.", "expired");
        return "failed";
      }
      return "skipped";
    }
  };

  // Bounded concurrency keeps a cron run inside the platform timeout while
  // still draining a backlog in a few passes.
  const BATCH_SIZE = 5;
  for (let index = 0; index < rows.length; index += BATCH_SIZE) {
    const results = await Promise.all(rows.slice(index, index + BATCH_SIZE).map(reconcileOne));
    for (const result of results) {
      if (result === "confirmed") confirmed += 1;
      else if (result === "failed") failed += 1;
      else skipped += 1;
    }
  }

  return { processed: rows.length, confirmed, failed, skipped };
}

export async function refundSubscriptionPayment(input: {
  paymentId: string;
  workspaceId: string;
  actorId: string;
  amountMinor: bigint;
  reason: string;
  kind: "refund" | "reversal";
}): Promise<{ status: string; refundedAmountMinor: number; full: boolean }> {
  const row = await loadPayment(input.paymentId, input.workspaceId);
  if (row.status !== "succeeded") {
    throw new AppError("conflict", "Only a successful payment can be refunded.");
  }
  if (!row.provider_ref) throw new AppError("conflict", "This payment has no provider reference.");

  let providerRef = row.provider_ref;
  if (input.kind === "refund") {
    const adapter = getPaymentAdapter(parseProvider(row.provider));
    const result = await adapter.refund({
      merchantReference: row.merchant_reference,
      providerReference: row.provider_ref,
      amountMinor: input.amountMinor,
      currency: row.currency,
      reason: input.reason,
    });
    if (!result.supported) {
      throw new AppError("integration_unavailable", result.reason);
    }
    providerRef = result.providerReference ?? providerRef;
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("refund_payment", {
    p_payment_id: row.id,
    p_amount_minor: Number(input.amountMinor),
    p_provider_ref: providerRef,
    p_reason: input.reason,
    p_actor_id: input.actorId,
    p_kind: input.kind,
  });
  if (error) assertNoError(error, "The refund could not be recorded.");
  const result = (data ?? {}) as { status?: string; refunded_amount_minor?: number; full?: boolean };
  return {
    status: result.status ?? "refunded",
    refundedAmountMinor: Number(result.refunded_amount_minor ?? input.amountMinor),
    full: Boolean(result.full),
  };
}

export async function listPaymentHistory(workspaceId: string): Promise<PaymentHistoryItem[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("payment_transactions")
    .select(
      "id, provider, merchant_reference, plan_code, amount_minor, currency, status, paid_at, failure_code, failure_message, created_at",
    )
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) assertNoError(error, "Could not load payment history.");
  return (data ?? []) as PaymentHistoryItem[];
}
