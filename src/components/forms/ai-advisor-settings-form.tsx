"use client";

import { useActionState } from "react";
import { BrainCircuit, ShieldCheck, Trash2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { useI18n } from "@/components/layout/i18n-provider";
import { initialFormState } from "@/lib/action-utils";
import type { AiWorkspacePreferences } from "@/types/ai-advisor";
import {
  purgeAiHistoryAction,
  updateAiAdvisorSettingsAction,
} from "@/app/[locale]/(dashboard)/settings/actions";

const FOCUS_OPTIONS = ["balanced", "cash_flow", "costs", "growth", "collections"] as const;

export function AiAdvisorSettingsForm({
  preferences,
  analysisFrom,
  analysisTo,
  disabled,
  isOwner,
}: {
  preferences: AiWorkspacePreferences;
  analysisFrom: string;
  analysisTo: string;
  disabled: boolean;
  isOwner: boolean;
}) {
  const { locale, dict } = useI18n();
  const [state, action, pending] = useActionState(updateAiAdvisorSettingsAction, initialFormState);
  const [purgeState, purgeAction, purgePending] = useActionState(purgeAiHistoryAction, initialFormState);

  const focusLabels: Record<(typeof FOCUS_OPTIONS)[number], string> = {
    balanced: dict.settings.aiFocusBalanced,
    cash_flow: dict.settings.aiFocusCashFlow,
    costs: dict.settings.aiFocusCosts,
    growth: dict.settings.aiFocusGrowth,
    collections: dict.settings.aiFocusCollections,
  };

  return (
    <div className="space-y-5">
      <form action={action} className="space-y-4" noValidate>
        <input type="hidden" name="locale" value={locale} />
        {state.status === "error" && state.message ? <Alert tone="error">{state.message}</Alert> : null}
        {state.status === "success" && state.message ? <Alert tone="success">{state.message}</Alert> : null}

        <label className="flex items-start gap-3 rounded-xl border border-line bg-page p-3 text-sm">
          <input
            type="checkbox"
            name="insightsEnabled"
            defaultChecked={preferences.insightsEnabled}
            disabled={disabled}
            className="mt-0.5 h-4 w-4 rounded border-line text-accent-strong focus:ring-accent-line"
          />
          <span>
            <span className="flex items-center gap-1.5 font-semibold text-heading">
              <BrainCircuit className="h-4 w-4 text-accent-strong" aria-hidden />
              {dict.settings.aiInsightsEnable}
            </span>
            <span className="mt-1 block text-xs leading-relaxed text-muted">{dict.settings.aiInsightsHelp}</span>
          </span>
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label={dict.settings.aiAnalysisWindow}
            htmlFor="ai-analysis-window"
            hint={dict.settings.aiAnalysisWindowHelp.replace("{from}", analysisFrom).replace("{to}", analysisTo)}
          >
            <Select
              id="ai-analysis-window"
              name="analysisWindowDays"
              defaultValue={String(preferences.analysisWindowDays)}
              disabled={disabled}
            >
              {[30, 90, 180, 365, 730].map((days) => (
                <option key={days} value={days}>
                  {dict.settings.aiDays.replace("{count}", String(days))}
                </option>
              ))}
            </Select>
          </Field>

          <Field label={dict.settings.aiFocus} htmlFor="ai-focus" hint={dict.settings.aiFocusHelp}>
            <Select
              id="ai-focus"
              name="advisorFocus"
              defaultValue={preferences.advisorFocus}
              disabled={disabled}
            >
              {FOCUS_OPTIONS.map((focus) => (
                <option key={focus} value={focus}>
                  {focusLabels[focus]}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field
          label={dict.settings.aiAdvisorNote}
          htmlFor="ai-advisor-note"
          hint={dict.settings.aiAdvisorNoteHelp}
        >
          <Textarea
            id="ai-advisor-note"
            name="advisorNote"
            defaultValue={preferences.advisorNote ?? ""}
            maxLength={500}
            disabled={disabled}
            placeholder={dict.settings.aiAdvisorNotePlaceholder}
          />
        </Field>

        <fieldset className="rounded-xl border border-line bg-page p-3">
          <legend className="flex items-center gap-1.5 px-1 text-xs font-bold uppercase tracking-[0.08em] text-muted">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
            {dict.settings.aiRetentionTitle}
          </legend>
          <p className="mt-1 text-xs leading-relaxed text-muted">{dict.settings.aiRetentionHelp}</p>
          <div className="mt-3 max-w-xs">
            <Field label={dict.settings.aiRetentionDays} htmlFor="ai-retention-days">
              <Input
                id="ai-retention-days"
                name="historyRetentionDays"
                type="number"
                min={7}
                max={730}
                defaultValue={preferences.historyRetentionDays}
                disabled={disabled}
              />
            </Field>
          </div>
        </fieldset>

        <Button type="submit" size="sm" disabled={disabled || pending}>
          <ShieldCheck className="h-4 w-4" aria-hidden />
          {pending ? dict.common.saving : dict.common.saveChanges}
        </Button>
        {!isOwner ? <p className="text-xs text-muted">{dict.settings.aiOwnerOnly}</p> : null}
      </form>

      {isOwner ? (
        <form
          action={purgeAction}
          onSubmit={(event) => {
            if (!window.confirm(dict.settings.aiPurgeConfirm)) event.preventDefault();
          }}
          className="rounded-xl border border-danger/25 bg-danger-soft/40 p-3"
        >
          <input type="hidden" name="locale" value={locale} />
          {purgeState.status === "error" && purgeState.message ? (
            <Alert tone="error">{purgeState.message}</Alert>
          ) : null}
          {purgeState.status === "success" && purgeState.message ? (
            <Alert tone="success">{purgeState.message}</Alert>
          ) : null}
          <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-heading">{dict.settings.aiPurgeTitle}</p>
              <p className="mt-0.5 text-xs text-muted">{dict.settings.aiPurgeHelp}</p>
            </div>
            <Button type="submit" variant="secondary" size="sm" disabled={purgePending} className="text-danger">
              <Trash2 className="h-4 w-4" aria-hidden />
              {purgePending ? dict.common.saving : dict.settings.aiPurgeAction}
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
