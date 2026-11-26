"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Alert } from "@/components/ui/alert";
import { Field, Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/forms/submit-button";
import { fill, useI18n } from "@/components/layout/i18n-provider";
import { initialFormState } from "@/lib/action-utils";
import {
  requestPasswordResetAction,
  signInAction,
  signUpAction,
  updatePasswordAction,
} from "@/app/[locale]/(auth)/actions";

function FormAlert({ state }: { state: { status: string; message?: string } }) {
  if (!state.message || state.status === "idle") return null;
  return (
    <Alert tone={state.status === "error" ? "error" : "success"} className="mb-5">
      {state.message}
    </Alert>
  );
}

export function LoginForm({ next }: { next: string }) {
  const { locale, dict } = useI18n();
  const [state, action] = useActionState(signInAction, initialFormState);

  return (
    <div>
      <h1 className="text-2xl font-extrabold tracking-tight text-heading">{dict.auth.signInTitle}</h1>
      <p className="mt-2 text-sm text-muted">{dict.auth.signInSubtitle}</p>

      <form action={action} className="mt-7 space-y-4" noValidate>
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="next" value={next} />
        <FormAlert state={state} />

        <Field label={dict.auth.email} htmlFor="email" error={state.fieldErrors?.email?.[0]}>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            required
            placeholder="you@business.cm"
            aria-invalid={Boolean(state.fieldErrors?.email)}
          />
        </Field>

        <Field label={dict.auth.password} htmlFor="password" error={state.fieldErrors?.password?.[0]}>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            placeholder="••••••••"
            aria-invalid={Boolean(state.fieldErrors?.password)}
          />
        </Field>

        <div className="flex items-center justify-between">
          <Link
            href={`/${locale}/forgot-password`}
            className="text-sm font-semibold text-accent hover:underline"
          >
            {dict.auth.forgotPassword}
          </Link>
        </div>

        <SubmitButton className="w-full" size="lg" pendingLabel={dict.common.loading}>
          {dict.auth.signIn}
        </SubmitButton>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        {dict.auth.noAccount}{" "}
        <Link href={`/${locale}/signup`} className="font-semibold text-accent hover:underline">
          {dict.auth.createOne}
        </Link>
      </p>
    </div>
  );
}

export function SignupForm({ next }: { next: string }) {
  const { locale, dict } = useI18n();
  const [state, action] = useActionState(signUpAction, initialFormState);

  return (
    <div>
      <h1 className="text-2xl font-extrabold tracking-tight text-heading">{dict.auth.signUpTitle}</h1>
      <p className="mt-2 text-sm text-muted">{dict.auth.signUpSubtitle}</p>

      <form action={action} className="mt-7 space-y-4" noValidate>
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="next" value={next} />
        <FormAlert state={state} />

        <Field label={dict.auth.fullName} htmlFor="fullName" error={state.fieldErrors?.fullName?.[0]}>
          <Input
            id="fullName"
            name="fullName"
            autoComplete="name"
            required
            placeholder={dict.auth.fullNamePlaceholder}
            aria-invalid={Boolean(state.fieldErrors?.fullName)}
          />
        </Field>

        <Field label={dict.auth.email} htmlFor="email" error={state.fieldErrors?.email?.[0]}>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            required
            placeholder="you@business.cm"
            aria-invalid={Boolean(state.fieldErrors?.email)}
          />
        </Field>

        <Field
          label={dict.auth.password}
          htmlFor="password"
          hint={dict.auth.passwordHint}
          error={state.fieldErrors?.password?.[0]}
        >
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            placeholder="••••••••"
            aria-invalid={Boolean(state.fieldErrors?.password)}
          />
        </Field>

        <SubmitButton className="w-full" size="lg" pendingLabel={dict.common.loading}>
          {dict.auth.signUp}
        </SubmitButton>
      </form>

      <p className="mt-4 text-xs leading-relaxed text-muted">{dict.auth.termsNote}</p>

      <p className="mt-6 text-center text-sm text-muted">
        {dict.auth.haveAccount}{" "}
        <Link href={`/${locale}/login`} className="font-semibold text-accent hover:underline">
          {dict.auth.signIn}
        </Link>
      </p>
    </div>
  );
}

export function ForgotForm() {
  const { locale, dict } = useI18n();
  const [state, action] = useActionState(requestPasswordResetAction, initialFormState);

  return (
    <div>
      <h1 className="text-2xl font-extrabold tracking-tight text-heading">{dict.auth.resetPassword}</h1>
      <p className="mt-2 text-sm text-muted">{dict.auth.forgotSubtitle}</p>

      <form action={action} className="mt-7 space-y-4" noValidate>
        <input type="hidden" name="locale" value={locale} />
        <FormAlert state={state} />

        <Field label={dict.auth.email} htmlFor="email" error={state.fieldErrors?.email?.[0]}>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="you@business.cm"
          />
        </Field>

        <SubmitButton className="w-full" size="lg" pendingLabel={dict.common.loading}>
          {dict.auth.sendResetLink}
        </SubmitButton>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        <Link href={`/${locale}/login`} className="font-semibold text-accent hover:underline">
          {dict.auth.backToSignIn}
        </Link>
      </p>
    </div>
  );
}

export function ResetForm() {
  const { locale, dict } = useI18n();
  const [state, action] = useActionState(updatePasswordAction, initialFormState);
  const done = state.status === "success";

  return (
    <div>
      <h1 className="text-2xl font-extrabold tracking-tight text-heading">{dict.auth.newPassword}</h1>
      <p className="mt-2 text-sm text-muted">{fill(dict.auth.resetSubtitle, { email: "your account" })}</p>

      <form action={action} className="mt-7 space-y-4" noValidate>
        <input type="hidden" name="locale" value={locale} />
        <FormAlert state={state} />

        <Field label={dict.auth.newPassword} htmlFor="password" error={state.fieldErrors?.password?.[0]} hint={dict.auth.passwordHint}>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
          />
        </Field>

        <Field label={dict.auth.confirmPassword} htmlFor="confirm" error={state.fieldErrors?.confirm?.[0]}>
          <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required minLength={8} />
        </Field>

        <SubmitButton className="w-full" size="lg" pendingLabel={dict.common.loading}>
          {dict.auth.updatePassword}
        </SubmitButton>
      </form>

      {done ? (
        <p className="mt-6 text-center text-sm">
          <Link href={`/${locale}/dashboard`} className="font-semibold text-accent hover:underline">
            {dict.nav.overview}
          </Link>
        </p>
      ) : null}
    </div>
  );
}
