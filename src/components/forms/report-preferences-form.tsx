"use client";

import { useActionState } from "react";
import { BellRing } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Select } from "@/components/ui/input";
import { useI18n } from "@/components/layout/i18n-provider";
import { initialFormState } from "@/lib/action-utils";
import { updateReportPreferencesAction } from "@/app/[locale]/(dashboard)/settings/actions";
import type { ReportPreferences } from "@/services/report-preferences";

export function ReportPreferencesForm({
  preferences,
  whatsappLinked,
  whatsappAllowed,
}: {
  preferences: ReportPreferences;
  whatsappLinked: boolean;
  whatsappAllowed: boolean;
}) {
  const { locale, dict } = useI18n();
  const [state, action, pending] = useActionState(updateReportPreferencesAction, initialFormState);
  const whatsappDisabled = !whatsappLinked || !whatsappAllowed;

  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="locale" value={locale} />
      {state.status === "error" && state.message ? <Alert tone="error">{state.message}</Alert> : null}
      {state.status === "success" && state.message ? <Alert tone="success">{state.message}</Alert> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label={dict.settings.reportsLanguage}
          htmlFor="report-language"
          hint={dict.settings.reportsLanguageHelp}
        >
          <Select id="report-language" name="reportLanguage" defaultValue={preferences.language}>
            <option value="en">{dict.settings.reportsLanguageEnglish}</option>
            <option value="fr">{dict.settings.reportsLanguageFrench}</option>
            <option value="pcm">{dict.settings.reportsLanguagePidgin}</option>
          </Select>
        </Field>

        <Field
          label={dict.settings.reportsFrequency}
          htmlFor="report-frequency"
          hint={dict.settings.reportsFrequencyHelp}
        >
          <Select id="report-frequency" name="reportFrequency" defaultValue={preferences.frequency}>
            <option value="daily">{dict.settings.reportsFrequencyDaily}</option>
            <option value="weekly">{dict.settings.reportsFrequencyWeekly}</option>
            <option value="monthly">{dict.settings.reportsFrequencyMonthly}</option>
            <option value="off">{dict.settings.reportsFrequencyOff}</option>
          </Select>
        </Field>
      </div>

      <fieldset className="space-y-2">
        <legend className="mb-1.5 block text-[0.8rem] font-semibold uppercase tracking-[0.08em] text-muted">
          {dict.settings.reportsChannels}
        </legend>

        <label className="flex items-start gap-3 rounded-xl border border-line bg-page p-3 text-sm">
          <input
            type="checkbox"
            name="reportEmail"
            defaultChecked={preferences.emailEnabled}
            className="mt-0.5 h-4 w-4 rounded border-line text-accent-strong focus:ring-accent-line"
          />
          <span>
            <span className="block font-semibold text-heading">{dict.settings.reportsEmail}</span>
            <span className="mt-1 block text-xs leading-relaxed text-muted">{dict.settings.reportsEmailHelp}</span>
          </span>
        </label>

        <label className="flex items-start gap-3 rounded-xl border border-line bg-page p-3 text-sm">
          <input
            type="checkbox"
            name="reportInApp"
            defaultChecked={preferences.inAppEnabled}
            className="mt-0.5 h-4 w-4 rounded border-line text-accent-strong focus:ring-accent-line"
          />
          <span>
            <span className="block font-semibold text-heading">{dict.settings.reportsInApp}</span>
            <span className="mt-1 block text-xs leading-relaxed text-muted">{dict.settings.reportsInAppHelp}</span>
          </span>
        </label>

        <label className="flex items-start gap-3 rounded-xl border border-line bg-page p-3 text-sm">
          <input
            type="checkbox"
            name="reportWhatsapp"
            defaultChecked={preferences.whatsappEnabled && !whatsappDisabled}
            disabled={whatsappDisabled}
            className="mt-0.5 h-4 w-4 rounded border-line text-accent-strong focus:ring-accent-line disabled:opacity-50"
          />
          <span>
            <span className="block font-semibold text-heading">{dict.settings.reportsWhatsapp}</span>
            <span className="mt-1 block text-xs leading-relaxed text-muted">
              {whatsappDisabled
                ? whatsappAllowed
                  ? dict.settings.reportsWhatsappUnavailable
                  : dict.settings.reportsWhatsappPlan
                : dict.settings.reportsWhatsappHelp}
            </span>
          </span>
        </label>
      </fieldset>

      <Button type="submit" size="sm" disabled={pending}>
        <BellRing className="h-4 w-4" aria-hidden />
        {pending ? dict.common.saving : dict.common.saveChanges}
      </Button>
    </form>
  );
}
