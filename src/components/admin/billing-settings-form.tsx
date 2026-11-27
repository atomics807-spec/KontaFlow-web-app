"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { useI18n } from "@/components/layout/i18n-provider";
import { initialFormState } from "@/lib/action-utils";
import { saveBillingSettingsAction } from "@/app/[locale]/admin/actions";
import type { BillingSettings } from "@/services/plans";

export function BillingSettingsForm({
  settings,
  canManage,
}: {
  settings: BillingSettings;
  canManage: boolean;
}) {
  const { locale, dict } = useI18n();
  const copy = dict.admin;
  const router = useRouter();
  const [state, action, pending] = useActionState(saveBillingSettingsAction, initialFormState);

  useEffect(() => {
    if (state.status === "success") router.refresh();
  }, [state, router]);

  return (
    <section className="rounded-2xl border border-black/8 bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
      <h2 className="text-sm font-extrabold text-[#151c19]">{copy.trialSettings}</h2>
      <form action={action} className="mt-3 space-y-3" noValidate>
        <input type="hidden" name="locale" value={locale} />
        {state.status === "error" && state.message ? <Alert tone="error">{state.message}</Alert> : null}
        {state.status === "success" && state.message ? <Alert tone="success">{state.message}</Alert> : null}
        <div className="grid gap-2 sm:grid-cols-3">
          <Field label={copy.trialDays} htmlFor="trial-days">
            <Input id="trial-days" name="trialDays" type="number" min={1} max={90} defaultValue={settings.trial_days} disabled={!canManage} required />
          </Field>
          <Field label={copy.trialPlan} htmlFor="trial-plan">
            <Select id="trial-plan" name="trialPlanCode" defaultValue={settings.trial_plan_code} disabled={!canManage}>
              <option value="starter">{dict.plans.starter}</option>
              <option value="growth">{dict.plans.growth}</option>
              <option value="scale">{dict.plans.scale}</option>
            </Select>
          </Field>
          <Field label={copy.reminderDays} htmlFor="reminder-days">
            <Input
              id="reminder-days"
              name="reminderDays"
              defaultValue={settings.trial_reminder_days.join(",")}
              disabled={!canManage}
              required
            />
          </Field>
        </div>
        {canManage ? (
          <Button type="submit" size="sm" disabled={pending}>
            <Save className="h-4 w-4" aria-hidden />
            {pending ? dict.common.saving : copy.saveSettings}
          </Button>
        ) : null}
      </form>
    </section>
  );
}
