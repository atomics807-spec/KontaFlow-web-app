"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Landmark, Plus } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { useI18n } from "@/components/layout/i18n-provider";
import { initialFormState } from "@/lib/action-utils";
import { createAccountAction } from "@/app/[locale]/(dashboard)/finance/actions";

export function NewAccountForm({ currency }: { currency: string }) {
  const { locale, dict } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(createAccountAction, initialFormState);

  useEffect(() => {
    if (state.status === "success") router.refresh();
  }, [state.status, router]);

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} size="md">
        <Plus className="h-4 w-4" aria-hidden />
        {dict.finance.accounts.new}
      </Button>
    );
  }

  return (
    <form action={action} className="surface w-full p-5 sm:max-w-md" noValidate>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-heading">{dict.finance.accounts.new}</h2>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs font-semibold text-muted hover:text-heading"
        >
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

      <div className="mt-4 space-y-3">
        <Field label={dict.finance.accounts.name} htmlFor="account-name" error={state.fieldErrors?.name?.[0]}>
          <Input id="account-name" name="name" required maxLength={120} autoComplete="off" />
        </Field>
        <Field label={dict.finance.accounts.type} htmlFor="account-subtype">
          <Select id="account-subtype" name="subtype" defaultValue="cash">
            <option value="cash">{dict.finance.accounts.cash}</option>
            <option value="bank">{dict.finance.accounts.bank}</option>
            <option value="mobile_money">{dict.finance.accounts.mobileMoney}</option>
          </Select>
        </Field>
        <Field label={dict.finance.accounts.institution} htmlFor="account-institution">
          <Input id="account-institution" name="institution" maxLength={120} autoComplete="organization" />
        </Field>
        <Field
          label={dict.finance.accounts.openingBalance}
          htmlFor="account-opening"
          hint={`${currency} · ${dict.finance.accounts.openingBalanceHint}`}
        >
          <Input id="account-opening" name="openingBalance" inputMode="decimal" autoComplete="off" placeholder="0" />
        </Field>

        <Button type="submit" className="w-full" disabled={pending}>
          <Landmark className="h-4 w-4" aria-hidden />
          {pending ? dict.common.saving : dict.finance.accounts.new}
        </Button>
      </div>
    </form>
  );
}
