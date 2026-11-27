"use client";

import { useActionState, useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Field, Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/forms/submit-button";
import { useI18n } from "@/components/layout/i18n-provider";
import { initialFormState } from "@/lib/action-utils";
import { resendEmailVerificationAction } from "@/app/[locale]/(auth)/actions";
import {
  sendPhoneCodeAction,
  verifyPhoneCodeAction,
} from "@/app/[locale]/(auth)/verify-phone/actions";

function StateAlert({ state }: { state: { status: string; message?: string } }) {
  if (!state.message || state.status === "idle") return null;
  return (
    <Alert tone={state.status === "error" ? "error" : "success"} className="mb-4">
      {state.message}
    </Alert>
  );
}

export function ResendEmailForm({ email }: { email: string }) {
  const { locale, dict } = useI18n();
  const [state, action] = useActionState(resendEmailVerificationAction, initialFormState);

  return (
    <div>
      <StateAlert state={state} />
      <form action={action} className="space-y-4">
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="email" value={email} />
        <SubmitButton className="w-full" size="lg" pendingLabel={dict.common.loading}>
          {dict.identity.resendEmail}
        </SubmitButton>
      </form>
    </div>
  );
}

export function PhoneVerificationForm({ next, phone }: { next: string; phone: string }) {
  const { locale, dict } = useI18n();
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [sendState, sendAction, sending] = useActionState(
    async (previous: typeof initialFormState, formData: FormData) => {
      const result = await sendPhoneCodeAction(previous, formData);
      if (result.status === "success") setCooldownUntil(Date.now() + 60_000);
      return result;
    },
    initialFormState,
  );
  const [verifyState, verifyAction] = useActionState(verifyPhoneCodeAction, initialFormState);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const seconds = Math.max(0, Math.ceil((cooldownUntil - now) / 1000));

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 rounded-xl border border-line bg-panel px-3 py-2 text-sm text-muted">
        <ShieldCheck className="h-4 w-4 text-accent-strong" aria-hidden />
        <span>{phone}</span>
      </div>

      <StateAlert state={sendState} />
      <StateAlert state={verifyState} />

      <form action={sendAction}>
        <input type="hidden" name="locale" value={locale} />
        <SubmitButton
          type="submit"
          variant="secondary"
          className="w-full"
          pendingLabel={dict.common.loading}
          disabled={sending || seconds > 0}
        >
          {seconds > 0 ? `${dict.identity.resendCode} (${seconds}s)` : dict.identity.sendCode}
        </SubmitButton>
      </form>

      <form action={verifyAction} className="space-y-4">
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="next" value={next} />
        <Field
          label={dict.identity.codeLabel}
          htmlFor="code"
          hint={dict.identity.codeHint}
          error={verifyState.fieldErrors?.code?.[0]}
        >
          <Input
            id="code"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            required
            placeholder="000000"
            className="text-center font-mono text-xl tracking-[0.4em]"
            aria-invalid={Boolean(verifyState.fieldErrors?.code)}
          />
        </Field>
        <SubmitButton className="w-full" size="lg" pendingLabel={dict.common.loading}>
          {dict.identity.verifyCode}
        </SubmitButton>
      </form>
    </div>
  );
}
