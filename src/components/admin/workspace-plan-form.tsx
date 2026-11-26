"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Settings2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { useI18n } from "@/components/layout/i18n-provider";
import { initialFormState } from "@/lib/action-utils";
import { setWorkspacePlanAction } from "@/app/[locale]/admin/actions";
import type { PlatformAdminWorkspace } from "@/types/platform-admin";

export function WorkspacePlanForm({
  workspace,
  canManage,
}: {
  workspace: PlatformAdminWorkspace;
  canManage: boolean;
}) {
  const { locale, dict } = useI18n();
  const copy = dict.admin;
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(setWorkspacePlanAction, initialFormState);

  useEffect(() => {
    if (state.status === "success") router.refresh();
  }, [state, router]);

  if (!canManage) return null;

  return (
    <div className="mt-3">
      <Button type="button" size="sm" variant="secondary" onClick={() => setOpen((value) => !value)}>
        <Settings2 className="h-4 w-4" aria-hidden />
        {copy.setPlan}
      </Button>

      {open ? (
        <form action={action} className="mt-2 space-y-2 rounded-xl bg-[#f4f2ec] p-3" noValidate>
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="workspaceId" value={workspace.id} />

          {state.status === "error" && state.message ? <Alert tone="error">{state.message}</Alert> : null}
          {state.status === "success" && state.message ? (
            <Alert tone="success">{state.message}</Alert>
          ) : null}

          <div className="grid gap-2 sm:grid-cols-2">
            <Field label={copy.plan} htmlFor={`plan-${workspace.id}`} error={state.fieldErrors?.plan?.[0]}>
              <Select id={`plan-${workspace.id}`} name="plan" defaultValue={workspace.plan}>
                <option value="starter">{dict.plans.starter}</option>
                <option value="growth">{dict.plans.growth}</option>
                <option value="scale">{dict.plans.scale}</option>
              </Select>
            </Field>
            <Field label={copy.note} htmlFor={`note-${workspace.id}`} error={state.fieldErrors?.note?.[0]}>
              <Input id={`note-${workspace.id}`} name="note" maxLength={500} placeholder={copy.note} />
            </Field>
          </div>

          <Button type="submit" size="sm" disabled={pending}>
            {pending ? dict.common.saving : copy.setPlan}
          </Button>
        </form>
      ) : null}
    </div>
  );
}
