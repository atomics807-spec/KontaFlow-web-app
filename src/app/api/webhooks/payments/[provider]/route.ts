import { NextResponse } from "next/server";
import { getServerEnv } from "@/lib/env";
import { hasServiceRole, createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger";
import { consumeRateLimitDetailed, rateLimitHeaders } from "@/lib/security/durable-rate-limit";
import { getPaymentAdapter } from "@/lib/payments/registry";
import { isPaymentProvider, type PaymentProviderId } from "@/lib/payments/types";
import { sha256Hex } from "@/lib/payments/signature";
import { logSecurityEvent } from "@/lib/security/events";
import {
  getPaymentWebhookContext,
  processPaymentWebhook,
} from "@/services/payments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 512 * 1024;

type Context = { params: Promise<{ provider: string }> };

function clientKey(request: Request, provider: string): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return `payment-webhook:${provider}:${forwarded ?? "unknown"}`;
}

async function handle(request: Request, context: Context): Promise<Response> {
  const { provider: rawProvider } = await context.params;
  if (!isPaymentProvider(rawProvider)) {
    return new Response("Not found", { status: 404 });
  }
  const provider: PaymentProviderId = rawProvider;

  const webhookLimit = await consumeRateLimitDetailed(
    clientKey(request, provider),
    getServerEnv().RATE_LIMIT_WEBHOOK_PER_MINUTE,
    60,
  );
  if (!webhookLimit.allowed) {
    return new Response("Too many requests", { status: 429, headers: rateLimitHeaders(webhookLimit) });
  }

  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return new Response("Payload too large", { status: 413 });
  }

  const rawBody = await request.text();
  if (Buffer.byteLength(rawBody, "utf8") > MAX_BODY_BYTES) {
    return new Response("Payload too large", { status: 413 });
  }

  let adapter;
  try {
    adapter = getPaymentAdapter(provider);
  } catch {
    logger.warn("payments.webhook_provider_not_configured", { provider });
    return new Response("Not configured", { status: 503 });
  }

  let event;
  try {
    event = adapter.parseWebhook({ rawBody, headers: request.headers, url: new URL(request.url) });
  } catch (error) {
    logger.warn("payments.webhook_invalid_payload", { provider, error });
    return new Response("Bad payload", { status: 400 });
  }

  if (!hasServiceRole()) {
    logger.error("payments.webhook_service_role_missing");
    return new Response("Not configured", { status: 503 });
  }

  let payment;
  try {
    payment = await getPaymentWebhookContext(provider, event.merchantReference);
  } catch (error) {
    logger.error("payments.webhook_lookup_failed", { provider, error });
    return new Response("Retry", { status: 500 });
  }

  const verification = adapter.verifyWebhook({
    rawBody,
    headers: request.headers,
    url: new URL(request.url),
    payment: payment
      ? {
          merchantReference: payment.merchantReference,
          providerReference: payment.providerReference,
          webhookTokenHash: payment.webhookTokenHash,
          metadata: payment.metadata,
        }
      : null,
  });
  if (!verification.valid) {
    logger.warn("payments.webhook_auth_failed", { provider, reason: verification.reason });
    await logSecurityEvent({
      type: "payments.webhook_auth_failed",
      workspaceId: payment?.workspaceId ?? null,
      severity: "critical",
      metadata: { provider, reason: verification.reason },
    });
    return new Response("Forbidden", { status: 401, headers: { "cache-control": "no-store" } });
  }

  const admin = createAdminClient();
  const payload = {
    eventId: event.eventId,
    eventType: event.eventType,
    merchantReference: event.merchantReference,
    providerReference: event.providerReference,
    providerStatus: event.providerStatus,
    amountMinor: event.amountMinor?.toString() ?? null,
    currency: event.currency,
    status: event.status,
  };

  const inserted = await admin
    .from("payment_webhooks")
    .insert({
      provider,
      external_event_id: event.eventId.slice(0, 200),
      event_type: event.eventType.slice(0, 80),
      workspace_id: payment?.workspaceId ?? null,
      payment_transaction_id: payment?.paymentId ?? null,
      payload,
      signature_ok: true,
      status: "received",
      payload_hash: sha256Hex(rawBody),
      verified_at: new Date().toISOString(),
    })
    .select("id, status")
    .maybeSingle();

  let webhookRow = inserted.data;
  if (inserted.error) {
    if (inserted.error.code !== "23505") {
      logger.error("payments.webhook_store_failed", { code: inserted.error.code });
      return new Response("Retry", { status: 500 });
    }
    const { data: existing } = await admin
      .from("payment_webhooks")
      .select("id, status")
      .eq("provider", provider)
      .eq("external_event_id", event.eventId.slice(0, 200))
      .maybeSingle();
    if (!existing) return new Response("Retry", { status: 500 });
    if (existing.status === "processed" || existing.status === "ignored") {
      return new Response("OK", { status: 200, headers: { "cache-control": "no-store" } });
    }
    webhookRow = existing;
    await admin
      .from("payment_webhooks")
      .update({ status: "received", attempts: 1, last_error: null })
      .eq("id", existing.id);
  }

  if (!payment) {
    if (webhookRow?.id) {
      await admin
        .from("payment_webhooks")
        .update({ status: "ignored", error: "payment_not_found", processed_at: new Date().toISOString() })
        .eq("id", webhookRow.id);
    }
    return new Response("OK", { status: 200, headers: { "cache-control": "no-store" } });
  }

  try {
    const result = await processPaymentWebhook(provider, {
      merchantReference: event.merchantReference,
      providerReference: event.providerReference,
      amountMinor: event.amountMinor,
      currency: event.currency,
    });

    if (webhookRow?.id) {
      await admin
        .from("payment_webhooks")
        .update({
          status: result.status === "retry" ? "failed" : result.status === "ignored" ? "ignored" : "processed",
          error: result.status === "retry" ? "provider_status_unavailable" : result.reason ?? null,
          processed_at: result.status === "retry" ? null : new Date().toISOString(),
        })
        .eq("id", webhookRow.id);
    }

    if (result.status === "retry") {
      return new Response("Retry", { status: 500, headers: { "cache-control": "no-store" } });
    }
    return new Response("OK", { status: 200, headers: { "cache-control": "no-store" } });
  } catch (error) {
    logger.error("payments.webhook_processing_failed", { provider, error });
    if (webhookRow?.id) {
      await admin
        .from("payment_webhooks")
        .update({ status: "failed", error: "processing_failed", attempts: 1 })
        .eq("id", webhookRow.id);
    }
    return new Response("Retry", { status: 500, headers: { "cache-control": "no-store" } });
  }
}

export async function POST(request: Request, context: Context) {
  return handle(request, context);
}

export async function PUT(request: Request, context: Context) {
  return handle(request, context);
}

export async function GET() {
  return NextResponse.json({ error: "method_not_allowed" }, { status: 405 });
}
