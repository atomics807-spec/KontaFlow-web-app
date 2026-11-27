import { AppError } from "@/lib/errors";
import type { SubscriptionRow } from "@/types/database";
import type { FeatureId, WorkspaceEntitlements } from "@/types/entitlements";

const DAY_MS = 24 * 60 * 60 * 1000;

export type SubscriptionAccess = {
  activeTrial: boolean;
  expiredTrial: boolean;
  readOnly: boolean;
  writable: boolean;
  subscriptionReadable: boolean;
  daysRemaining: number | null;
};

export function subscriptionAccess(
  subscription: SubscriptionRow | null,
  now = new Date(),
): SubscriptionAccess {
  const trialEndsAt = subscription?.trial_ends_at ?? null;
  const trialEndsAtMs = trialEndsAt ? new Date(trialEndsAt).getTime() : null;
  const activeTrial = Boolean(
    subscription?.status === "trialing" && trialEndsAtMs !== null && trialEndsAtMs > now.getTime(),
  );
  const expiredTrial = Boolean(
    subscription?.status === "trialing" && trialEndsAtMs !== null && trialEndsAtMs <= now.getTime(),
  );
  const readOnly =
    !subscription ||
    expiredTrial ||
    ["past_due", "canceled", "paused"].includes(subscription.status);
  const subscriptionReadable =
    !subscription ||
    ["active", "trialing", "past_due", "canceled"].includes(subscription.status);

  return {
    activeTrial,
    expiredTrial,
    readOnly,
    writable: Boolean(subscription) && !readOnly,
    subscriptionReadable,
    daysRemaining:
      trialEndsAtMs === null
        ? null
        : Math.max(0, Math.ceil((trialEndsAtMs - now.getTime()) / DAY_MS)),
  };
}

export function hasFeature(entitlements: WorkspaceEntitlements, feature: FeatureId): boolean {
  return entitlements.features[feature].included;
}

export function featureRequiredMessage(entitlements: WorkspaceEntitlements, feature: FeatureId): string {
  const required = entitlements.features[feature].requiredPlan;
  return required
    ? `This feature requires the ${required} plan. Upgrade in Billing to continue.`
    : "This feature is not included in your plan. Upgrade in Billing to continue.";
}

export function assertFeature(
  entitlements: WorkspaceEntitlements,
  feature: FeatureId,
  options?: { write?: boolean },
): void {
  if (!hasFeature(entitlements, feature)) {
    throw new AppError("plan_required", featureRequiredMessage(entitlements, feature));
  }
  if (options?.write && !entitlements.writable) {
    throw new AppError(
      "plan_required",
      "Your trial or subscription has ended. Your books are read-only until you choose a plan.",
    );
  }
}

export function assertLimit(
  entitlements: WorkspaceEntitlements,
  key: "seats" | "aiMessagesPerMonth" | "transactionsPerMonth" | "integrations" | "exportsPerMonth",
  amount = 1,
): void {
  const limit = entitlements.limits[key];
  if (limit === null) return;
  const usage =
    key === "seats"
      ? entitlements.usage.activeMembers
      : key === "aiMessagesPerMonth"
        ? entitlements.usage.aiMessagesThisMonth
        : key === "transactionsPerMonth"
          ? entitlements.usage.transactionsThisMonth
          : key === "integrations"
            ? entitlements.usage.integrations
            : entitlements.usage.exportsThisMonth;
  if (usage + amount > limit) {
    throw new AppError(
      "limit_reached",
      key === "seats"
        ? "Your plan member limit has been reached. Upgrade to invite more people."
        : key === "integrations"
          ? "Your plan integration limit has been reached. Upgrade to connect another channel."
          : key === "aiMessagesPerMonth"
            ? "Your monthly AI message allowance has been reached. Upgrade to keep using the assistant."
            : "Your plan limit has been reached. Upgrade to continue.",
    );
  }
}
