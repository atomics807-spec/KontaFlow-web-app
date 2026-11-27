"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Save } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { useI18n } from "@/components/layout/i18n-provider";
import { initialFormState } from "@/lib/action-utils";
import { savePlanAction } from "@/app/[locale]/admin/actions";
import type { PlanCatalogueEntry } from "@/types/entitlements";
import type { SubscriptionFeatureRow } from "@/types/database";

export function PlanEditor({
  plan,
  features,
  canManage,
}: {
  plan: PlanCatalogueEntry;
  features: SubscriptionFeatureRow[];
  canManage: boolean;
}) {
  const { locale, dict } = useI18n();
  const copy = dict.admin;
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(savePlanAction, initialFormState);
  const grants = new Map(plan.features.map((feature) => [feature.code, feature]));

  useEffect(() => {
    if (state.status === "success") router.refresh();
  }, [state, router]);

  return (
    <article className="rounded-2xl border border-black/8 bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-extrabold text-[#151c19]">{plan.name}</h2>
            <Badge tone={plan.isActive ? "jade" : "neutral"}>{plan.isActive ? copy.active : copy.inactive}</Badge>
            <span className="font-mono text-[0.6rem] text-[#151c19]/35">{plan.code}</span>
          </div>
          <p className="mt-1 max-w-2xl text-xs text-[#151c19]/55">{plan.description}</p>
          <p className="mt-2 text-[0.68rem] text-[#151c19]/50">
            {copy.priceMinor}: {plan.priceMinor.toLocaleString()} {plan.currency} · {copy.seats}: {plan.seats} ·{" "}
            {copy.aiLimit}: {plan.aiMessageLimit.toLocaleString()}
          </p>
        </div>
        {canManage ? (
          <Button type="button" size="sm" variant="secondary" onClick={() => setOpen((value) => !value)}>
            <Pencil className="h-4 w-4" aria-hidden />
            {open ? dict.common.cancel : copy.editPlan}
          </Button>
        ) : null}
      </div>

      {open && canManage ? (
        <form action={action} className="mt-3 space-y-3 rounded-xl bg-[#f4f2ec] p-3" noValidate>
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="planCode" value={plan.code} />

          {state.status === "error" && state.message ? <Alert tone="error">{state.message}</Alert> : null}
          {state.status === "success" && state.message ? <Alert tone="success">{state.message}</Alert> : null}

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <Field label={copy.planName} htmlFor={`name-${plan.code}`}>
              <Input id={`name-${plan.code}`} name="name" defaultValue={plan.name} maxLength={60} required />
            </Field>
            <Field label={copy.priceMinor} htmlFor={`price-${plan.code}`}>
              <Input id={`price-${plan.code}`} name="priceMinor" type="number" min={0} defaultValue={plan.priceMinor} required />
            </Field>
            <Field label={copy.currency} htmlFor={`currency-${plan.code}`}>
              <Input id={`currency-${plan.code}`} name="currency" defaultValue={plan.currency} maxLength={3} required />
            </Field>
            <Field label={copy.sortOrder} htmlFor={`sort-${plan.code}`}>
              <Input id={`sort-${plan.code}`} name="sortOrder" type="number" min={0} defaultValue={plan.sortOrder} required />
            </Field>
            <Field label={copy.seats} htmlFor={`seats-${plan.code}`}>
              <Input id={`seats-${plan.code}`} name="seats" type="number" min={1} defaultValue={plan.seats} required />
            </Field>
            <Field label={copy.aiLimit} htmlFor={`ai-${plan.code}`}>
              <Input id={`ai-${plan.code}`} name="aiMessageLimit" type="number" min={0} defaultValue={plan.aiMessageLimit} required />
            </Field>
            <Field label={copy.transactionLimit} htmlFor={`tx-${plan.code}`}>
              <Input id={`tx-${plan.code}`} name="transactionLimit" type="number" min={1} defaultValue={plan.transactionLimit ?? ""} />
            </Field>
            <Field label={copy.workspaceLimit} htmlFor={`ws-${plan.code}`}>
              <Input id={`ws-${plan.code}`} name="workspaceLimit" type="number" min={1} defaultValue={plan.workspaceLimit ?? ""} />
            </Field>
            <Field label={copy.integrationLimit} htmlFor={`integrations-${plan.code}`}>
              <Input id={`integrations-${plan.code}`} name="integrationLimit" type="number" min={0} defaultValue={plan.integrationLimit ?? ""} />
            </Field>
            <Field label={copy.exportLimit} htmlFor={`exports-${plan.code}`}>
              <Input id={`exports-${plan.code}`} name="exportLimit" type="number" min={0} defaultValue={plan.exportLimit ?? ""} />
            </Field>
            <Field label={copy.billingInterval} htmlFor={`interval-${plan.code}`}>
              <Select id={`interval-${plan.code}`} name="billingInterval" defaultValue={plan.billingInterval}>
                <option value="month">{copy.monthly}</option>
                <option value="year">{copy.yearly}</option>
              </Select>
            </Field>
            <Field label={copy.status} htmlFor={`active-${plan.code}`}>
              <Select id={`active-${plan.code}`} name="isActive" defaultValue={String(plan.isActive)}>
                <option value="true">{copy.active}</option>
                <option value="false">{copy.inactive}</option>
              </Select>
            </Field>
          </div>

          <Field label={copy.description} htmlFor={`desc-${plan.code}`}>
            <Input id={`desc-${plan.code}`} name="description" defaultValue={plan.description} maxLength={500} />
          </Field>

          <fieldset className="rounded-xl border border-black/8 bg-white p-3">
            <legend className="px-1 text-[0.68rem] font-bold uppercase tracking-[0.08em] text-[#151c19]/55">
              {copy.features}
            </legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((feature) => {
                const grant = grants.get(feature.code);
                return (
                  <div key={feature.id} className="rounded-lg border border-black/8 px-2.5 py-2">
                    <label className="flex items-start gap-2 text-xs font-semibold text-[#151c19]">
                      <input
                        type="checkbox"
                        name={`feature_${feature.code}`}
                        defaultChecked={grant?.included ?? false}
                        className="mt-0.5 h-3.5 w-3.5 rounded border-black/20"
                      />
                      <span>
                        {feature.name}
                        <span className="block font-mono text-[0.55rem] font-normal text-[#151c19]/35">{feature.code}</span>
                      </span>
                    </label>
                    <label className="mt-1.5 block text-[0.6rem] text-[#151c19]/50">
                      {copy.featureLimit}
                      <input
                        type="number"
                        name={`limit_${feature.code}`}
                        min={0}
                        defaultValue={grant?.limit ?? ""}
                        className="mt-0.5 h-7 w-full rounded-md border border-black/10 bg-white px-2 text-[0.68rem]"
                      />
                    </label>
                  </div>
                );
              })}
            </div>
          </fieldset>

          <Button type="submit" size="sm" disabled={pending}>
            <Save className="h-4 w-4" aria-hidden />
            {pending ? dict.common.saving : copy.savePlan}
          </Button>
        </form>
      ) : null}
    </article>
  );
}
