"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { KeyRound } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { useI18n } from "@/components/layout/i18n-provider";
import { initialFormState } from "@/lib/action-utils";
import { requestSupportAccessAction } from "@/app/[locale]/admin/actions";

export function SupportAccessRequestForm({
  workspaces,
}: {
  workspaces: { id: string; name: string }[];
}) {
  const { locale, dict } = useI18n();
  const copy = dict.admin;
  const router = useRouter();
  const [state, action, pending] = useActionState(requestSupportAccessAction, initialFormState);

  useEffect(() => {
    if (state.status === "success") router.refresh();
  }, [state, router]);

  return (
    <form action={action} className="rounded-2xl border border-black/8 bg-white p-5" noValidate>
      <input type="hidden" name="locale" value={locale} />
      <div className="flex items-center gap-2">
        <KeyRound className="h-4 w-4 text-[#3f6b52]" aria-hidden />
        <h2 className="text-sm font-extrabold text-[#151c19]">{copy.requestSupportAccess}</h2>
      </div>
      <p className="mt-1 text-xs text-[#151c19]/50">{copy.snapshotLead}</p>

      {state.status === "error" && state.message ? <Alert tone="error" className="mt-3">{state.message}</Alert> : null}
      {state.status === "success" && state.message ? <Alert tone="success" className="mt-3">{state.message}</Alert> : null}

      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_9rem]">
        <Field label={copy.supportAccess} htmlFor="support-workspace" error={state.fieldErrors?.workspaceId?.[0]}>
          <Select id="support-workspace" name="workspaceId" defaultValue="" required>
            <option value="" disabled>—</option>
            {workspaces.map((workspace) => (
              <option key={workspace.id} value={workspace.id}>{workspace.name}</option>
            ))}
          </Select>
        </Field>
        <Field label={copy.accessHours} htmlFor="support-hours" error={state.fieldErrors?.hours?.[0]}>
          <Input id="support-hours" name="hours" type="number" min={1} max={72} defaultValue={24} required />
        </Field>
      </div>

      <div className="mt-3">
        <Field label={copy.justification} htmlFor="support-justification" error={state.fieldErrors?.justification?.[0]}>
          <Textarea id="support-justification" name="justification" maxLength={1000} required placeholder={copy.justification} />
        </Field>
      </div>

      <Button type="submit" size="sm" className="mt-4" disabled={pending}>
        {pending ? dict.common.saving : copy.requestAccess}
      </Button>
    </form>
  );
}
