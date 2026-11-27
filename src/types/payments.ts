import type { PaymentStatus } from "@/types/database";
import type { PaymentProviderId } from "@/lib/payments/types";

export type PaymentProviderOption = {
  id: PaymentProviderId;
  label: string;
  configured: boolean;
};

export type PaymentCheckout = {
  paymentId: string;
  merchantReference: string;
  provider: PaymentProviderId;
  planCode: string;
  amountMinor: number;
  currency: string;
  status: PaymentStatus;
  checkoutUrl: string | null;
  instructions: string | null;
  expiresAt: string | null;
};

export type PaymentPublicStatus = {
  id: string;
  merchantReference: string;
  provider: PaymentProviderId;
  planCode: string | null;
  amountMinor: number;
  currency: string;
  status: PaymentStatus;
  checkoutUrl: string | null;
  failureCode: string | null;
  failureMessage: string | null;
  paidAt: string | null;
  expiresAt: string | null;
  refundedAmountMinor: number;
  createdAt: string;
};

export type PaymentCopy = {
  payWith: string;
  phone: string;
  phoneHint: string;
  payButton: string;
  starting: string;
  secure: string;
  notConfigured: string;
  noProviders: string;
  pending: string;
  instructions: string;
  openProvider: string;
  success: string;
  failed: string;
  expired: string;
  retry: string;
  statusLabel: string;
  reference: string;
  providerLabel: string;
  statusPending: string;
  statusProcessing: string;
  statusSucceeded: string;
  statusFailed: string;
  statusExpired: string;
  statusRefunded: string;
  statusReversed: string;
  errorGeneric: string;
};

export type PaymentHistoryItem = {
  id: string;
  provider: string;
  merchant_reference: string;
  plan_code: string | null;
  amount_minor: number;
  currency: string;
  status: PaymentStatus;
  paid_at: string | null;
  failure_code: string | null;
  failure_message: string | null;
  created_at: string;
};
