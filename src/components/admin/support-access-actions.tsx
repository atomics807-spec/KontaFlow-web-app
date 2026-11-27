"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/components/layout/i18n-provider";
import { initialFormState } from "@/lib/action-utils";
import { decideSupportAccessAction, revokeSupportAccessAction } from "@/app/[locale]/admin/actions";
import type { PlatformSupportAccessGrant } from "@/types/platform-admin";

export function SupportAccessActions({
  grant,
  canDecide,
}: {
  grant: PlatformSupportAccessGrant;
  canDecide: boolean;
}) {
  const { locale, dict } = useI18n();
  const copy = dict.admin;
  const router = useRouter();
  const [decisionState, decisionAction, deciding] = useActionState(decideSupportAccessAction, initialFormState);
  const [revokeState, revokeAction, revoking] = useActionState(revokeSupportAccessAction, initialFormState);

  useEffect(() => {
    if (decisionState.status === "success" || revokeState.status === "success") router.refresh();
  }, [decisionState, revokeState, router]);

  if (grant.status === "pending" && canDecide) {
    return (
      <form action={decisionAction} className="space-y-1.5">
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="grantId" value={grant.id} />
        <Input name="note" maxLength={500} placeholder={copy.decisionNote} className="h-9 text-xs" />
        <div className="flex gap-1.5">
          <Button type="submit" name="decision" value="approve" size="sm" disabled={deciding}>
            {copy.approve}
          </Button>
          <Button type="submit" name="decision" value="deny" size="sm" variant="secondary" disabled={deciding}>
            {copy.deny}
          </Button>
        </div>
        {decisionState.status === "error" && decisionState.message ? <Alert tone="error">{decisionState.message}</Alert> : null}
      </form>
    );
  }

  if (grant.status === "approved" && canDecide) {
    return (
      <form action={revokeAction} className="space-y-1.5">
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="grantId" value={grant.id} />
        <Input name="reason" maxLength={500} placeholder={copy.decisionNote} className="h-9 text-xs" />
        <Button type="submit" size="sm" variant="secondary" disabled={revoking}>
          {copy.revoke}
        </Button>
        {revokeState.status === "error" && revokeState.message ? <Alert tone="error">{revokeState.message}</Alert> : null}
      </form>
    );
  }

  return null;
}
