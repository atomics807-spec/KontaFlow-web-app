"use client";

import { useActionState } from "react";
import { ArrowRight, Building2, MapPin, Wallet } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Field, Input, Select } from "@/components/ui/input";
import { SubmitButton } from "@/components/forms/submit-button";
import { SpeakButton } from "@/components/easy/speak-button";
import { useI18n } from "@/components/layout/i18n-provider";
import { initialFormState } from "@/lib/action-utils";
import { BUSINESS_SIZES, BUSINESS_TYPES, INDUSTRIES } from "@/lib/business";
import { COUNTRIES, countryName } from "@/lib/countries";
import { CURRENCY_OPTIONS, SUPPORTED_CURRENCIES } from "@/lib/currency";
import { LOCALES, LOCALE_META, intlLocale } from "@/lib/i18n/config";
import { createWorkspaceAction } from "@/app/[locale]/onboarding/actions";

const TIMEZONES = ["Africa/Douala", "Africa/Lagos", "Africa/Accra", "Africa/Nairobi", "Africa/Abidjan", "Europe/Paris", "UTC"];

const TYPE_LABEL = {
  sole_proprietorship: "typeSole",
  partnership: "typePartnership",
  limited_company: "typeLimited",
  cooperative: "typeCooperative",
  nonprofit: "typeNonprofit",
  other: "typeOther",
} as const;

const SIZE_LABEL = {
  solo: "sizeSolo",
  micro: "sizeMicro",
  small: "sizeSmall",
  medium: "sizeMedium",
  large: "sizeLarge",
} as const;

const INDUSTRY_LABEL = {
  retail: "industryRetail",
  food: "industryFood",
  services: "industryServices",
  construction: "industryConstruction",
  transport: "industryTransport",
  technology: "industryTechnology",
  health: "industryHealth",
  education: "industryEducation",
  other: "industryOther",
} as const;

