"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PiggyBank, Plus } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { useI18n } from "@/components/layout/i18n-provider";
import { initialFormState } from "@/lib/action-utils";
import { createGoalAction, updateGoalAction } from "@/app/[locale]/(dashboard)/finance/actions";

export function NewGoalForm({ currency }: { currency: string }) {
  const { locale, dict } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(createGoalAction, initialFormState);

  useEffect(() => {
    if (state.status === "success") router.refresh();
  }, [state.status, router]);

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} variant="secondary" size="md">
        <Plus className="h-4 w-4" aria-hidden />
        {dict.finance.goals.new}
      </Button>
    );
  }

  return (
    <form action={action} className="surface w-full p-5 sm:max-w-xl" noValidate>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-heading">{dict.finance.goals.new}</h2>
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
        <Field label={dict.finance.goals.name} htmlFor="goal-name" error={state.fieldErrors?.name?.[0]}>
          <Input id="goal-name" name="name" required maxLength={120} autoComplete="off" />
        </Field>
        <Field label={dict.finance.goals.target} htmlFor="goal-target" hint={currency} error={state.fieldErrors?.target?.[0]}>
          <Input id="goal-target" name="target" inputMode="decimal" required autoComplete="off" placeholder="0" />
        </Field>
        <Field label={dict.finance.goals.targetDate} htmlFor="goal-date">
          <Input id="goal-date" name="targetDate" type="date" />
        </Field>
        <Field label={dict.common.notes} htmlFor="goal-notes" className="sm:col-span-2">
          <Textarea id="goal-notes" name="notes" rows={2} maxLength={1000} />
        </Field>
      </div>

      <Button type="submit" className="mt-4 w-full" disabled={pending}>
        <PiggyBank className="h-4 w-4" aria-hidden />
        {pending ? dict.common.saving : dict.finance.goals.new}
      </Button>
    </form>
  );
}

export function GoalProgressForm({ goalId, saved }: { goalId: string; saved: string }) {
  const { locale, dict } = useI18n();
  const router = useRouter();
  const [state, action, pending] = useActionState(updateGoalAction, initialFormState);

  useEffect(() => {
    if (state.status === "success") router.refresh();
  }, [state.status, router]);

  return (
    <form action={action} className="mt-3 flex flex-wrap items-end gap-2" noValidate>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="goalId" value={goalId} />
      <div className="min-w-0 flex-1">
        <label htmlFor={`goal-saved-${goalId}`} className="mb-1 block text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-muted">
          {dict.finance.goals.saved}
        </label>
        <Input id={`goal-saved-${goalId}`} name="saved" inputMode="decimal" required defaultValue={saved} autoComplete="off" className="h-9" />
      </div>
      <Button type="submit" size="sm" variant="secondary" disabled={pending}>
        <PiggyBank className="h-3.5 w-3.5" aria-hidden />
        {pending ? dict.common.saving : dict.finance.goals.addFunds}
      </Button>
      {state.status === "error" && state.message ? (
        <p className="w-full text-xs font-medium text-danger" role="alert">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
