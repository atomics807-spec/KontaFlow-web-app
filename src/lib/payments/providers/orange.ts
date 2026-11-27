import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { orangeConfig } from "../config";
import { parseProviderAmount, providerAmountString } from "../amounts";
import { basicAuth, providerFetch, stringField } from "../http";
import { hashWebhookToken, verifyHmacSignature, verifyWebhookTokenHash } from "../signature";
import type {
  InitiatePaymentInput,
  InitiatePaymentResult,
  ParsedPaymentWebhook,
  PaymentAdapter,
  PaymentStatusInput,
  ProviderPaymentStatus,
  RefundPaymentResult,
  WebhookParseInput,
  WebhookVerificationInput,
} from "../types";

type OrangeConfig = NonNullable<ReturnType<typeof orangeConfig>>;

function mapStatus(value: string | null): ProviderPaymentStatus["status"] {
  switch ((value ?? "").toUpperCase()) {
    case "SUCCESSFUL":
    case "SUCCESS":
    case "PAID":
      return "succeeded";
    case "FAILED":
    case "REJECTED":
    case "CANCELLED":
    case "CANCELED":
      return "failed";
    case "EXPIRED":
      return "expired";
    case "PENDING":
    case "INITIATED":
    case "PROCESSING":
      return "pending";
    default:
      return "unknown";
  }
}

