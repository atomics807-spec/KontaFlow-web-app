"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, UserPlus } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { useI18n } from "@/components/layout/i18n-provider";
import { initialFormState } from "@/lib/action-utils";
import { createContactAction } from "@/app/[locale]/(dashboard)/contacts/actions";

export function NewContactForm() {
  const { locale, dict } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [state, action, pending] = useActionState(createContactAction, initialFormState);

  useEffect(() => {
    if (state.status === "success") router.refresh();
  }, [state.status, router]);

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} size="md">
        <Plus className="h-4 w-4" aria-hidden />
        {dict.contacts.new}
      </Button>
    );
  }

  return (
    <form key={`${formKey}-${state.status}`} action={action} className="surface w-full p-5 sm:max-w-md" noValidate>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-heading">{dict.contacts.new}</h2>
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
      {state.status === "success" ? (
        <div className="mt-3 space-y-2">
          <Alert tone="success">{state.message}</Alert>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setFormKey((value) => value + 1)}
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
            {dict.contacts.new}
          </Button>
        </div>
      ) : null}

      <div className="mt-4 space-y-3">
        <Field label={dict.contacts.name} htmlFor="contact-name" error={state.fieldErrors?.name?.[0]}>
          <Input id="contact-name" name="name" required maxLength={160} autoComplete="off" />
        </Field>

        <Field label={dict.contacts.customer} htmlFor="contact-kind">
          <Select id="contact-kind" name="kind" defaultValue="customer">
            <option value="customer">{dict.contacts.customer}</option>
            <option value="supplier">{dict.contacts.supplier}</option>
            <option value="both">{dict.contacts.both}</option>
          </Select>
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={dict.contacts.phone} htmlFor="contact-phone">
            <Input id="contact-phone" name="phone" type="tel" inputMode="tel" maxLength={24} autoComplete="tel" />
          </Field>
          <Field label={dict.contacts.email} htmlFor="contact-email">
            <Input id="contact-email" name="email" type="email" maxLength={160} autoComplete="email" />
          </Field>
        </div>

        <Field label={dict.contacts.address} htmlFor="contact-address">
          <Input id="contact-address" name="address" maxLength={240} autoComplete="street-address" />
        </Field>

        <Field label={dict.contacts.taxId} htmlFor="contact-tax">
          <Input id="contact-tax" name="taxId" maxLength={60} />
        </Field>

        <Field label={dict.common.notes} htmlFor="contact-notes">
          <Textarea id="contact-notes" name="notes" rows={2} maxLength={1000} />
        </Field>

        <Button type="submit" className="w-full" disabled={pending}>
          <UserPlus className="h-4 w-4" aria-hidden />
          {pending ? dict.common.saving : dict.contacts.save}
        </Button>
      </div>
    </form>
  );
}