export function OnboardingForm({
  email,
  defaultCountry = "CM",
  defaultLocale,
  defaultName = "",
  defaultPhone = "",
}: {
  email: string;
  defaultCountry?: string;
  defaultLocale: string;
  defaultName?: string;
  defaultPhone?: string;
}) {
  const { locale, dict } = useI18n();
  const [state, action] = useActionState(createWorkspaceAction, initialFormState);
  const monthNames = Array.from({ length: 12 }, (_, index) =>
    new Intl.DateTimeFormat(intlLocale(locale), { month: "long" }).format(new Date(2024, index, 1)),
  );

  return (
    <div className="w-full">
      <span className="inline-flex items-center gap-2 rounded-full border border-line bg-panel px-3 py-1.5 text-xs font-semibold text-muted">
        <Building2 className="h-3.5 w-3.5 text-accent-strong" aria-hidden />
        {email}
      </span>

      <h1 className="mt-5 text-balance text-3xl font-extrabold tracking-tight text-heading sm:text-4xl">
        {dict.onboarding.title}
      </h1>
      <p className="mt-3 text-balance text-sm leading-relaxed text-muted sm:text-base">
        {dict.onboarding.subtitle}
      </p>
      <SpeakButton
        text={`${dict.onboarding.title}. ${dict.onboarding.subtitle}`}
        label={dict.easy.listen}
        className="mt-4"
      />

      <form action={action} encType="multipart/form-data" className="mt-8 space-y-7" noValidate>
        <input type="hidden" name="locale" value={locale} />
        {state.status === "error" && state.message ? <Alert tone="error">{state.message}</Alert> : null}

        <fieldset className="space-y-4">
          <legend className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.12em] text-muted">
            <Building2 className="h-4 w-4 text-accent-strong" aria-hidden />
            {dict.onboarding.detailsSection}
          </legend>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={dict.onboarding.businessName} htmlFor="name" error={state.fieldErrors?.name?.[0]}>
              <Input
                id="name"
                name="name"
                required
                maxLength={120}
                defaultValue={defaultName}
                placeholder={dict.onboarding.businessPlaceholder}
              />
            </Field>
            <Field label={dict.onboarding.legalName} htmlFor="legalName" hint={dict.onboarding.legalNameHint}>
              <Input id="legalName" name="legalName" maxLength={160} placeholder="ETS Nkeng Fresh Foods" />
            </Field>

            <Field
              label={dict.onboarding.businessType}
              htmlFor="businessType"
              hint={dict.onboarding.businessTypeHint}
              error={state.fieldErrors?.businessType?.[0]}
            >
              <Select id="businessType" name="businessType" required defaultValue="sole_proprietorship">
                {BUSINESS_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {dict.onboarding[TYPE_LABEL[type]]}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              label={dict.onboarding.industry}
              htmlFor="industry"
              hint={dict.onboarding.industryHint}
              error={state.fieldErrors?.industry?.[0]}
            >
              <Select id="industry" name="industry" required defaultValue="retail">
                {INDUSTRIES.map((industry) => (
                  <option key={industry} value={industry}>
                    {dict.onboarding[INDUSTRY_LABEL[industry]]}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label={dict.onboarding.location} htmlFor="city" error={state.fieldErrors?.city?.[0]}>
              <span className="relative block">
                <MapPin className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted" aria-hidden />
                <Input
                  id="city"
                  name="city"
                  required
                  maxLength={100}
                  placeholder={dict.onboarding.cityPlaceholder}
                  className="pl-9"
                />
              </span>
            </Field>

            <Field label={dict.onboarding.country} htmlFor="country">
              <Select id="country" name="country" defaultValue={defaultCountry}>
                {COUNTRIES.map((country) => (
                  <option key={country.code} value={country.code}>
                    {countryName(country.code, locale)}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              label={dict.onboarding.businessSize}
              htmlFor="businessSize"
              error={state.fieldErrors?.businessSize?.[0]}
            >
              <Select id="businessSize" name="businessSize" required defaultValue="micro">
                {BUSINESS_SIZES.map((size) => (
                  <option key={size} value={size}>
                    {dict.onboarding[SIZE_LABEL[size]]}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              label={dict.onboarding.businessPhone}
              htmlFor="businessPhone"
              hint={dict.onboarding.businessPhoneHint}
              error={state.fieldErrors?.businessPhone?.[0]}
            >
              <Input
                id="businessPhone"
                name="businessPhone"
                type="tel"
                inputMode="tel"
                defaultValue={defaultPhone}
                placeholder={dict.auth.phonePlaceholder}
              />
            </Field>
          </div>
        </fieldset>

        <fieldset className="space-y-4 border-t border-line pt-6">
          <legend className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.12em] text-muted">
            <Wallet className="h-4 w-4 text-accent-strong" aria-hidden />
            {dict.onboarding.financialSection}
          </legend>

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

            <Field
              label={dict.onboarding.fiscalYearStart}
              htmlFor="fiscalYearStartMonth"
              error={state.fieldErrors?.fiscalYearStartMonth?.[0]}
            >
              <Select id="fiscalYearStartMonth" name="fiscalYearStartMonth" defaultValue="1">
                {monthNames.map((month, index) => (
                  <option key={month} value={index + 1}>
                    {month}
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
              <Select id="uiLocale" name="uiLocale" defaultValue={defaultLocale}>
                {LOCALES.map((code) => (
                  <option key={code} value={code}>
                    {LOCALE_META[code].label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <Field label={dict.onboarding.logo} htmlFor="logo" hint={dict.onboarding.logoHint} error={state.fieldErrors?.logo?.[0]}>
            <Input
              id="logo"
              name="logo"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="h-auto py-2 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-accent-soft file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-accent-strong"
            />
          </Field>
        </fieldset>

        <SubmitButton className="mt-2 w-full" size="lg" pendingLabel={dict.onboarding.creating}>
          {dict.onboarding.createWorkspace}
          <ArrowRight className="h-4 w-4" aria-hidden />
        </SubmitButton>
      </form>

      <p className="mt-6 text-xs leading-relaxed text-muted">{dict.onboarding.inviteLater}</p>
    </div>
  );
}
