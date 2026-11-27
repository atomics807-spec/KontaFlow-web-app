import { AppError } from "@/lib/errors";
import { demoPaymentEnabled } from "../config";
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

/**
 * Explicit test provider used only when PAYMENT_MODE=sandbox and
 * PAYMENT_PROVIDER=demo. It stores under the existing aggregator provider id so
 * the payment ledger and database state machine stay unchanged.
 */
export class SandboxPaymentAdapter implements PaymentAdapter {
  readonly id = "aggregator" as const;
  readonly label = "Demo mobile money (sandbox)";

  isConfigured(): boolean {
    return demoPaymentEnabled();
  }

  async initiate(input: InitiatePaymentInput): Promise<InitiatePaymentResult> {
    if (!this.isConfigured()) {
      throw new AppError("configuration_missing", "Sandbox payments are not enabled on this deployment.");
    }

    return {
      providerReference: `sandbox_${input.merchantReference}`,
      status: "succeeded",
      providerStatus: "SANDBOX_SUCCEEDED",
      checkoutUrl: null,
      instructions: "Sandbox payment approved instantly. No money was moved.",
      metadata: { sandbox: "true" },
    };
  }

  async fetchStatus(input: PaymentStatusInput): Promise<ProviderPaymentStatus> {
    if (!this.isConfigured()) {
      throw new AppError("configuration_missing", "Sandbox payments are not enabled on this deployment.");
    }

    return {
      status: "succeeded",
      providerReference: input.providerReference,
      providerStatus: "SANDBOX_SUCCEEDED",
      amountMinor: input.amountMinor,
      currency: input.currency,
      paidAt: new Date().toISOString(),
      failureCode: null,
      failureMessage: null,
      metadata: { sandbox: "true" },
    };
  }

  verifyWebhook(input: WebhookVerificationInput): { valid: boolean; reason?: string } {
    void input;
    return { valid: false, reason: "sandbox_has_no_webhooks" };
  }

  parseWebhook(input: WebhookParseInput): ParsedPaymentWebhook {
    void input;
    throw new AppError("validation_failed", "Sandbox payments do not accept webhooks.");
  }

  async refund(input: RefundPaymentInput): Promise<RefundPaymentResult> {
    void input;
    return { supported: false, reason: "Sandbox payments cannot be refunded." };
  }
}
