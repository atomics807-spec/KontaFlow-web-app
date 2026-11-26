"use client";

import { useActionState } from "react";
import { Alert } from "@/components/ui/alert";
import { Field, Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/forms/submit-button";
import { useI18n } from "@/components/layout/i18n-provider";
import { initialFormState } from "@/lib/action-utils";
import {
  changePasswordAction,
  sendRecoveryEmailAction,
  signOutEverywhereAction,
  signOutOtherSessionsAction,
} from "@/app/[locale]/(dashboard)/settings/security/actions";

function StateAlert({ state }: { state: { status: string; message?: string } }) {
  if (!state.message || state.status === "idle") return null;
  return (
    <Alert tone={state.status === "error" ? "error" : "success"} className="mb-4">
      {state.message}
    </Alert>
  );
}

export function ChangePasswordForm() {
  const { locale, dict } = useI18n();
  const [state, action] = useActionState(changePasswordAction, initialFormState);

  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="locale" value={locale} />
      <StateAlert state={state} />

      <Field
        label={dict.identity.currentPassword}
        htmlFor="current"
        error={state.fieldErrors?.current?.[0]}
      >
        <Input
          id="current"
          name="current"
          type="password"
          autoComplete="current-password"
          required
          aria-invalid={Boolean(state.fieldErrors?.current)}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={dict.auth.newPassword} htmlFor="newPassword" hint={dict.auth.passwordHint} error={state.fieldErrors?.password?.[0]}>
          <Input
            id="newPassword"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={10}
            required
            aria-invalid={Boolean(state.fieldErrors?.password)}
          />
        </Field>
        <Field label={dict.auth.confirmPassword} htmlFor="confirmPassword" error={state.fieldErrors?.confirm?.[0]}>
          <Input
            id="confirmPassword"
            name="confirm"
            type="password"
            autoComplete="new-password"
            minLength={10}
            required
            aria-invalid={Boolean(state.fieldErrors?.confirm)}
          />
        </Field>
      </div>

      <SubmitButton pendingLabel={dict.common.saving}>{dict.identity.changePassword}</SubmitButton>
    </form>
  );
}

export function SessionActions() {
  const { locale, dict } = useI18n();
  const [state, action] = useActionState(signOutOtherSessionsAction, initialFormState);

  return (
    <div className="space-y-4">
      <StateAlert state={state} />
      <p className="text-xs leading-relaxed text-muted">{dict.identity.sessionsHint}</p>
      <div className="flex flex-wrap gap-2">
        <form action={action}>
          <input type="hidden" name="locale" value={locale} />
          <SubmitButton variant="secondary" size="sm" pendingLabel={dict.common.loading}>
            {dict.identity.signOutOthers}
          </SubmitButton>
        </form>
        <form action={signOutEverywhereAction}>
          <input type="hidden" name="locale" value={locale} />
          <SubmitButton variant="danger" size="sm" pendingLabel={dict.common.loading}>
            {dict.identity.signOutEverywhere}
          </SubmitButton>
        </form>
      </div>
    </div>
  );
}

export function RecoveryForm() {
  const { locale, dict } = useI18n();
  const [state, action] = useActionState(sendRecoveryEmailAction, initialFormState);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="locale" value={locale} />
      <StateAlert state={state} />
      <p className="text-xs leading-relaxed text-muted">{dict.identity.recoveryHint}</p>
      <SubmitButton variant="secondary" size="sm" pendingLabel={dict.common.loading}>
        {dict.identity.sendRecovery}
      </SubmitButton>
    </form>
  );
}