async function accessToken(config: OrangeConfig): Promise<string> {
  const response = await providerFetch(`${config.baseUrl}/oauth/v3/token`, {
    method: "POST",
    headers: {
      Authorization: basicAuth(config.clientId, config.clientSecret),
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: "grant_type=client_credentials",
  });
  const token = stringField(response.json?.access_token);
  if (!response.ok || !token) {
    logger.warn("payments.orange.token_failed", { status: response.status });
    throw new AppError("integration_unavailable", "Orange Money could not authorise the payment request.");
  }
  return token;
}

function jsonHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

export class OrangeMoneyAdapter implements PaymentAdapter {
  readonly id = "orange_money" as const;
  readonly label = "Orange Money";

  isConfigured(): boolean {
    return Boolean(orangeConfig());
  }

  async initiate(input: InitiatePaymentInput): Promise<InitiatePaymentResult> {
    const config = orangeConfig();
    if (!config) {
      throw new AppError("configuration_missing", "Orange Money is not configured on this deployment.");
    }

    const token = await accessToken(config);
    const response = await providerFetch(`${config.baseUrl}${config.webpayPath}`, {
      method: "POST",
      headers: jsonHeaders(token),
      body: JSON.stringify({
        merchant_key: config.merchantKey,
        currency: input.currency.toUpperCase(),
        order_id: input.merchantReference,
        amount: Number(providerAmountString(input.amountMinor, input.currency)),
        return_url: input.returnUrl,
        cancel_url: input.cancelUrl,
        notif_url: input.callbackUrl,
        lang: input.locale === "fr" ? "fr" : config.lang,
        reference: input.merchantReference,
      }),
    });

    if (!response.ok) {
      logger.warn("payments.orange.initiate_failed", { status: response.status });
      throw new AppError(
        "integration_unavailable",
        "Orange Money could not start this payment. No money was taken; try again or use another method.",
      );
    }

    const checkoutUrl = stringField(response.json?.payment_url);
    const providerReference = stringField(response.json?.pay_token);
    const notifToken = stringField(response.json?.notif_token);
    if (!checkoutUrl || !providerReference) {
      logger.warn("payments.orange.invalid_response", { status: response.status });
      throw new AppError("integration_unavailable", "Orange Money returned an incomplete payment response.");
    }

    return {
      providerReference,
      status: "processing",
      providerStatus: stringField(response.json?.status) ?? "INITIATED",
      checkoutUrl,
      instructions: null,
      webhookToken: notifToken,
      metadata: {
        orange_order_id: input.merchantReference,
        orange_notif_token_hash: notifToken ? hashWebhookToken(notifToken) : null,
      },
    };
  }

  async fetchStatus(input: PaymentStatusInput): Promise<ProviderPaymentStatus> {
    const config = orangeConfig();
    if (!config) {
      throw new AppError("configuration_missing", "Orange Money is not configured on this deployment.");
    }
    const token = await accessToken(config);
    const response = await providerFetch(`${config.baseUrl}${config.statusPath}`, {
      method: "POST",
      headers: jsonHeaders(token),
      body: JSON.stringify({
        order_id: input.merchantReference,
        amount: Number(providerAmountString(input.amountMinor, input.currency)),
        pay_token: input.providerReference,
      }),
    });

    if (response.status === 404) {
      return {
        status: "pending",
        providerReference: input.providerReference,
        providerStatus: "NOT_FOUND",
      };
    }
    if (!response.ok) {
      logger.warn("payments.orange.status_failed", { status: response.status });
      throw new AppError("integration_unavailable", "Orange Money status could not be checked.");
    }

    const providerStatus = stringField(response.json?.status)?.toUpperCase() ?? "UNKNOWN";
    const status = mapStatus(providerStatus);
    const currency = stringField(response.json?.currency)?.toUpperCase() ?? input.currency;
    let amountMinor: bigint | undefined;
    try {
      amountMinor = parseProviderAmount(response.json?.amount, currency) ?? undefined;
    } catch {
      amountMinor = undefined;
    }

    return {
      status,
      providerReference: input.providerReference,
      providerStatus,
      amountMinor,
      currency,
      paidAt: status === "succeeded" ? new Date().toISOString() : null,
      failureCode: status === "failed" ? "orange_failed" : null,
      failureMessage: stringField(response.json?.message),
      metadata: {
        orange_txnid: stringField(response.json?.txnid),
      },
    };
  }

  verifyWebhook(input: WebhookVerificationInput): { valid: boolean; reason?: string } {
    const config = orangeConfig();
    if (!config) return { valid: false, reason: "not_configured" };

    let body: Record<string, unknown> | null = null;
    try {
      body = JSON.parse(input.rawBody) as Record<string, unknown>;
    } catch {
      body = null;
    }

    const candidates = [
      input.url.searchParams.get("token"),
      body ? stringField(body.notif_token) : null,
    ].filter((value): value is string => Boolean(value));
    const hashes = [
      input.payment?.webhookTokenHash ?? null,
      typeof input.payment?.metadata.orange_notif_token_hash === "string"
        ? input.payment.metadata.orange_notif_token_hash
        : null,
    ].filter((value): value is string => Boolean(value));

    const tokenOk = candidates.some((candidate) => hashes.some((hash) => verifyWebhookTokenHash(candidate, hash)));
    if (!tokenOk) return { valid: false, reason: "callback_token" };

    if (config.webhookSecret) {
      const signature = input.headers.get(config.signatureHeader);
      if (!verifyHmacSignature(input.rawBody, signature, config.webhookSecret)) {
        return { valid: false, reason: "signature" };
      }
    }
    return { valid: true };
  }

  parseWebhook(input: WebhookParseInput): ParsedPaymentWebhook {
    let body: Record<string, unknown>;
    try {
      body = JSON.parse(input.rawBody) as Record<string, unknown>;
    } catch {
      throw new AppError("validation_failed", "Invalid Orange Money callback.");
    }

    const merchantReference = stringField(body.order_id) ?? stringField(body.reference);
    if (!merchantReference) {
      throw new AppError("validation_failed", "Orange Money callback is missing an order reference.");
    }
    const providerStatus = stringField(body.status)?.toUpperCase() ?? "UNKNOWN";
    const status = mapStatus(providerStatus);
    const currency = stringField(body.currency)?.toUpperCase() ?? null;
    let amountMinor: bigint | null = null;
    try {
      amountMinor = currency ? parseProviderAmount(body.amount, currency) : null;
    } catch {
      amountMinor = null;
    }
    const providerReference = stringField(body.pay_token) ?? stringField(body.txnid);

    return {
      eventId: `${merchantReference}:${providerStatus}:${stringField(body.txnid) ?? ""}`,
      eventType: "webpayment.status",
      merchantReference,
      providerReference,
      status,
      providerStatus,
      amountMinor,
      currency,
      paidAt: status === "succeeded" ? new Date().toISOString() : null,
      failureCode: status === "failed" ? "orange_failed" : null,
      failureMessage: stringField(body.message),
    };
  }

  async refund(): Promise<RefundPaymentResult> {
    return {
      supported: false,
      reason: "Orange Money Web Payment does not expose an automatic refund operation for this merchant account.",
    };
  }
}
