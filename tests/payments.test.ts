import { describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import { parseProviderAmount, providerAmountString } from "@/lib/payments/amounts";
import { maskMsisdn, normalizeMsisdn } from "@/lib/payments/phone";
import { hashWebhookToken, verifyHmacSignature, verifyWebhookTokenHash } from "@/lib/payments/signature";
import { isPaymentProvider, isTerminalPaymentStatus } from "@/lib/payments/types";
import { paymentInitiateSchema } from "@/lib/validation/payments";

describe("payment amounts", () => {
  it("converts XAF minor units without decimals", () => {
    expect(providerAmountString(7500n, "XAF")).toBe("7500");
    expect(parseProviderAmount("7500", "XAF")).toBe(7500n);
    expect(parseProviderAmount(7500, "XAF")).toBe(7500n);
  });

  it("keeps two-decimal currencies exact", () => {
    expect(providerAmountString(12345n, "USD")).toBe("123.45");
    expect(parseProviderAmount("123.45", "USD")).toBe(12345n);
    expect(parseProviderAmount("123,45", "USD")).toBe(12345n);
  });

  it("rejects malformed provider amounts", () => {
    expect(parseProviderAmount("12.345", "USD")).toBeNull();
    expect(parseProviderAmount("-1", "XAF")).toBeNull();
    expect(parseProviderAmount("abc", "XAF")).toBeNull();
  });
});

describe("mobile money phone numbers", () => {
  it("normalises Cameroon local and international forms", () => {
    expect(normalizeMsisdn("6 71 23 45 67")).toBe("237671234567");
    expect(normalizeMsisdn("+237 671 234 567")).toBe("237671234567");
    expect(normalizeMsisdn("00237671234567")).toBe("237671234567");
  });

  it("rejects invalid numbers", () => {
    expect(normalizeMsisdn("12345")).toBeNull();
    expect(normalizeMsisdn("")).toBeNull();
    expect(normalizeMsisdn(null)).toBeNull();
  });

  it("masks a number for display", () => {
    expect(maskMsisdn("237671234567")).toBe("237*******67");
  });
});

describe("payment webhook verification", () => {
  const secret = "test-webhook-secret";
  const body = JSON.stringify({ referenceId: "abc", status: "SUCCESSFUL" });

  it("accepts a correct HMAC and rejects a changed body", () => {
    const signature = createHmac("sha256", secret).update(body).digest("hex");
    expect(verifyHmacSignature(body, `sha256=${signature}`, secret)).toBe(true);
    expect(verifyHmacSignature(`${body} `, signature, secret)).toBe(false);
    expect(verifyHmacSignature(body, signature, null)).toBe(false);
  });

  it("hashes and compares per-payment callback tokens", () => {
    const hash = hashWebhookToken("one-time-token");
    expect(verifyWebhookTokenHash("one-time-token", hash)).toBe(true);
    expect(verifyWebhookTokenHash("wrong-token", hash)).toBe(false);
    expect(verifyWebhookTokenHash(null, hash)).toBe(false);
  });
});

describe("payment provider validation", () => {
  it("accepts only the supported provider identifiers", () => {
    expect(isPaymentProvider("mtn_momo")).toBe(true);
    expect(isPaymentProvider("orange_money")).toBe(true);
    expect(isPaymentProvider("aggregator")).toBe(true);
    expect(isPaymentProvider("stripe")).toBe(false);
  });

  it("validates checkout payloads and rejects client-supplied amounts", () => {
    const parsed = paymentInitiateSchema.safeParse({
      planCode: "growth",
      provider: "orange_money",
      payerMsisdn: "671234567",
      idempotencyKey: "11111111-1111-4111-8111-111111111111",
      amountMinor: 1,
    });
    expect(parsed.success).toBe(true);
    expect(parsed.success && "amountMinor" in parsed.data).toBe(false);
    expect(paymentInitiateSchema.safeParse({ planCode: "growth", provider: "stripe" }).success).toBe(false);
  });

  it("identifies terminal states", () => {
    expect(isTerminalPaymentStatus("succeeded")).toBe(true);
    expect(isTerminalPaymentStatus("refunded")).toBe(true);
    expect(isTerminalPaymentStatus("processing")).toBe(false);
  });
});
