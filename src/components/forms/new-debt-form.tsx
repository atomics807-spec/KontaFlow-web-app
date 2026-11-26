"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, ReceiptText } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { useI18n } from "@/components/layout/i18n-provider";
import { initialFormState } from "@/lib/action-utils";
import { createDebtAction } from "@/app/[locale]/(dashboard)/finance/actions";
import type { ContactRow } from "@/types/database";

export function NewDebtForm({
  contacts,
  today,
  currency,
}: {
  contacts: ContactRow[];
  today: string;
  currency: string;
}) {
  const { locale, dict } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [direction, setDirection] = useState<"receivable" | "payable">("receivable");
  const [state, action, pending] = useActionState(createDebtAction, initialFormState);

  const visibleContacts = useMemo(
    () =>
      contacts.filter((contact) =>
        direction === "receivable"
          ? contact.kind === "customer" || contact.kind === "both"
          : contact.kind === "supplier" || contact.kind === "both",
      ),
    [contacts, direction],
  );

  useEffect(() => {
    if (state.status === "success") router.refresh();
  }, [state.status, router]);

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} size="md">
        <Plus className="h-4 w-4" aria-hidden />
        {dict.finance.debts.new}
      </Button>
    );
  }

  return (
    <form action={action} className="surface w-full p-5 sm:max-w-xl" noValidate>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-heading">{dict.finance.debts.new}</h2>
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

      {visibleContacts.length === 0 ? (
        <Alert tone="warning" className="mt-3">
          {dict.finance.invoices.customerRequired}{" "}
          <Link href={`/${locale}/contacts`} className="font-semibold underline">
            {dict.nav.contacts}
          </Link>
        </Alert>
      ) : null}

      <div className="mt-4 space-y-3">
        <Field label={dict.finance.debts.direction} htmlFor="debt-direction">
          <Select
            id="debt-direction"
            name="direction"
            value={direction}
            onChange={(event) => setDirection(event.target.value as typeof direction)}
          >
            <option value="receivable">{dict.finance.debts.receivable}</option>
            <option value="payable">{dict.finance.debts.payable}</option>
          </Select>
        </Field>

        <Field label={dict.finance.debts.contact} htmlFor="debt-contact" error={state.fieldErrors?.contactId?.[0]}>
          <Select id="debt-contact" name="contactId" required defaultValue="">
            <option value="" disabled>
              {dict.finance.debts.selectContact}
            </option>
            {visibleContacts.map((contact) => (
              <option key={contact.id} value={contact.id}>
                {contact.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label={dict.finance.debts.description} htmlFor="debt-description" error={state.fieldErrors?.description?.[0]}>
          <Textarea id="debt-description" name="description" required maxLength={300} rows={2} />
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label={dict.finance.debts.principal}
            htmlFor="debt-principal"
            hint={currency}
            error={state.fieldErrors?.principal?.[0]}
          >
            <Input id="debt-principal" name="principal" inputMode="decimal" required autoComplete="off" placeholder="0" />
          </Field>
          <Field label={dict.finance.debts.dueOn} htmlFor="debt-due" error={state.fieldErrors?.dueOn?.[0]}>
            <Input id="debt-due" name="dueOn" type="date" min={today} />
          </Field>
        </div>

        <Field label={dict.finance.debts.openedOn} htmlFor="debt-opened">
          <Input id="debt-opened" name="openedOn" type="date" required defaultValue={today} max={today} />
        </Field>

        <Field label={dict.finance.debts.notes} htmlFor="debt-notes">
          <Textarea id="debt-notes" name="notes" rows={2} maxLength={1000} />
        </Field>

        <Button type="submit" className="w-full" disabled={pending || visibleContacts.length === 0}>
          <ReceiptText className="h-4 w-4" aria-hidden />
          {pending ? dict.common.saving : dict.finance.debts.new}
        </Button>
      </div>
    </form>
  );
}
