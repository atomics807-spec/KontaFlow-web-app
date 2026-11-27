import "server-only";

import { AppError } from "@/lib/errors";
import { assertFeature, assertLimit, featureRequiredMessage, hasFeature, subscriptionAccess } from "@/lib/entitlements/guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type {
  PlanFeatureRow,
  SubscriptionFeatureRow,
  SubscriptionPlanRow,
  SubscriptionRow,
  WorkspacePlan,
} from "@/types/database";
import {
  FEATURE_IDS,
  type FeatureGrant,
  type FeatureId,
  type WorkspaceEntitlements,
} from "@/types/entitlements";

type LoadOptions = {
  userId?: string;
  serviceRole?: boolean;
};

function monthStart(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

function planMap(plans: SubscriptionPlanRow[]): Map<string, SubscriptionPlanRow> {
  return new Map(plans.map((plan) => [plan.id, plan]));
}

function featuresByPlan(
  plans: SubscriptionPlanRow[],
  features: SubscriptionFeatureRow[],
  grants: PlanFeatureRow[],
): Map<string, Map<string, PlanFeatureRow>> {
  const featureById = new Map(features.map((feature) => [feature.id, feature]));
  const result = new Map<string, Map<string, PlanFeatureRow>>();
  for (const plan of plans) result.set(plan.id, new Map());
  for (const grant of grants) {
    const feature = featureById.get(grant.feature_id);
    if (!feature) continue;
    result.get(grant.plan_id)?.set(feature.code, grant);
  }
  return result;
}

export async function getWorkspaceEntitlements(
  workspaceId: string,
  userId: string,
): Promise<WorkspaceEntitlements> {
  return loadWorkspaceEntitlements(workspaceId, { userId });
}

export async function getWorkspaceEntitlementsAsService(workspaceId: string): Promise<WorkspaceEntitlements> {
  return loadWorkspaceEntitlements(workspaceId, { serviceRole: true });
}

async function loadWorkspaceEntitlements(
  workspaceId: string,
  options: LoadOptions,
): Promise<WorkspaceEntitlements> {
  const admin = createAdminClient();
  const since = monthStart();

  const [
    workspaceResult,
    subscriptionResult,
    plansResult,
    featuresResult,
    grantsResult,
    membershipResult,
    membersResult,
    invitationsResult,
    aiUsageResult,
    transactionCountResult,
    integrationsResult,
    exportUsageResult,
  ] = await Promise.all([
    admin.from("workspaces").select("id, plan").eq("id", workspaceId).maybeSingle(),
    admin.from("subscriptions").select("*").eq("workspace_id", workspaceId).maybeSingle(),
    admin.from("subscription_plans").select("*").order("sort_order"),
    admin.from("subscription_features").select("*"),
    admin.from("plan_features").select("*"),
    options.userId
      ? admin
          .from("workspace_members")
          .select("role, status")
          .eq("workspace_id", workspaceId)
          .eq("user_id", options.userId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    admin
      .from("workspace_members")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .in("status", ["active", "invited"]),
    admin
      .from("workspace_invitations")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .eq("status", "pending"),
    admin
      .from("usage_events")
      .select("quantity")
      .eq("workspace_id", workspaceId)
      .eq("kind", "ai_message")
      .gte("created_at", since),
    admin
      .from("transactions")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .eq("status", "posted")
      .gte("created_at", since),
    admin.from("channel_identities").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId),
    admin
      .from("usage_events")
      .select("quantity")
      .eq("workspace_id", workspaceId)
      .eq("kind", "export")
      .gte("created_at", since),
  ]);

  if (workspaceResult.error) throw new AppError("internal_error", "Could not load the workspace.");
  if (!workspaceResult.data) throw new AppError("not_found", "We could not find that workspace.");
  const workspaceRow = workspaceResult.data;
  if (!options.serviceRole) {
    if (!options.userId || membershipResult.error || membershipResult.data?.status !== "active") {
      throw new AppError("forbidden", "You do not have access to this business.");
    }
  }

  const plans = (plansResult.data ?? []) as SubscriptionPlanRow[];
  const features = (featuresResult.data ?? []) as SubscriptionFeatureRow[];
  const grants = (grantsResult.data ?? []) as PlanFeatureRow[];
  const subscription = (subscriptionResult.data as SubscriptionRow | null) ?? null;
  const plansById = planMap(plans);
  const grantsByPlan = featuresByPlan(plans, features, grants);
  const access = subscriptionAccess(subscription);
  const basePlan = subscription
    ? plansById.get(subscription.plan_id ?? "") ??
      plans.find((plan) => plan.code === subscription.plan)
    : plans.find((plan) => plan.code === (workspaceRow.plan as WorkspacePlan));
  const trialPlan = subscription?.trial_plan_id ? plansById.get(subscription.trial_plan_id) : null;
  const effectivePlan = access.activeTrial && trialPlan ? trialPlan : basePlan;
  if (!effectivePlan) throw new AppError("internal_error", "This workspace has no active plan.");

  const effectiveGrants = grantsByPlan.get(effectivePlan.id) ?? new Map<string, PlanFeatureRow>();
  const activePlans = plans.filter((plan) => plan.is_active);
  const featureGrants: Record<FeatureId, FeatureGrant> = {} as Record<FeatureId, FeatureGrant>;

  for (const featureId of FEATURE_IDS) {
    const grant = effectiveGrants.get(featureId);
    const included = Boolean(grant?.included);
    const requiredPlan = included
      ? null
      : activePlans.find((plan) => grantsByPlan.get(plan.id)?.get(featureId)?.included)?.name ?? null;
    featureGrants[featureId] = {
      included,
      limit: grant?.limit_value ?? null,
      requiredPlan,
    };
  }

  const trialEndsAt = subscription?.trial_ends_at ?? null;
  const aiMessagesThisMonth = (aiUsageResult.data ?? []).reduce(
    (sum, row) => sum + Number(row.quantity ?? 0),
    0,
  );
  const activeMembers =
    Number(membersResult.count ?? 0) + Number(invitationsResult.count ?? 0);
  const exportsThisMonth = (exportUsageResult.data ?? []).reduce(
    (sum, row) => sum + Number(row.quantity ?? 0),
    0,
  );

  return {
    workspaceId,
    planCode: effectivePlan.code,
    planName: effectivePlan.name,
    planDescription: effectivePlan.description ?? "",
    priceMinor: effectivePlan.price_minor,
    currency: effectivePlan.currency,
    status: subscription?.status ?? "none",
    subscriptionReadable: access.subscriptionReadable,
    writable: access.writable,
    readOnly: access.readOnly,
    trial: {
      active: access.activeTrial,
      expired: access.expiredTrial,
      endsAt: trialEndsAt,
      startedAt: subscription?.trial_started_at ?? null,
      daysRemaining: access.daysRemaining,
      planCode: trialPlan?.code ?? null,
      planName: trialPlan?.name ?? null,
    },
    features: featureGrants,
    limits: {
      seats: effectivePlan.seats_included,
      aiMessagesPerMonth: effectivePlan.ai_message_limit,
      transactionsPerMonth: effectivePlan.transaction_limit,
      integrations: effectivePlan.integration_limit,
      exportsPerMonth: effectivePlan.export_limit,
      workspaces: effectivePlan.workspace_limit,
    },
    usage: {
      activeMembers,
      aiMessagesThisMonth,
      transactionsThisMonth: Number(transactionCountResult.count ?? 0),
      integrations: Number(integrationsResult.count ?? 0),
      exportsThisMonth,
    },
  };
}

export { assertFeature, assertLimit, featureRequiredMessage, hasFeature };

export async function consumeExportAllowance(
  workspaceId: string,
  userId: string,
  feature: FeatureId = "data_exports",
): Promise<WorkspaceEntitlements> {
  const entitlements = await getWorkspaceEntitlements(workspaceId, userId);
  assertFeature(entitlements, feature, { write: true });

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("consume_quota", {
    p_workspace_id: workspaceId,
    p_kind: "export",
    p_limit: 0,
  });
  if (error) throw new AppError("internal_error", "Could not record this export.");
  if (!data) {
    throw new AppError(
      "limit_reached",
      "Your monthly export allowance has been reached. Upgrade to continue.",
    );
  }
  return entitlements;
}

export async function requireFeature(
  workspaceId: string,
  feature: FeatureId,
  options?: { userId?: string; serviceRole?: boolean; write?: boolean },
): Promise<WorkspaceEntitlements> {
  const entitlements =
    options?.serviceRole || !options?.userId
      ? await getWorkspaceEntitlementsAsService(workspaceId)
      : await getWorkspaceEntitlements(workspaceId, options.userId);
  assertFeature(entitlements, feature, { write: options?.write });
  return entitlements;
}
