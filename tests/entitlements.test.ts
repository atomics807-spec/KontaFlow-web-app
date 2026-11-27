import { describe, expect, it } from "vitest";
import { AppError } from "@/lib/errors";
import {
  assertFeature,
  assertLimit,
  featureRequiredMessage,
  hasFeature,
  subscriptionAccess,
} from "@/lib/entitlements/guards";
import { FEATURE_IDS, type FeatureGrant, type FeatureId, type WorkspaceEntitlements } from "@/types/entitlements";
import type { SubscriptionRow } from "@/types/database";

function grant(overrides: Partial<FeatureGrant> = {}): FeatureGrant {
  return { included: true, limit: null, requiredPlan: null, ...overrides };
}

function entitlements(overrides: Partial<WorkspaceEntitlements> = {}): WorkspaceEntitlements {
  const features = Object.fromEntries(FEATURE_IDS.map((id) => [id, grant()])) as Record<FeatureId, FeatureGrant>;
  return {
    workspaceId: "ws-1",
    planCode: "growth",
    planName: "Growth",
    planDescription: "Growth plan",
    priceMinor: 9900,
    currency: "XAF",
    status: "active",
    subscriptionReadable: true,
    writable: true,
    readOnly: false,
    trial: {
      active: false,
      expired: false,
      endsAt: null,
      startedAt: null,
      daysRemaining: null,
      planCode: null,
      planName: null,
    },
    features,
    limits: {
      seats: 8,
      aiMessagesPerMonth: 500,
      transactionsPerMonth: 5000,
      integrations: 2,
      exportsPerMonth: 10,
      workspaces: 2,
    },
    usage: {
      activeMembers: 1,
      aiMessagesThisMonth: 0,
      transactionsThisMonth: 0,
      integrations: 0,
      exportsThisMonth: 0,
    },
    ...overrides,
  };
}

function subscription(overrides: Partial<SubscriptionRow> = {}): SubscriptionRow {
  return {
    id: "sub-1",
    workspace_id: "ws-1",
    plan: "starter",
    plan_id: "plan-starter",
    status: "trialing",
    provider: "internal",
    provider_ref: null,
    price_minor: 0,
    currency: "XAF",
    seats: 2,
    trial_started_at: "2026-11-01T00:00:00.000Z",
    trial_ends_at: "2026-11-15T00:00:00.000Z",
    trial_plan_id: "plan-starter",
    current_period_start: null,
    current_period_end: null,
    cancel_at_period_end: false,
    canceled_at: null,
    created_at: "2026-11-01T00:00:00.000Z",
    updated_at: "2026-11-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("trial and subscription access", () => {
  const now = new Date("2026-11-10T12:00:00.000Z");

  it("keeps a live trial writable and reports whole days remaining", () => {
    const access = subscriptionAccess(subscription(), now);
    expect(access).toMatchObject({
      activeTrial: true,
      expiredTrial: false,
      readOnly: false,
      writable: true,
      subscriptionReadable: true,
      daysRemaining: 5,
    });
  });

  it("ends the trial at the exact deadline", () => {
    const access = subscriptionAccess(subscription({ trial_ends_at: now.toISOString() }), now);
    expect(access).toMatchObject({
      activeTrial: false,
      expiredTrial: true,
      readOnly: true,
      writable: false,
      daysRemaining: 0,
    });
  });

  it("treats a missing subscription as read-only but readable", () => {
    expect(subscriptionAccess(null, now)).toEqual({
      activeTrial: false,
      expiredTrial: false,
      readOnly: true,
      writable: false,
      subscriptionReadable: true,
      daysRemaining: null,
    });
  });

  it("locks past-due, canceled and paused subscriptions", () => {
    for (const status of ["past_due", "canceled", "paused"] as const) {
      const access = subscriptionAccess(subscription({ status, trial_ends_at: null }), now);
      expect(access.readOnly).toBe(true);
      expect(access.writable).toBe(false);
    }
  });

  it("does not expose a paused subscription as readable", () => {
    const access = subscriptionAccess(subscription({ status: "paused", trial_ends_at: null }), now);
    expect(access.subscriptionReadable).toBe(false);
  });
});

describe("feature entitlements", () => {
  it("allows included features and blocks excluded ones with the upgrade path", () => {
    const base = entitlements();
    expect(hasFeature(base, "ai_bookkeeping")).toBe(true);

    const limited = entitlements({
      features: {
        ...base.features,
        invoice_management: grant({ included: false, requiredPlan: "Scale" }),
      },
    });
    expect(hasFeature(limited, "invoice_management")).toBe(false);
    expect(featureRequiredMessage(limited, "invoice_management")).toContain("Scale");
    expect(() => assertFeature(limited, "invoice_management")).toThrow(AppError);
  });

  it("blocks writes when the plan is read-only but still allows reads", () => {
    const readOnly = entitlements({ writable: false, readOnly: true, status: "canceled" });
    expect(() => assertFeature(readOnly, "ai_bookkeeping")).not.toThrow();
    expect(() => assertFeature(readOnly, "ai_bookkeeping", { write: true })).toThrow(
      /trial or subscription has ended/i,
    );
  });
});

describe("plan limits", () => {
  it("counts the requested amount against usage", () => {
    const base = entitlements({
      limits: { ...entitlements().limits, seats: 3 },
      usage: { ...entitlements().usage, activeMembers: 2 },
    });
    expect(() => assertLimit(base, "seats")).not.toThrow();
    expect(() => assertLimit(base, "seats", 2)).toThrow(/member limit/i);
  });

  it("enforces AI, transaction, integration and export quotas", () => {
    const base = entitlements();
    expect(() =>
      assertLimit(
        { ...base, usage: { ...base.usage, aiMessagesThisMonth: 500 } },
        "aiMessagesPerMonth",
      ),
    ).toThrow(/AI message allowance/i);
    expect(() =>
      assertLimit(
        { ...base, usage: { ...base.usage, transactionsThisMonth: 5000 } },
        "transactionsPerMonth",
      ),
    ).toThrow(/plan limit/i);
    expect(() =>
      assertLimit({ ...base, usage: { ...base.usage, integrations: 2 } }, "integrations"),
    ).toThrow(/integration limit/i);
    expect(() =>
      assertLimit({ ...base, usage: { ...base.usage, exportsThisMonth: 10 } }, "exportsPerMonth"),
    ).toThrow(/plan limit/i);
  });

  it("treats a null limit as unlimited", () => {
    const base = entitlements({
      limits: { ...entitlements().limits, aiMessagesPerMonth: null },
      usage: { ...entitlements().usage, aiMessagesThisMonth: 999_999 },
    });
    expect(() => assertLimit(base, "aiMessagesPerMonth")).not.toThrow();
  });
});
