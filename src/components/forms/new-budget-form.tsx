"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Target } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { useI18n } from "@/components/layout/i18n-provider";
import { initialFormState } from "@/lib/action-utils";
import { createBudgetAction } from "@/app/[locale]/(dashboard)/finance/actions";
import type { CategoryRow } from "@/types/database";

export function NewBudgetForm({
  categories,
  defaultStart,
  defaultEnd,
  currency,
}: {
  categories: CategoryRow[];
  defaultStart: string;
  defaultEnd: string;
  currency: string;
}) {
  const { locale, dict } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(createBudgetAction, initialFormState);

  useEffect(() => {
    if (state.status === "success") router.refresh();
  }, [state.status, router]);

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} size="md">
        <Plus className="h-4 w-4" aria-hidden />
        {dict.finance.budgets.new}
      </Button>
    );
  }

  return (
    <form action={action} className="surface w-full p-5 sm:max-w-xl" noValidate>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-heading">{dict.finance.budgets.new}</h2>
        <button type="button" onClick={() => setOpen(false)} className="text-xs font-semibold text-muted hover:text-heading">
          {dict.common.cancel}
        </button>
      </div>

      <input type="hidden" name="locale" value={locale} />

      {state.status === "error" && state.message ? (
        <Alert tone="error" className="mt-3">
          {state.message}
        </Alert>
      ) : null}
      {state.status === "success" && state.message ? (
        <Alert tone="success" className="mt-3">
          {state.message}
        </Alert>
      ) : null}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Field label={dict.finance.budgets.name} htmlFor="budget-name" error={state.fieldErrors?.name?.[0]}>
          <Input id="budget-name" name="name" required maxLength={120} autoComplete="off" />
        </Field>
        <Field label={dict.finance.budgets.category} htmlFor="budget-category">
          <Select id="budget-category" name="categoryId" defaultValue="">
            <option value="">{dict.finance.budgets.allExpenses}</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={dict.finance.budgets.periodStart} htmlFor="budget-start">
          <Input id="budget-start" name="periodStart" type="date" required defaultValue={defaultStart} />
        </Field>
        <Field label={dict.finance.budgets.periodEnd} htmlFor="budget-end" error={state.fieldErrors?.periodEnd?.[0]}>
          <Input id="budget-end" name="periodEnd" type="date" required defaultValue={defaultEnd} />
        </Field>
        <Field
          label={dict.finance.budgets.amount}
          htmlFor="budget-amount"
          hint={currency}
          error={state.fieldErrors?.amount?.[0]}
        >
          <Input id="budget-amount" name="amount" inputMode="decimal" required autoComplete="off" placeholder="0" />
        </Field>
        <Field label={dict.finance.budgets.alertThreshold} htmlFor="budget-threshold">
          <Select id="budget-threshold" name="alertThresholdBp" defaultValue="8000">
            <option value="5000">{dict.finance.budgets.threshold50}</option>
            <option value="8000">{dict.finance.budgets.threshold80}</option>
            <option value="10000">{dict.finance.budgets.threshold100}</option>
          </Select>
        </Field>
      </div>

      <Button type="submit" className="mt-4 w-full" disabled={pending}>
        <Target className="h-4 w-4" aria-hidden />
        {pending ? dict.common.saving : dict.finance.budgets.new}
      </Button>
    </form>
  );
}
