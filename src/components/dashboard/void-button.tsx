"use client";

import { useEffect, useState } from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { Ban, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { useI18n } from "@/components/layout/i18n-provider";
import { initialFormState } from "@/lib/action-utils";
import { voidTransactionAction } from "@/app/[locale]/(dashboard)/transactions/actions";

export function VoidButton({ transactionId }: { transactionId: string }) {
  const { locale, dict } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(voidTransactionAction, initialFormState);

  useEffect(() => {
    if (state.status === "success") router.refresh();
  }, [state.status, router]);

  if (state.status === "success") {
    return <span className="text-xs font-semibold text-muted">{dict.transactions.voided}</span>;
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold text-muted transition hover:bg-clay-soft hover:text-clay"
      >
        <Ban className="h-3.5 w-3.5" aria-hidden />
        {dict.transactions.voided}
      </button>
    );
  }

  return (
    <form action={action} className="flex flex-col items-end gap-1.5">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="transactionId" value={transactionId} />
      <label className="sr-only" htmlFor={`reason-${transactionId}`}>
        {dict.common.notes}
      </label>
      <Input
        id={`reason-${transactionId}`}
        name="reason"
        placeholder={dict.common.notes}
        maxLength={240}
        className="h-8 w-40 text-xs"
      />
      {state.status === "error" && state.message ? (
        <Alert tone="error" className="max-w-48 px-2 py-1 text-[0.7rem]">
          {state.message}
        </Alert>
      ) : null}
      <div className="flex gap-1">
        <Button type="submit" variant="danger" size="sm" className="h-7 px-2 text-xs" disabled={pending}>
          {pending ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> : null}
          {dict.common.yes}
        </Button>
        <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setOpen(false)}>
          {dict.common.no}
        </Button>
      </div>
    </form>
  );
}
