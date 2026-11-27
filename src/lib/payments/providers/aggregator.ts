import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { aggregatorConfig } from "../config";
import { parseProviderAmount, providerAmountString } from "../amounts";
import { providerFetch, stringField } from "../http";
import { sha256Hex, verifyHmacSignature } from "../signature";
import type {
  InitiatePaymentInput,
  InitiatePaymentResult,
  ParsedPaymentWebhook,
  PaymentAdapter,
  PaymentStatusInput,
  ProviderPaymentStatus,
  RefundPaymentInput,
  RefundPaymentResult,
  WebhookParseInput,
  WebhookVerificationInput,
} from "../types";

type AggregatorConfig = NonNullable<ReturnType<typeof aggregatorConfig>>;

function mapStatus(value: string | null): ProviderPaymentStatus["status"] {
  switch ((value ?? "").toLowerCase()) {
    case "successful":
    case "success":
    case "succeeded":
    case "paid":
      return "succeeded";
    case "failed":
    case "rejected":
    case "cancelled":
    case "canceled":
      return "failed";
    case "expired":
      return "expired";
    case "pending":
    case "processing":
    case "initiated":
      return "pending";
    default:
      return "unknown";
  }
}

function pathWithId(path: string, id: string): string {
  return path.replace("{id}", encodeURIComponent(id));
}

export class AggregatorAdapter implements PaymentAdapter {
  readonly id = "aggregator" as const;
  readonly label = "Mobile money";

  isConfigured(): boolean {
    return Boolean(aggregatorConfig());
  }

  private headers(config: AggregatorConfig): HeadersInit {
    return {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    };
  }

  async initiate(input: InitiatePaymentInput): Promise<InitiatePaymentResult> {
    const config = aggregatorConfig();
    if (!config) {
      throw new AppError("configuration_missing", "Mobile money payments are not configured on this deployment.");
    }

    const response = await providerFetch(`${config.baseUrl}${config.createPath}`, {
      method: "POST",
      headers: this.headers(config),
      body: JSON.stringify({
        amount: Number(providerAmountString(input.amountMinor, input.currency)),
        currency: input.currency.toUpperCase(),
        reference: input.merchantReference,
        phone: input.payerMsisdn,
        callback_url: input.callbackUrl,
        return_url: input.returnUrl,
        description: input.description,
      }),
    });

    if (!response.ok) {
      logger.warn("payments.aggregator.initiate_failed", { status: response.status });
      throw new AppError(
        "integration_unavailable",
        "The mobile money provider could not start this payment. No money was taken; try again.",
      );
    }

    const providerReference = stringField(response.json?.id) ?? stringField(response.json?.reference);
    if (!providerReference) {
      throw new AppError("integration_unavailable", "The mobile money provider returned an incomplete response.");
    }

    return {
      providerReference,
      status: "processing",
      providerStatus: stringField(response.json?.status) ?? "PENDING",
      checkoutUrl: stringField(response.json?.checkout_url),
      instructions: stringField(response.json?.instructions),
      metadata: {},
    };
  }

  async fetchStatus(input: PaymentStatusInput): Promise<ProviderPaymentStatus> {
    const config = aggregatorConfig();
    if (!config) {
      throw new AppError("configuration_missing", "Mobile money payments are not configured on this deployment.");
    }
    const response = await providerFetch(
      `${config.baseUrl}${pathWithId(config.statusPath, input.providerReference)}`,
      { headers: this.headers(config) },
    );

    if (response.status === 404) {
      return {
        status: "pending",
        providerReference: input.providerReference,
        providerStatus: "NOT_FOUND",
      };
    }
    if (!response.ok) {
      logger.warn("payments.aggregator.status_failed", { status: response.status });
      throw new AppError("integration_unavailable", "The mobile money status could not be checked.");
    }

    const providerStatus = stringField(response.json?.status) ?? "UNKNOWN";
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
      // The status lookup is keyed by the stored reference; keep it stable even
      // when the aggregator adds a separate transaction id.
      providerReference: input.providerReference,
      providerStatus,
      amountMinor,
      currency,
      paidAt: status === "succeeded" ? new Date().toISOString() : null,
      failureCode: status === "failed" ? "aggregator_failed" : null,
      failureMessage: stringField(response.json?.message),
      metadata: {
        aggregator_reference: stringField(response.json?.id),
      },
    };
  }

  verifyWebhook(input: WebhookVerificationInput): { valid: boolean; reason?: string } {
    const config = aggregatorConfig();
    if (!config) return { valid: false, reason: "not_configured" };
    const signature = input.headers.get(config.signatureHeader);
    return verifyHmacSignature(input.rawBody, signature, config.webhookSecret)
      ? { valid: true }
      : { valid: false, reason: "signature" };
  }

  parseWebhook(input: WebhookParseInput): ParsedPaymentWebhook {
    let body: Record<string, unknown>;
    try {
      body = JSON.parse(input.rawBody) as Record<string, unknown>;
    } catch {
      throw new AppError("validation_failed", "Invalid mobile money callback.");
    }
    const data =
      body.data && typeof body.data === "object" && !Array.isArray(body.data)
        ? (body.data as Record<string, unknown>)
        : body;

    const merchantReference = stringField(data.reference) ?? stringField(body.reference);
    if (!merchantReference) {
      throw new AppError("validation_failed", "Mobile money callback is missing a payment reference.");
    }
    const providerStatus = stringField(data.status)?.toUpperCase() ?? "UNKNOWN";
    const status = mapStatus(providerStatus);
    const currency = stringField(data.currency)?.toUpperCase() ?? null;
    let amountMinor: bigint | null = null;
    try {
      amountMinor = currency ? parseProviderAmount(data.amount, currency) : null;
    } catch {
      amountMinor = null;
    }

    return {
      eventId:
        stringField(body.event_id) ??
        stringField(body.id) ??
        sha256Hex(input.rawBody),
      eventType: stringField(body.type) ?? "payment.status",
      merchantReference,
      providerReference: stringField(data.provider_reference) ?? stringField(data.id),
      status,
      providerStatus,
      amountMinor,
      currency,
      paidAt: status === "succeeded" ? new Date().toISOString() : null,
      failureCode: status === "failed" ? "aggregator_failed" : null,
      failureMessage: stringField(data.message),
    };
  }

  async refund(input: RefundPaymentInput): Promise<RefundPaymentResult> {
    const config = aggregatorConfig();
    if (!config?.refundPath) {
      return { supported: false, reason: "The configured aggregator does not expose refunds." };
    }
    const response = await providerFetch(`${config.baseUrl}${config.refundPath}`, {
      method: "POST",
      headers: this.headers(config),
      body: JSON.stringify({
        reference: input.merchantReference,
        provider_reference: input.providerReference,
        amount: Number(providerAmountString(input.amountMinor, input.currency)),
        currency: input.currency.toUpperCase(),
        reason: input.reason,
      }),
    });
    if (!response.ok) {
      logger.warn("payments.aggregator.refund_failed", { status: response.status });
      throw new AppError("integration_unavailable", "The mobile money refund could not be completed.");
    }
    return {
      supported: true,
      providerReference: stringField(response.json?.id) ?? null,
      providerStatus: stringField(response.json?.status) ?? "SUBMITTED",
    };
  }
}
