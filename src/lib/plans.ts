import type { WorkspacePlan } from "@/types/database";

export type PlanDefinition = {
  id: WorkspacePlan;
  priceMinor: number;
  currency: "XAF";
  seats: number;
  aiMessagesPerMonth: number;
};

/** Prices are in minor units of XAF (zero-decimal: 9900 == 9 900 FCFA). */
export const PLAN_DEFINITIONS: Record<WorkspacePlan, PlanDefinition> = {
  starter: { id: "starter", priceMinor: 0, currency: "XAF", seats: 2, aiMessagesPerMonth: 50 },
  growth: { id: "growth", priceMinor: 9900, currency: "XAF", seats: 8, aiMessagesPerMonth: 500 },
  scale: { id: "scale", priceMinor: 29900, currency: "XAF", seats: 25, aiMessagesPerMonth: 5000 },
};

export function planFor(plan: string | null | undefined): PlanDefinition {
  if (plan === "growth" || plan === "scale") return PLAN_DEFINITIONS[plan];
  return PLAN_DEFINITIONS.starter;
}
