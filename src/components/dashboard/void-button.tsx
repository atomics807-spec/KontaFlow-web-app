"use client";

import { useEffect, useState } from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { Ban } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { useI18n } from "@/components/layout/i18n-provider";
import { initialFormState } from "@/lib/action-utils";
import { voidTransactionAction } from "@/app/[locale]/(dashboard)/transactions/actions";

export function VoidButton({ transactionId }: { transactionId: string }) {
  const { locale, dict } = useI18n();
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(voidTransactionAction, initialFormState);

  useEffect(() => {
    if (state.status !== "success") return;
    router.refresh();
    toast({ title: dict.transactions.voided, description: dict.transactions.voidConfirm, tone: "success" });
  }, [state.status, router, toast, dict.transactions.voided, dict.transactions.voidConfirm]);

  if (state.status === "success") {
    return <span className="text-xs font-semibold text-muted">{dict.transactions.voided}</span>;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold text-muted transition hover:bg-danger-soft hover:text-danger"
      >
        <Ban className="h-3.5 w-3.5" aria-hidden />
        {dict.transactions.voided}
      </button>

      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        title={dict.transactions.voidConfirm}
        description={dict.transactions.voidNote}
        confirmLabel={dict.transactions.voided}
        cancelLabel={dict.common.cancel}
        closeLabel={dict.common.close}
        formAction={action}
        pending={pending}
      >
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="transactionId" value={transactionId} />
        <Input
          id={`reason-${transactionId}`}
          name="reason"
          aria-label={dict.common.notes}
          placeholder={dict.common.notes}
          maxLength={240}
        />
        {state.status === "error" && state.message ? <Alert tone="error">{state.message}</Alert> : null}
      </ConfirmDialog>
    </>
  );
}
