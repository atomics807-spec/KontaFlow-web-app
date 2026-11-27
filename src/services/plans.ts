import "server-only";

import { createClient } from "@/lib/supabase/server";
import { assertNoError } from "@/lib/supabase/errors";
import type { PlanCatalogueEntry } from "@/types/entitlements";
import type { SubscriptionFeatureRow } from "@/types/database";

export type BillingSettings = {
  trial_days: number;
  trial_plan_code: string;
  trial_reminder_days: number[];
  expired_policy: "read_only";
};

export async function getPlanCatalogue(): Promise<PlanCatalogueEntry[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_plan_catalogue");
  if (error) throw assertNoError(error, "Could not load the plans.");
  return (data ?? []) as PlanCatalogueEntry[];
}

export async function getAdminPlanCatalogue(): Promise<PlanCatalogueEntry[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("platform_admin_plan_catalogue");
  if (error) throw assertNoError(error, "Could not load the plans.");
  return (data ?? []) as PlanCatalogueEntry[];
}

export async function getFeatureCatalogue(): Promise<SubscriptionFeatureRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("subscription_features").select("*").order("category").order("name");
  if (error) throw assertNoError(error, "Could not load the feature catalogue.");
  return (data ?? []) as SubscriptionFeatureRow[];
}

export async function getBillingSettings(): Promise<BillingSettings> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("platform_admin_billing_settings");
  if (error) throw assertNoError(error, "Could not load billing settings.");
  const value = (data ?? {}) as Partial<BillingSettings>;
  return {
    trial_days: Number(value.trial_days ?? 14),
    trial_plan_code: String(value.trial_plan_code ?? "starter"),
    trial_reminder_days: Array.isArray(value.trial_reminder_days)
      ? value.trial_reminder_days.map(Number).filter((day) => Number.isFinite(day))
      : [7, 3, 1],
    expired_policy: "read_only",
  };
}
