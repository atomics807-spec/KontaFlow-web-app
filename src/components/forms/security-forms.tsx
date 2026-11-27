"use client";

import { useActionState } from "react";
import { Alert } from "@/components/ui/alert";
import { Field, Input, Textarea } from "@/components/ui/input";
import { SubmitButton } from "@/components/forms/submit-button";
import { useI18n } from "@/components/layout/i18n-provider";
import { initialFormState } from "@/lib/action-utils";
import {
  cancelAccountDeletionAction,
  changePasswordAction,
  requestAccountDeletionAction,
  sendRecoveryEmailAction,
  signOutEverywhereAction,
  signOutOtherSessionsAction,
  updateMarketingConsentAction,
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

export function AccountDataExportLink() {
  const { dict } = useI18n();
  return (
    <div className="space-y-2">
      <a
        href="/api/privacy/export"
        download
        className="inline-flex h-9 items-center justify-center rounded-xl border border-line bg-panel px-3.5 text-sm font-semibold text-ink transition hover:border-accent-strong hover:text-heading"
      >
        {dict.identity.privacyExport}
      </a>
      <p className="text-xs leading-relaxed text-muted">{dict.identity.privacyExportHint}</p>
    </div>
  );
}

export function DeletionRequestForm({
  request,
}: {
  request: { id: string; status: string; requested_at: string } | null;
}) {
  const { locale, dict } = useI18n();
  const [requestState, requestAction] = useActionState(requestAccountDeletionAction, initialFormState);
  const [cancelState, cancelAction] = useActionState(cancelAccountDeletionAction, initialFormState);

  return (
    <div className="space-y-3">
      <p className="text-xs leading-relaxed text-muted">{dict.identity.privacyDeleteHint}</p>
      <p className="rounded-xl border border-line bg-panel px-3.5 py-3 text-xs leading-relaxed text-muted">
        {dict.identity.privacyDataNote}
      </p>

      {request ? (
        <div className="space-y-3">
          <div className="rounded-xl border border-mango/40 bg-mango/10 px-3.5 py-3">
            <p className="text-sm font-semibold text-heading">{dict.identity.privacyDeletePending}</p>
            <p className="mt-1 text-xs text-muted">
              {dict.identity.privacyDeleteStatus}: {request.status}
            </p>
          </div>
          <StateAlert state={cancelState} />
          <form action={cancelAction}>
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="requestId" value={request.id} />
            <SubmitButton variant="secondary" size="sm" pendingLabel={dict.common.loading}>
              {dict.identity.privacyDeleteCancel}
            </SubmitButton>
          </form>
        </div>
      ) : (
        <form action={requestAction} className="space-y-3">
          <input type="hidden" name="locale" value={locale} />
          <StateAlert state={requestState} />
          <Field label={dict.identity.privacyDeleteReason} htmlFor="deletionReason">
            <Textarea id="deletionReason" name="reason" maxLength={2000} rows={3} />
          </Field>
          <SubmitButton variant="danger" size="sm" pendingLabel={dict.common.loading}>
            {dict.identity.privacyDeleteSubmit}
          </SubmitButton>
        </form>
      )}
    </div>
  );
}

export function MarketingConsentForm({ optedIn }: { optedIn: boolean }) {
  const { locale, dict } = useI18n();
  const [state, action] = useActionState(updateMarketingConsentAction, initialFormState);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="locale" value={locale} />
      <StateAlert state={state} />
      <label className="flex items-start gap-2.5 text-sm text-ink">
        <input
          type="checkbox"
          name="marketing"
          defaultChecked={optedIn}
          className="mt-0.5 h-4 w-4 rounded border-line text-accent-strong focus:ring-accent-strong/30"
        />
        <span>
          <span className="font-semibold text-heading">{dict.identity.privacyMarketingLabel}</span>
          <span className="mt-0.5 block text-xs leading-relaxed text-muted">
            {dict.identity.privacyMarketingHint}
          </span>
        </span>
      </label>
      <SubmitButton variant="secondary" size="sm" pendingLabel={dict.common.saving}>
        {dict.common.save}
      </SubmitButton>
    </form>
  );
}
