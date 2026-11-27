import type { SubscriptionStatus, WorkspacePlan } from "@/types/database";

export const FEATURE_IDS = [
  "manual_bookkeeping",
  "offline_bookkeeping",
  "ai_bookkeeping",
  "whatsapp_integration",
  "ussd_integration",
  "advanced_analytics",
  "advanced_ai_insights",
  "daily_reports",
  "weekly_reports",
  "monthly_reports",
  "custom_reports",
  "team_members",
  "invoice_management",
  "data_exports",
  "advanced_exports",
  "budget_management",
  "customer_supplier_management",
  "inventory_management",
  "priority_support",
  "multiple_workspaces",
] as const;

export type FeatureId = (typeof FEATURE_IDS)[number];

export type FeatureGrant = {
  included: boolean;
  limit: number | null;
  requiredPlan: string | null;
};

export type PlanFeature = {
  code: string;
  name: string;
  description: string;
  included: boolean;
  limit: number | null;
};

export type PlanCatalogueEntry = {
  code: WorkspacePlan;
  name: string;
  description: string;
  priceMinor: number;
  currency: string;
  billingInterval: string;
  seats: number;
  workspaceLimit: number | null;
  aiMessageLimit: number;
  transactionLimit: number | null;
  integrationLimit: number | null;
  exportLimit: number | null;
  sortOrder: number;
  isActive: boolean;
  features: PlanFeature[];
};

export type WorkspaceEntitlements = {
  workspaceId: string;
  planCode: WorkspacePlan;
  planName: string;
  planDescription: string;
  priceMinor: number;
  currency: string;
  status: SubscriptionStatus | "none";
  subscriptionReadable: boolean;
  writable: boolean;
  readOnly: boolean;
  trial: {
    active: boolean;
    expired: boolean;
    endsAt: string | null;
    startedAt: string | null;
    daysRemaining: number | null;
    planCode: WorkspacePlan | null;
    planName: string | null;
  };
  features: Record<FeatureId, FeatureGrant>;
  limits: {
    seats: number | null;
    aiMessagesPerMonth: number | null;
    transactionsPerMonth: number | null;
    integrations: number | null;
    exportsPerMonth: number | null;
    workspaces: number | null;
  };
  usage: {
    activeMembers: number;
    aiMessagesThisMonth: number;
    transactionsThisMonth: number;
    integrations: number;
    exportsThisMonth: number;
  };
};
