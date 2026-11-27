import type { PaymentStatus } from "@/types/database";

export const PAYMENT_PROVIDERS = ["mtn_momo", "orange_money", "aggregator"] as const;
export type PaymentProviderId = (typeof PAYMENT_PROVIDERS)[number];

export const PAYMENT_PROVIDER_LABELS: Record<PaymentProviderId, string> = {
  mtn_momo: "MTN Mobile Money",
  orange_money: "Orange Money",
  aggregator: "Mobile money",
};

export function isPaymentProvider(value: unknown): value is PaymentProviderId {
  return typeof value === "string" && (PAYMENT_PROVIDERS as readonly string[]).includes(value);
}

export type ProviderStatus = "pending" | "processing" | "succeeded" | "failed" | "expired" | "unknown";

export type InitiatePaymentInput = {
  merchantReference: string;
  workspaceId: string;
  planCode: string;
  amountMinor: bigint;
  currency: string;
  payerMsisdn: string | null;
  description: string;
  returnUrl: string;
  cancelUrl: string;
  callbackUrl: string;
  locale: "en" | "fr" | "pcm";
};

export type InitiatePaymentResult = {
  providerReference: string;
  status: ProviderStatus;
  providerStatus: string;
  checkoutUrl: string | null;
  instructions: string | null;
  /** Provider-issued token that must be hashed before persistence. */
  webhookToken?: string | null;
  metadata?: Record<string, string | null>;
};

export type PaymentStatusInput = {
  merchantReference: string;
  providerReference: string;
  amountMinor: bigint;
  currency: string;
  payerMsisdn: string | null;
  metadata: Record<string, unknown>;
};

export type ProviderPaymentStatus = {
  status: ProviderStatus;
  providerReference: string;
  providerStatus: string;
  amountMinor?: bigint;
  currency?: string;
  paidAt?: string | null;
  failureCode?: string | null;
  failureMessage?: string | null;
  metadata?: Record<string, string | null>;
};

export type WebhookPaymentContext = {
  merchantReference: string;
  providerReference: string | null;
  webhookTokenHash: string | null;
  metadata: Record<string, unknown>;
};

export type WebhookVerificationInput = {
  rawBody: string;
  headers: Headers;
  url: URL;
  payment: WebhookPaymentContext | null;
};

export type WebhookParseInput = {
  rawBody: string;
  headers: Headers;
  url: URL;
};

export type ParsedPaymentWebhook = {
  eventId: string;
  eventType: string;
  merchantReference: string;
  providerReference: string | null;
  status: ProviderStatus;
  providerStatus: string;
  amountMinor: bigint | null;
  currency: string | null;
  paidAt: string | null;
  failureCode: string | null;
  failureMessage: string | null;
};

export type RefundPaymentInput = {
  merchantReference: string;
  providerReference: string;
  amountMinor: bigint;
  currency: string;
  reason: string;
};

export type RefundPaymentResult =
  | { supported: true; providerReference: string | null; providerStatus: string }
  | { supported: false; reason: string };

export interface PaymentAdapter {
  readonly id: PaymentProviderId;
  readonly label: string;
  isConfigured(): boolean;
  initiate(input: InitiatePaymentInput): Promise<InitiatePaymentResult>;
  fetchStatus(input: PaymentStatusInput): Promise<ProviderPaymentStatus>;
  verifyWebhook(input: WebhookVerificationInput): { valid: boolean; reason?: string };
  parseWebhook(input: WebhookParseInput): ParsedPaymentWebhook;
  refund(input: RefundPaymentInput): Promise<RefundPaymentResult>;
}

export function isTerminalPaymentStatus(status: PaymentStatus): boolean {
  return ["succeeded", "failed", "expired", "refunded", "reversed"].includes(status);
}
