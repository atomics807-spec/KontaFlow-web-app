"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { useI18n } from "@/components/layout/i18n-provider";
import { initialFormState } from "@/lib/action-utils";
import { inviteMemberAction } from "@/app/[locale]/(dashboard)/team/actions";

export function InviteMemberForm() {
  const { locale, dict } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(inviteMemberAction, initialFormState);

  useEffect(() => {
    if (state.status === "success") router.refresh();
  }, [state, router]);

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} size="md">
        <UserPlus className="h-4 w-4" aria-hidden />
        {dict.settings.invite}
      </Button>
    );
  }

  return (
    <form action={action} className="surface w-full space-y-3 p-5 sm:max-w-md" noValidate>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-heading">{dict.settings.invite}</h2>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs font-semibold text-muted hover:text-heading"
        >
          {dict.common.close}
        </button>
      </div>

      <input type="hidden" name="locale" value={locale} />

      {state.status === "error" && state.message ? <Alert tone="error">{state.message}</Alert> : null}
      {state.status === "success" && state.message ? (
        <Alert tone="success">
          <span className="break-all">{state.message}</span>
        </Alert>
      ) : null}

      <Field label={dict.settings.inviteEmail} htmlFor="invite-email">
        <Input id="invite-email" name="email" type="email" required autoComplete="email" />
      </Field>

      <Field label={dict.settings.role} htmlFor="invite-role">
        <Select id="invite-role" name="role" defaultValue="accountant">
          <option value="admin">{dict.roles.admin}</option>
          <option value="accountant">{dict.roles.accountant}</option>
          <option value="manager">{dict.roles.manager}</option>
          <option value="staff">{dict.roles.staff}</option>
        </Select>
      </Field>

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? dict.common.saving : dict.settings.invite}
      </Button>
    </form>
  );
}
