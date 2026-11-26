"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { useI18n } from "@/components/layout/i18n-provider";
import { initialFormState } from "@/lib/action-utils";
import { createPlatformAdminAction } from "@/app/[locale]/admin/actions";

export function CreatePlatformAdminForm() {
  const { locale, dict } = useI18n();
  const copy = dict.admin;
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState(createPlatformAdminAction, initialFormState);

  useEffect(() => {
    if (state.status === "success") {
      formRef.current?.reset();
      router.refresh();
    }
  }, [state, router]);

  return (
    <form
      ref={formRef}
      action={action}
      className="rounded-2xl border border-black/8 bg-white p-4"
      noValidate
    >
      <h2 className="flex items-center gap-2 text-sm font-extrabold text-[#151c19]">
        <UserPlus className="h-4 w-4 text-[#3f6b52]" aria-hidden />
        {copy.createAdmin}
      </h2>
      <p className="mt-1 text-xs text-[#151c19]/50">{copy.adminsLead}</p>

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

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Field label={copy.fullName} htmlFor="admin-full-name" error={state.fieldErrors?.fullName?.[0]}>
          <Input id="admin-full-name" name="fullName" required maxLength={120} autoComplete="name" />
        </Field>
        <Field label={copy.email} htmlFor="admin-email" error={state.fieldErrors?.email?.[0]}>
          <Input id="admin-email" name="email" type="email" required autoComplete="off" />
        </Field>
        <Field
          label={copy.temporaryPassword}
          htmlFor="admin-password"
          hint={copy.passwordHint}
          error={state.fieldErrors?.password?.[0]}
        >
          <Input
            id="admin-password"
            name="password"
            type="password"
            required
            minLength={10}
            maxLength={72}
            autoComplete="new-password"
          />
        </Field>
        <Field label={copy.role} htmlFor="admin-role" error={state.fieldErrors?.role?.[0]}>
          <Select id="admin-role" name="role" defaultValue="admin">
            <option value="admin">{copy.admin}</option>
            <option value="support">{copy.support}</option>
            <option value="super_admin">{copy.superAdmin}</option>
          </Select>
        </Field>
      </div>

      <Button type="submit" size="sm" className="mt-3" disabled={pending}>
        {pending ? dict.common.saving : copy.create}
      </Button>
    </form>
  );
}
