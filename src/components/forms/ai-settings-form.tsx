"use client";

import { useActionState } from "react";
import { Sparkles } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { useI18n } from "@/components/layout/i18n-provider";
import { initialFormState } from "@/lib/action-utils";
import { formatMoney } from "@/lib/money";
import { intlLocale } from "@/lib/i18n/config";
import { updateAiSettingsAction } from "@/app/[locale]/(dashboard)/settings/actions";

export function AiSettingsForm({
  autoPost,
  maxMinor,
  currency,
  disabled,
}: {
  autoPost: boolean;
  maxMinor: bigint;
  currency: string;
  disabled: boolean;
}) {
  const { locale, dict } = useI18n();
  const [state, action, pending] = useActionState(updateAiSettingsAction, initialFormState);

  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="locale" value={locale} />
      {state.status === "error" && state.message ? <Alert tone="error">{state.message}</Alert> : null}
      {state.status === "success" && state.message ? <Alert tone="success">{state.message}</Alert> : null}

      <label className="flex items-start gap-3 rounded-xl border border-line bg-page p-3 text-sm">
        <input
          type="checkbox"
          name="aiAutoPost"
          defaultChecked={autoPost}
          disabled={disabled}
          className="mt-0.5 h-4 w-4 rounded border-line text-accent-strong focus:ring-accent-line"
        />
        <span>
          <span className="block font-semibold text-heading">{dict.settings.aiAutoPost}</span>
          <span className="mt-1 block text-xs leading-relaxed text-muted">{dict.settings.aiAutoPostHelp}</span>
        </span>
      </label>

      <Field
        label={dict.settings.aiAutoPostLimit}
        htmlFor="ai-auto-post-max"
        hint={`${dict.settings.currency}: ${currency}`}
      >
        <Input
          id="ai-auto-post-max"
          name="aiAutoPostMax"
          inputMode="decimal"
          defaultValue={formatMoney(maxMinor, currency, intlLocale(locale), { withSymbol: false })}
          disabled={disabled}
          className="max-w-xs"
        />
      </Field>

      <Button type="submit" size="sm" disabled={disabled || pending}>
        <Sparkles className="h-4 w-4" aria-hidden />
        {pending ? dict.common.saving : dict.common.saveChanges}
      </Button>
    </form>
  );
}
