"use client";

import { useActionState } from "react";
import { ArrowRight, Building2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Field, Input, Select } from "@/components/ui/input";
import { SubmitButton } from "@/components/forms/submit-button";
import { useI18n } from "@/components/layout/i18n-provider";
import { initialFormState } from "@/lib/action-utils";
import { CURRENCY_OPTIONS, SUPPORTED_CURRENCIES } from "@/lib/currency";
import { LOCALES, LOCALE_META } from "@/lib/i18n/config";
import { createWorkspaceAction } from "@/app/[locale]/onboarding/actions";

const COUNTRIES = [
  { code: "CM", label: "Cameroon" },
  { code: "CI", label: "Côte d'Ivoire" },
  { code: "SN", label: "Sénégal" },
  { code: "GA", label: "Gabon" },
  { code: "NG", label: "Nigeria" },
  { code: "GH", label: "Ghana" },
  { code: "KE", label: "Kenya" },
];

const TIMEZONES = ["Africa/Douala", "Africa/Lagos", "Africa/Accra", "Africa/Nairobi", "Africa/Abidjan", "Europe/Paris", "UTC"];

export function OnboardingForm({ email }: { email: string }) {
  const { locale, dict } = useI18n();
  const [state, action] = useActionState(createWorkspaceAction, initialFormState);

  return (
    <div className="w-full max-w-xl">
      <span className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-3 py-1.5 text-xs font-semibold text-muted">
        <Building2 className="h-3.5 w-3.5 text-jade-600" aria-hidden />
        {email}
      </span>

      <h1 className="mt-5 text-balance text-3xl font-extrabold tracking-tight text-forest sm:text-4xl">
        {dict.onboarding.title}
      </h1>
      <p className="mt-3 text-balance text-sm leading-relaxed text-muted sm:text-base">
        {dict.onboarding.subtitle}
      </p>

      <form action={action} className="mt-8 space-y-4" noValidate>
        <input type="hidden" name="locale" value={locale} />
        {state.status === "error" && state.message ? <Alert tone="error">{state.message}</Alert> : null}

        <Field label={dict.onboarding.businessName} htmlFor="name" error={state.fieldErrors?.name?.[0]}>
          <Input id="name" name="name" required maxLength={120} placeholder={dict.onboarding.businessPlaceholder} />
        </Field>

        <Field label={dict.onboarding.legalName} htmlFor="legalName" hint={dict.onboarding.legalNameHint}>
          <Input id="legalName" name="legalName" maxLength={160} placeholder="ETS Nkeng Fresh Foods" />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={dict.onboarding.currencyLabel} htmlFor="currency" error={state.fieldErrors?.currency?.[0]}>
            <Select id="currency" name="currency" defaultValue="XAF">
              {SUPPORTED_CURRENCIES.map((code) => (
                <option key={code} value={code}>
                  {code} — {CURRENCY_OPTIONS.find((option) => option.code === code)?.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label={dict.onboarding.country} htmlFor="country">
            <Select id="country" name="country" defaultValue="CM">
              {COUNTRIES.map((country) => (
                <option key={country.code} value={country.code}>
                  {country.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label={dict.onboarding.timezone} htmlFor="timezone">
            <Select id="timezone" name="timezone" defaultValue="Africa/Douala">
              {TIMEZONES.map((zone) => (
                <option key={zone} value={zone}>
                  {zone}
                </option>
              ))}
            </Select>
          </Field>

          <Field label={dict.common.language} htmlFor="uiLocale">
            <Select id="uiLocale" name="uiLocale" defaultValue={locale}>
              {LOCALES.map((code) => (
                <option key={code} value={code}>
                  {LOCALE_META[code].label}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <SubmitButton className="mt-2 w-full" size="lg" pendingLabel={dict.onboarding.creating}>
          {dict.onboarding.createWorkspace}
          <ArrowRight className="h-4 w-4" aria-hidden />
        </SubmitButton>
      </form>

      <p className="mt-6 text-xs leading-relaxed text-muted">{dict.onboarding.inviteLater}</p>
    </div>
  );
}
