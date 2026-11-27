import { describe, expect, it } from "vitest";
import { isDemoPaymentEnabled } from "@/lib/payments/demo";

describe("demo payment gate", () => {
  it("enables demo checkout only for explicit sandbox configuration", () => {
    expect(isDemoPaymentEnabled("sandbox", "demo")).toBe(true);
  });

  it("never enables demo checkout in production or disabled mode", () => {
    expect(isDemoPaymentEnabled("production", "demo")).toBe(false);
    expect(isDemoPaymentEnabled("disabled", "demo")).toBe(false);
  });

  it("does not treat real providers as demo checkout", () => {
    expect(isDemoPaymentEnabled("sandbox", "mtn-momo")).toBe(false);
    expect(isDemoPaymentEnabled("sandbox", "aggregator")).toBe(false);
  });
});
