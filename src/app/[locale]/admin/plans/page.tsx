import type { Metadata } from "next";
import { CreditCard } from "lucide-react";
import { BillingSettingsForm } from "@/components/admin/billing-settings-form";
import { PlanEditor } from "@/components/admin/plan-editor";
import { Badge } from "@/components/ui/badge";
import { getAdminPlanCatalogue, getBillingSettings, getFeatureCatalogue } from "@/services/plans";
import { canManageAccounts, requirePlatformAdmin } from "@/lib/platform-admin";
import { getDictionary } from "@/lib/i18n/server";
import { resolveLocale } from "@/lib/i18n/config";

export const metadata: Metadata = {
  title: "Plans & billing",
  robots: { index: false, follow: false },
};

export default async function AdminPlansPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = resolveLocale((await params).locale);
  const dict = await getDictionary(locale);
  const copy = dict.admin;
  const { admin } = await requirePlatformAdmin(locale);
  const canManage = canManageAccounts(admin.role);

  const [plans, settings, features] = await Promise.all([
    getAdminPlanCatalogue(),
    getBillingSettings(),
    getFeatureCatalogue(),
  ]);

  return (
    <div className="space-y-5">
      <header>
        <p className="text-[0.65rem] font-bold uppercase tracking-[0.16em] text-[#3f6b52]">{copy.plans}</p>
        <h1 className="mt-1 flex items-center gap-2 text-2xl font-extrabold tracking-tight text-[#151c19]">
          <CreditCard className="h-6 w-6 text-[#3f6b52]" aria-hidden />
          {copy.plansTitle}
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-[#151c19]/55">{copy.plansLead}</p>
      </header>

      <BillingSettingsForm settings={settings} canManage={canManage} />

      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-extrabold text-[#151c19]">{copy.features}</h2>
        <Badge tone="mango">{plans.length}</Badge>
      </div>

      <div className="space-y-2">
        {plans.map((plan) => (
          <PlanEditor key={plan.code} plan={plan} features={features} canManage={canManage} />
        ))}
      </div>
    </div>
  );
}
