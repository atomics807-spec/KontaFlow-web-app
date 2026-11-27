import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { transactionSchema, toTransactionPayload, workspaceSchema } from "@/lib/validation/schemas";
import { rateLimit, resetRateLimits } from "@/lib/rate-limit";
import { isWorkspacePlan, PLAN_CODES } from "@/lib/plans";
import { addDays, monthBounds, todayInZone } from "@/lib/dates";
import { billingSettingsSchema, planSaveSchema } from "@/lib/validation/platform-admin";

const UUIDS = {
  category: "11111111-1111-4111-8111-111111111111",
  account: "22222222-2222-4222-8222-222222222222",
  counter: "33333333-3333-4333-8333-333333333333",
};

const baseTransaction = {
  kind: "income" as const,
  amount: "12 500",
  description: "Sale of cement bags",
  occurredOn: todayInZone("Africa/Douala"),
  categoryId: UUIDS.category,
  accountId: UUIDS.account,
};

describe("transaction validation", () => {
  it("accepts a valid income entry", () => {
    expect(transactionSchema.safeParse(baseTransaction).success).toBe(true);
  });

  it("requires a category for income and expense", () => {
    const result = transactionSchema.safeParse({ ...baseTransaction, categoryId: null });
    expect(result.success).toBe(false);
  });

  it("requires a destination account for transfers", () => {
    const withoutCounter = transactionSchema.safeParse({
      ...baseTransaction,
      kind: "transfer",
      categoryId: null,
    });
    expect(withoutCounter.success).toBe(false);

    const withCounter = transactionSchema.safeParse({
      ...baseTransaction,
      kind: "transfer",
      categoryId: null,
      counterAccountId: UUIDS.counter,
    });
    expect(withCounter.success).toBe(true);
  });

  it("rejects one-character descriptions", () => {
    expect(transactionSchema.safeParse({ ...baseTransaction, description: "x" }).success).toBe(false);
  });

  it("maps validated input to a minor-unit RPC payload", () => {
    const parsed = transactionSchema.parse(baseTransaction);
    const payload = toTransactionPayload(parsed, "44444444-4444-4444-8444-444444444444", "XAF", {
      channel: "web",
    });
    expect(payload.amount_minor).toBe("12500");
    expect(payload.kind).toBe("income");
    expect(payload.currency).toBe("XAF");
    expect(payload.channel).toBe("web");
  });
});

describe("workspace validation", () => {
  it("defaults the timezone and normalises the country", () => {
    const parsed = workspaceSchema.parse({
      name: "Boulangerie Nkoulou",
      currency: "XAF",
      country: "cm",
    });
    expect(parsed.timezone).toBe("Africa/Douala");
    expect(parsed.country).toBe("cm");
  });

  it("rejects unsupported currencies", () => {
    expect(workspaceSchema.safeParse({ name: "Shop", currency: "ABC", country: "CM" }).success).toBe(false);
  });
});

describe("plans", () => {
  it("recognises only configured plan codes", () => {
    expect(PLAN_CODES).toEqual(["starter", "growth", "scale"]);
    expect(isWorkspacePlan("growth")).toBe(true);
    expect(isWorkspacePlan("enterprise")).toBe(false);
    expect(isWorkspacePlan(null)).toBe(false);
  });
});

describe("plan configuration validation", () => {
  const basePlan = {
    planCode: "growth",
    name: "Growth",
    description: "For growing businesses",
    priceMinor: "9900",
    currency: "xaf",
    billingInterval: "month",
    seats: "8",
    workspaceLimit: "",
    aiMessageLimit: "0",
    transactionLimit: "5000",
    integrationLimit: "",
    exportLimit: "",
    sortOrder: "2",
    isActive: "true",
  };

  it("turns blank optional limits into unlimited rather than zero", () => {
    const parsed = planSaveSchema.parse(basePlan);
    expect(parsed.workspaceLimit).toBeNull();
    expect(parsed.integrationLimit).toBeNull();
    expect(parsed.exportLimit).toBeNull();
    expect(parsed.currency).toBe("XAF");
  });

  it("accepts a zero AI allowance but rejects a negative one", () => {
    expect(planSaveSchema.parse(basePlan).aiMessageLimit).toBe(0);
    expect(planSaveSchema.safeParse({ ...basePlan, aiMessageLimit: "-1" }).success).toBe(false);
  });

  it("rejects a non-positive transaction limit", () => {
    expect(planSaveSchema.safeParse({ ...basePlan, transactionLimit: "0" }).success).toBe(false);
  });

  it("normalises trial reminder days", () => {
    const parsed = billingSettingsSchema.parse({
      trialDays: "14",
      trialPlanCode: "growth",
      reminderDays: "7, 3,7,1",
    });
    expect(parsed.reminderDays).toEqual([7, 3, 1]);
  });
});

describe("dates", () => {
  it("computes month bounds in the workspace timezone", () => {
    const bounds = monthBounds(new Date("2026-03-15T12:00:00Z"), "Africa/Douala");
    expect(bounds.start).toBe("2026-03-01");
    expect(bounds.end).toBe("2026-03-31");
  });

  it("adds days across month boundaries", () => {
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });
});

describe("rate limiter", () => {
  beforeEach(() => {
    resetRateLimits();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows up to the limit then blocks in the same window", () => {
    expect(rateLimit("wa:+237600000000", 2)).toBe(true);
    expect(rateLimit("wa:+237600000000", 2)).toBe(true);
    expect(rateLimit("wa:+237600000000", 2)).toBe(false);
  });

  it("opens a new window after a minute and keeps keys independent", () => {
    rateLimit("a", 1);
    expect(rateLimit("b", 1)).toBe(true);
    expect(rateLimit("a", 1)).toBe(false);
    vi.advanceTimersByTime(61_000);
    expect(rateLimit("a", 1)).toBe(true);
  });
});
