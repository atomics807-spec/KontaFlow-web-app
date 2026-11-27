"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/layout/i18n-provider";
import { initialFormState } from "@/lib/action-utils";
import { updateSupportRequestAction } from "@/app/[locale]/admin/actions";

export function SupportRequestActions({ id }: { id: string }) {
  const { locale, dict } = useI18n();
  const copy = dict.admin;
  const router = useRouter();
  const [state, action, pending] = useActionState(updateSupportRequestAction, initialFormState);

  useEffect(() => {
    if (state.status === "success") router.refresh();
  }, [state, router]);

  return (
    <form action={action} className="flex flex-wrap items-center gap-1.5">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="id" value={id} />
      <Button type="submit" name="status" value="read" size="sm" variant="ghost" disabled={pending}>
        {copy.markRead}
      </Button>
      <Button type="submit" name="status" value="replied" size="sm" variant="secondary" disabled={pending}>
        {copy.markReplied}
      </Button>
      <Button type="submit" name="status" value="closed" size="sm" variant="ghost" disabled={pending}>
        {copy.markClosed}
      </Button>
      <Button type="submit" name="status" value="spam" size="sm" variant="ghost" disabled={pending}>
        {copy.markSpam}
      </Button>
      {state.status === "error" && state.message ? <Alert tone="error">{state.message}</Alert> : null}
    </form>
  );
}
