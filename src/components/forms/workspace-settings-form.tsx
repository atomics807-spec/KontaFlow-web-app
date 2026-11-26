"use client";

import { useActionState } from "react";
import { Save } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { useI18n } from "@/components/layout/i18n-provider";
import { initialFormState } from "@/lib/action-utils";
import { SUPPORTED_CURRENCIES, CURRENCY_OPTIONS } from "@/lib/currency";
import { LOCALES, LOCALE_META } from "@/lib/i18n/config";
import { updateWorkspaceAction, linkChannelAction } from "@/app/[locale]/(dashboard)/settings/actions";

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

export function WorkspaceSettingsForm({
  name,
  legalName,
  currency,
  country,
  timezone,
  disabled,
}: {
  name: string;
  legalName: string;
  currency: string;
  country: string;
  timezone: string;
  disabled: boolean;
}) {
  const { locale, dict } = useI18n();
  const [state, action, pending] = useActionState(updateWorkspaceAction, initialFormState);

  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="locale" value={locale} />
      {state.status === "error" && state.message ? <Alert tone="error">{state.message}</Alert> : null}
      {state.status === "success" && state.message ? <Alert tone="success">{state.message}</Alert> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={dict.settings.businessName} htmlFor="ws-name" error={state.fieldErrors?.name?.[0]}>
          <Input id="ws-name" name="name" required maxLength={120} defaultValue={name} disabled={disabled} />
        </Field>
        <Field label={dict.settings.legalName} htmlFor="ws-legal">
          <Input id="ws-legal" name="legalName" maxLength={160} defaultValue={legalName} disabled={disabled} />
        </Field>
        <Field label={dict.settings.currency} htmlFor="ws-currency">
          <Select id="ws-currency" name="currency" defaultValue={currency} disabled={disabled}>
            {SUPPORTED_CURRENCIES.map((code) => (
              <option key={code} value={code}>
                {code} — {CURRENCY_OPTIONS.find((option) => option.code === code)?.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={dict.settings.country} htmlFor="ws-country">
          <Select id="ws-country" name="country" defaultValue={country} disabled={disabled}>
            {COUNTRIES.map((option) => (
              <option key={option.code} value={option.code}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={dict.settings.timezone} htmlFor="ws-timezone">
          <Select id="ws-timezone" name="timezone" defaultValue={timezone} disabled={disabled}>
            {TIMEZONES.map((zone) => (
              <option key={zone} value={zone}>
                {zone}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={dict.settings.language} htmlFor="ws-locale">
          <Select id="ws-locale" name="uiLocale" defaultValue={locale} disabled={disabled}>
            {LOCALES.map((code) => (
              <option key={code} value={code}>
                {LOCALE_META[code].label}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      {disabled ? null : (
        <Button type="submit" disabled={pending}>
          <Save className="h-4 w-4" aria-hidden />
          {pending ? dict.common.saving : dict.common.saveChanges}
        </Button>
      )}
    </form>
  );
}

export function LinkChannelForm({ disabled }: { disabled: boolean }) {
  const { locale, dict } = useI18n();
  const [state, action, pending] = useActionState(linkChannelAction, initialFormState);

  return (
    <form action={action} className="space-y-3" noValidate>
      <input type="hidden" name="locale" value={locale} />
      {state.status === "error" && state.message ? <Alert tone="error">{state.message}</Alert> : null}
      {state.status === "success" && state.message ? <Alert tone="success">{state.message}</Alert> : null}

      <div className="grid gap-3 sm:grid-cols-[1fr_1.4fr_auto] sm:items-end">
        <Field label={dict.settings.channels} htmlFor="channel">
          <Select id="channel" name="channel" defaultValue="whatsapp" disabled={disabled}>
            <option value="whatsapp">{dict.transactions.channelWhatsapp}</option>
            <option value="ussd">{dict.transactions.channelUssd}</option>
          </Select>
        </Field>
        <Field label={dict.settings.phoneNumber} htmlFor="address">
          <Input
            id="address"
            name="address"
            type="tel"
            inputMode="tel"
            placeholder="+237 6XX XX XX XX"
            maxLength={24}
            required
            disabled={disabled}
          />
        </Field>
        <Button type="submit" variant="secondary" disabled={pending || disabled}>
          {pending ? dict.common.saving : dict.common.save}
        </Button>
      </div>
    </form>
  );
}
