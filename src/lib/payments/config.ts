import "server-only";

import { getServerEnv } from "@/lib/env";
import { isDemoPaymentEnabled } from "./demo";
import type { PaymentProviderId } from "./types";
import { PAYMENT_PROVIDER_LABELS } from "./types";

export type PaymentMode = "disabled" | "sandbox" | "production";

export type ProviderAvailability = {
  id: PaymentProviderId;
  label: string;
  configured: boolean;
  mode: PaymentMode;
};

export function paymentMode(): PaymentMode {
  return getServerEnv().PAYMENT_MODE;
}

/**
 * Sandbox checkout is an explicit test provider. It is only available in
 * sandbox mode and never activates a plan when PAYMENT_MODE is production or
 * disabled.
 */
export function demoPaymentEnabled(): boolean {
  const env = getServerEnv();
  return isDemoPaymentEnabled(env.PAYMENT_MODE, env.PAYMENT_PROVIDER);
}

export function mtnConfig() {
  const env = getServerEnv();
  if (env.PAYMENT_MODE === "disabled") return null;
  const baseUrl =
    env.MTN_MOMO_BASE_URL ??
    (env.PAYMENT_MODE === "sandbox"
      ? "https://sandbox.momodeveloper.mtn.com"
      : "https://proxy.momoapi.mtn.com");
  if (
    !env.MTN_MOMO_SUBSCRIPTION_KEY ||
    !env.MTN_MOMO_API_USER_ID ||
    !env.MTN_MOMO_API_KEY ||
    !env.MTN_MOMO_TARGET_ENV
  ) {
    return null;
  }
  return {
    baseUrl: baseUrl.replace(/\/$/, ""),
    subscriptionKey: env.MTN_MOMO_SUBSCRIPTION_KEY,
    apiUserId: env.MTN_MOMO_API_USER_ID,
    apiKey: env.MTN_MOMO_API_KEY,
    targetEnvironment: env.MTN_MOMO_TARGET_ENV,
    webhookSecret: env.MTN_MOMO_WEBHOOK_SECRET ?? null,
    signatureHeader: env.MTN_MOMO_SIGNATURE_HEADER,
    mode: env.PAYMENT_MODE,
  };
}

export function orangeConfig() {
  const env = getServerEnv();
  if (env.PAYMENT_MODE === "disabled") return null;
  if (
    !env.ORANGE_MONEY_CLIENT_ID ||
    !env.ORANGE_MONEY_CLIENT_SECRET ||
    !env.ORANGE_MONEY_MERCHANT_KEY
  ) {
    return null;
  }
  return {
    baseUrl: env.ORANGE_MONEY_BASE_URL.replace(/\/$/, ""),
    clientId: env.ORANGE_MONEY_CLIENT_ID,
    clientSecret: env.ORANGE_MONEY_CLIENT_SECRET,
    merchantKey: env.ORANGE_MONEY_MERCHANT_KEY,
    webpayPath: env.ORANGE_MONEY_WEBPAY_PATH,
    statusPath: env.ORANGE_MONEY_STATUS_PATH,
    webhookSecret: env.ORANGE_MONEY_WEBHOOK_SECRET ?? null,
    signatureHeader: env.ORANGE_MONEY_SIGNATURE_HEADER,
    lang: env.ORANGE_MONEY_LANG,
    mode: env.PAYMENT_MODE,
  };
}

export function aggregatorConfig() {
  const env = getServerEnv();
  if (env.PAYMENT_MODE === "disabled") return null;
  if (!env.PAYMENT_API_BASE_URL || !env.PAYMENT_API_KEY || !env.PAYMENT_WEBHOOK_SECRET) return null;
  return {
    baseUrl: env.PAYMENT_API_BASE_URL.replace(/\/$/, ""),
    apiKey: env.PAYMENT_API_KEY,
    webhookSecret: env.PAYMENT_WEBHOOK_SECRET,
    createPath: env.PAYMENT_AGGREGATOR_CREATE_PATH,
    statusPath: env.PAYMENT_AGGREGATOR_STATUS_PATH,
    refundPath: env.PAYMENT_AGGREGATOR_REFUND_PATH,
    signatureHeader: env.PAYMENT_AGGREGATOR_SIGNATURE_HEADER,
    mode: env.PAYMENT_MODE,
  };
}

/**
 * PAYMENT_PROVIDER optionally narrows checkout to one provider. `none` means
 * "offer every provider whose credentials are complete".
 */
function selectedProviders(): PaymentProviderId[] {
  switch (getServerEnv().PAYMENT_PROVIDER) {
    case "mtn-momo":
      return ["mtn_momo"];
    case "orange-money":
      return ["orange_money"];
    case "aggregator":
      return ["aggregator"];
    case "demo":
      return ["aggregator"];
    case "stripe":
      return [];
    default:
      return ["mtn_momo", "orange_money", "aggregator"];
  }
}

export function isProviderConfigured(provider: PaymentProviderId): boolean {
  if (!selectedProviders().includes(provider)) return false;
  if (demoPaymentEnabled() && provider === "aggregator") return true;
  if (provider === "mtn_momo") return Boolean(mtnConfig());
  if (provider === "orange_money") return Boolean(orangeConfig());
  return Boolean(aggregatorConfig());
}

export function availablePaymentProviders(): ProviderAvailability[] {
  const mode = paymentMode();
  const demo = demoPaymentEnabled();
  return (["mtn_momo", "orange_money", "aggregator"] as const)
    .map((id) => ({
      id,
      label: demo && id === "aggregator" ? "Demo mobile money (sandbox)" : PAYMENT_PROVIDER_LABELS[id],
      configured: isProviderConfigured(id),
      mode,
    }))
    .filter((provider) => provider.configured);
}

export function providerLabel(provider: PaymentProviderId): string {
  return PAYMENT_PROVIDER_LABELS[provider];
}
