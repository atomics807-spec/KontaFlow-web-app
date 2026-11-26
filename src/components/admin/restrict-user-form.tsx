"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldAlert, ShieldCheck } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { useI18n } from "@/components/layout/i18n-provider";
import { initialFormState } from "@/lib/action-utils";
import { formatDate } from "@/lib/dates";
import { intlLocale } from "@/lib/i18n/config";
import { liftRestrictionAction, restrictUserAction } from "@/app/[locale]/admin/actions";
import type { PlatformAdminUser } from "@/types/platform-admin";
import type { Dictionary } from "@/lib/i18n/dictionaries/en";

export function RestrictUserForm({
  user,
  canManage,
}: {
  user: PlatformAdminUser;
  canManage: boolean;
}) {
  const { locale, dict } = useI18n();
  const copy = dict.admin;
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(restrictUserAction, initialFormState);
  const [liftState, liftAction, liftPending] = useActionState(
    liftRestrictionAction,
    initialFormState,
  );

  useEffect(() => {
    if (state.status === "success" || liftState.status === "success") router.refresh();
  }, [state, liftState, router]);

  if (!canManage) return null;

  if (user.restriction_id) {
    return (
      <div className="mt-3 rounded-xl border border-[#f0c9bd] bg-[#fbeee9] p-3">
        <p className="flex items-center gap-1.5 text-xs font-bold text-[#8b2d18]">
          <ShieldAlert className="h-3.5 w-3.5" aria-hidden />
          {copy.activeRestriction}: {user.severity === "suspended" ? copy.suspendedState : copy.restrictedState}
        </p>
        <p className="mt-1 text-xs text-[#5f2c1e]/75">{user.restriction_reason}</p>
        <p className="mt-1 text-[0.65rem] text-[#5f2c1e]/55">
          {copy.until}:{" "}
          {user.restriction_expires_at
            ? formatDate(user.restriction_expires_at, intlLocale(locale))
            : copy.durationForever}
        </p>

        {liftState.status === "error" && liftState.message ? (
          <Alert tone="error" className="mt-2">
            {liftState.message}
          </Alert>
        ) : null}
        {liftState.status === "success" && liftState.message ? (
          <Alert tone="success" className="mt-2">
            {liftState.message}
          </Alert>
        ) : null}

        <form action={liftAction} className="mt-3 space-y-2">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="restrictionId" value={user.restriction_id} />
          <Field
            label={copy.reason}
            htmlFor={`lift-reason-${user.id}`}
            error={liftState.fieldErrors?.reason?.[0]}
          >
            <Input
              id={`lift-reason-${user.id}`}
              name="reason"
              maxLength={500}
              placeholder={copy.reason}
            />
          </Field>
          <Button type="submit" size="sm" variant="secondary" disabled={liftPending}>
            <ShieldCheck className="h-4 w-4" aria-hidden />
            {liftPending ? dict.common.saving : copy.lift}
          </Button>
        </form>

        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="mt-3 text-[0.7rem] font-semibold text-[#8b2d18] underline underline-offset-2"
        >
          {copy.restrictive}
        </button>
        {open ? (
          <RestrictionFields
            locale={locale}
            userId={user.id}
            copy={copy}
            action={action}
            state={state}
            pending={pending}
            saving={dict.common.saving}
          />
        ) : null}
      </div>
    );
  }

  return (
    <div className="mt-2">
      <Button type="button" size="sm" variant="secondary" onClick={() => setOpen((value) => !value)}>
        <ShieldAlert className="h-4 w-4" aria-hidden />
        {copy.restrictive}
      </Button>
      {open ? (
        <RestrictionFields
          locale={locale}
          userId={user.id}
          copy={copy}
          action={action}
          state={state}
          pending={pending}
          saving={dict.common.saving}
        />
      ) : null}
    </div>
  );
}

function RestrictionFields({
  locale,
  userId,
  copy,
  action,
  state,
  pending,
  saving,
}: {
  locale: string;
  userId: string;
  copy: Dictionary["admin"];
  action: (formData: FormData) => void;
  state: { status: "idle" | "error" | "success"; message?: string; fieldErrors?: Record<string, string[]> };
  pending: boolean;
  saving: string;
}) {
  return (
    <form action={action} className="mt-3 space-y-2 rounded-xl bg-white/70 p-3" noValidate>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="userId" value={userId} />

      {state.status === "error" && state.message ? <Alert tone="error">{state.message}</Alert> : null}
      {state.status === "success" && state.message ? <Alert tone="success">{state.message}</Alert> : null}

      <p className="text-[0.7rem] leading-relaxed text-[#151c19]/55">{copy.restrictionHelp}</p>

      <div className="grid gap-2 sm:grid-cols-2">
        <Field label={copy.severity} htmlFor={`severity-${userId}`} error={state.fieldErrors?.severity?.[0]}>
          <Select id={`severity-${userId}`} name="severity" defaultValue="limited">
            <option value="limited">{copy.limited}</option>
            <option value="suspended">{copy.suspendedOption}</option>
          </Select>
        </Field>
        <Field label={copy.duration} htmlFor={`duration-${userId}`} error={state.fieldErrors?.duration?.[0]}>
          <Select id={`duration-${userId}`} name="duration" defaultValue="7d">
            <option value="24h">{copy.duration24h}</option>
            <option value="7d">{copy.duration7d}</option>
            <option value="30d">{copy.duration30d}</option>
            <option value="forever">{copy.durationForever}</option>
          </Select>
        </Field>
      </div>

      <Field label={copy.reason} htmlFor={`reason-${userId}`} error={state.fieldErrors?.reason?.[0]}>
        <Textarea
          id={`reason-${userId}`}
          name="reason"
          required
          minLength={5}
          maxLength={1000}
          placeholder={copy.reason}
        />
      </Field>

      <Button type="submit" size="sm" variant="danger" disabled={pending}>
        {pending ? saving : copy.restrictive}
      </Button>
    </form>
  );
}
