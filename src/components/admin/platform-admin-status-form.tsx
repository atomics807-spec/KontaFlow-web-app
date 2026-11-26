"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Power } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/layout/i18n-provider";
import { initialFormState } from "@/lib/action-utils";
import { setPlatformAdminStatusAction } from "@/app/[locale]/admin/actions";
import type { PlatformAdminAccount } from "@/types/platform-admin";

export function PlatformAdminStatusForm({
  account,
  currentUserId,
}: {
  account: PlatformAdminAccount;
  currentUserId: string;
}) {
  const { locale, dict } = useI18n();
  const copy = dict.admin;
  const router = useRouter();
  const [state, action, pending] = useActionState(setPlatformAdminStatusAction, initialFormState);

  useEffect(() => {
    if (state.status === "success") router.refresh();
  }, [state, router]);

  if (account.user_id === currentUserId) {
    return <span className="text-[0.65rem] font-semibold text-[#151c19]/35">{copy.protectedLabel}</span>;
  }

  return (
    <div>
      <form action={action}>
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="userId" value={account.user_id} />
        <input type="hidden" name="active" value={account.is_active ? "false" : "true"} />
        <Button type="submit" size="sm" variant={account.is_active ? "danger" : "secondary"} disabled={pending}>
          <Power className="h-3.5 w-3.5" aria-hidden />
          {pending ? dict.common.saving : account.is_active ? copy.deactivate : copy.activate}
        </Button>
      </form>
      {state.status === "error" && state.message ? (
        <Alert tone="error" className="mt-2">
          {state.message}
        </Alert>
      ) : null}
      {state.status === "success" && state.message ? (
        <Alert tone="success" className="mt-2">
          {state.message}
        </Alert>
      ) : null}
    </div>
  );
}
