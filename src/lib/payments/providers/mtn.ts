import { randomUUID } from "node:crypto";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { mtnConfig } from "../config";
import { providerAmountString, parseProviderAmount } from "../amounts";
import { basicAuth, providerFetch, stringField } from "../http";
import { verifyHmacSignature, verifyWebhookTokenHash } from "../signature";
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

type MtnConfig = NonNullable<ReturnType<typeof mtnConfig>>;

function mapStatus(value: string | null): ProviderPaymentStatus["status"] {
  switch ((value ?? "").toUpperCase()) {
    case "SUCCESSFUL":
    case "SUCCESS":
      return "succeeded";
    case "FAILED":
    case "REJECTED":
      return "failed";
    case "PENDING":
      return "pending";
    default:
      return "unknown";
  }
}

async function accessToken(config: MtnConfig): Promise<string> {
  const response = await providerFetch(`${config.baseUrl}/collection/token/`, {
    method: "POST",
    headers: {
      Authorization: basicAuth(config.apiUserId, config.apiKey),
      "Ocp-Apim-Subscription-Key": config.subscriptionKey,
    },
  });
  const token = stringField(response.json?.access_token);
  if (!response.ok || !token) {
    logger.warn("payments.mtn.token_failed", { status: response.status });
    throw new AppError("integration_unavailable", "MTN Mobile Money could not authorise the payment request.");
  }
  return token;
}

function requestHeaders(config: MtnConfig, token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    "Ocp-Apim-Subscription-Key": config.subscriptionKey,
    "X-Target-Environment": config.targetEnvironment,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

export class MtnMomoAdapter implements PaymentAdapter {
  readonly id = "mtn_momo" as const;
  readonly label = "MTN Mobile Money";

  isConfigured(): boolean {
    return Boolean(mtnConfig());
  }

  async initiate(input: InitiatePaymentInput): Promise<InitiatePaymentResult> {
    const config = mtnConfig();
    if (!config) {
      throw new AppError("configuration_missing", "MTN Mobile Money is not configured on this deployment.");
    }
    if (!input.payerMsisdn) {
      throw new AppError("validation_failed", "Enter the MTN Mobile Money phone number that will approve this payment.");
    }

    const providerReference = randomUUID();
    const token = await accessToken(config);
    const response = await providerFetch(`${config.baseUrl}/collection/v1_0/requesttopay`, {
      method: "POST",
      headers: {
        ...requestHeaders(config, token),
        "X-Reference-Id": providerReference,
        "X-Callback-Url": input.callbackUrl,
      },
      body: JSON.stringify({
        amount: providerAmountString(input.amountMinor, input.currency),
        currency: input.currency.toUpperCase(),
        externalId: input.merchantReference,
        payer: { partyIdType: "MSISDN", partyId: input.payerMsisdn },
        payerMessage: input.description.slice(0, 50),
        payeeNote: "KontaFlow subscription",
      }),
    });

    if (response.status !== 202 && response.status !== 200) {
      logger.warn("payments.mtn.initiate_failed", { status: response.status });
      throw new AppError(
        "integration_unavailable",
        "MTN Mobile Money could not start this payment. No money was taken; try again or use another method.",
      );
    }

    return {
      providerReference,
      status: "processing",
      providerStatus: "PENDING",
      checkoutUrl: null,
      instructions: "Approve the MTN Mobile Money prompt on the phone number you entered.",
      metadata: { mtn_reference_id: providerReference },
    };
  }

  async fetchStatus(input: PaymentStatusInput): Promise<ProviderPaymentStatus> {
    const config = mtnConfig();
    if (!config) {
      throw new AppError("configuration_missing", "MTN Mobile Money is not configured on this deployment.");
    }
    const token = await accessToken(config);
    const response = await providerFetch(
      `${config.baseUrl}/collection/v1_0/requesttopay/${encodeURIComponent(input.providerReference)}`,
      { headers: requestHeaders(config, token) },
    );

    if (response.status === 404) {
      return {
        status: "pending",
        providerReference: input.providerReference,
        providerStatus: "NOT_FOUND",
      };
    }
    if (!response.ok) {
      logger.warn("payments.mtn.status_failed", { status: response.status });
      throw new AppError("integration_unavailable", "MTN Mobile Money status could not be checked.");
    }

    const providerStatus = stringField(response.json?.status)?.toUpperCase() ?? "UNKNOWN";
    const currency = stringField(response.json?.currency)?.toUpperCase() ?? input.currency;
    const rawAmount = response.json?.amount;
    let amountMinor: bigint | undefined;
    try {
      amountMinor = parseProviderAmount(rawAmount, currency) ?? undefined;
    } catch {
      amountMinor = undefined;
    }
    const reason = stringField(response.json?.reason);

    return {
      status: mapStatus(providerStatus),
      providerReference: input.providerReference,
      providerStatus,
      amountMinor,
      currency,
      paidAt: mapStatus(providerStatus) === "succeeded" ? new Date().toISOString() : null,
      failureCode: mapStatus(providerStatus) === "failed" ? "mtn_failed" : null,
      failureMessage: reason,
      metadata: {
        financial_transaction_id: stringField(response.json?.financialTransactionId),
      },
    };
  }

  verifyWebhook(input: WebhookVerificationInput): { valid: boolean; reason?: string } {
    const config = mtnConfig();
    if (!config) return { valid: false, reason: "not_configured" };
    const token = input.url.searchParams.get("token");
    if (!verifyWebhookTokenHash(token, input.payment?.webhookTokenHash ?? null)) {
      return { valid: false, reason: "callback_token" };
    }
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
      throw new AppError("validation_failed", "Invalid MTN Mobile Money callback.");
    }

    const providerReference = stringField(body.referenceId);
    const merchantReference = stringField(body.externalId);
    if (!providerReference || !merchantReference) {
      throw new AppError("validation_failed", "MTN Mobile Money callback is missing a payment reference.");
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
    const financialTransactionId = stringField(body.financialTransactionId);
    const reason = stringField(body.reason);

    return {
      eventId: `${providerReference}:${providerStatus}:${financialTransactionId ?? ""}`,
      eventType: "requesttopay.status",
      merchantReference,
      providerReference,
      status,
      providerStatus,
      amountMinor,
      currency,
      paidAt: status === "succeeded" ? new Date().toISOString() : null,
      failureCode: status === "failed" ? "mtn_failed" : null,
      failureMessage: reason,
    };
  }

  async refund(): Promise<RefundPaymentResult> {
    return {
      supported: false,
      reason: "MTN MoMo Collections does not expose an automatic refund operation for this merchant account.",
    };
  }
}
