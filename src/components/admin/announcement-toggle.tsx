"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Pause, Play } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/layout/i18n-provider";
import { initialFormState } from "@/lib/action-utils";
import { toggleAnnouncementAction } from "@/app/[locale]/admin/actions";

export function AnnouncementToggle({
  id,
  active,
  canManage,
}: {
  id: string;
  active: boolean;
  canManage: boolean;
}) {
  const { locale, dict } = useI18n();
  const router = useRouter();
  const [state, action, pending] = useActionState(toggleAnnouncementAction, initialFormState);

  useEffect(() => {
    if (state.status === "success") router.refresh();
  }, [state, router]);

  if (!canManage) return null;

  return (
    <form action={action} className="inline-flex flex-col items-start gap-1">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="active" value={active ? "false" : "true"} />
      <Button type="submit" size="sm" variant="secondary" disabled={pending}>
        {active ? <Pause className="h-3.5 w-3.5" aria-hidden /> : <Play className="h-3.5 w-3.5" aria-hidden />}
        {pending ? dict.common.saving : active ? dict.admin.pause : dict.admin.publish}
      </Button>
      {state.status === "error" && state.message ? <Alert tone="error">{state.message}</Alert> : null}
    </form>
  );
}
