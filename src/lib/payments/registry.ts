import "server-only";

import { AppError } from "@/lib/errors";
import { availablePaymentProviders, isProviderConfigured, type ProviderAvailability } from "./config";
import { AggregatorAdapter } from "./providers/aggregator";
import { MtnMomoAdapter } from "./providers/mtn";
import { OrangeMoneyAdapter } from "./providers/orange";
import { isPaymentProvider, type PaymentAdapter, type PaymentProviderId } from "./types";

const adapters: Record<PaymentProviderId, PaymentAdapter> = {
  mtn_momo: new MtnMomoAdapter(),
  orange_money: new OrangeMoneyAdapter(),
  aggregator: new AggregatorAdapter(),
};

export function getPaymentAdapter(provider: PaymentProviderId): PaymentAdapter {
  if (!isPaymentProvider(provider)) {
    throw new AppError("validation_failed", "Choose a supported mobile money provider.");
  }
  const adapter = adapters[provider];
  if (!isProviderConfigured(provider)) {
    throw new AppError(
      "configuration_missing",
      `${adapter.label} is not configured on this deployment. Contact support to complete the payment setup.`,
    );
  }
  return adapter;
}

export function getConfiguredPaymentProviders(): ProviderAvailability[] {
  return availablePaymentProviders();
}
