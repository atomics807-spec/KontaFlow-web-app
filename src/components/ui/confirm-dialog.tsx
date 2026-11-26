"use client";

import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";

/**
 * Confirmation dialog for destructive or irreversible actions. Pass a server
 * action as `formAction` to keep validation server-side; children hold the
 * hidden inputs and any reason field.
 */
export function ConfirmDialog({
  open,
  onClose,
  title,
  description,
  confirmLabel,
  cancelLabel,
  closeLabel,
  children,
  formAction,
  onConfirm,
  tone = "danger",
  pending = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  confirmLabel: string;
  cancelLabel: string;
  closeLabel: string;
  children?: React.ReactNode;
  formAction?: (formData: FormData) => void | Promise<void>;
  onConfirm?: () => void;
  tone?: "danger" | "primary";
  pending?: boolean;
}) {
  const actions = (inForm: boolean) => (
    <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
      <Button type="button" variant="secondary" size="sm" onClick={onClose} className="justify-center">
        {cancelLabel}
      </Button>
      <Button
        type={inForm ? "submit" : "button"}
        variant={tone === "danger" ? "danger" : "primary"}
        size="sm"
        disabled={pending}
        onClick={inForm ? undefined : onConfirm}
        className="justify-center"
      >
        {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
        {confirmLabel}
      </Button>
    </div>
  );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      closeLabel={closeLabel}
      size="sm"
    >
      {formAction ? (
        <form action={formAction} className="space-y-4">
          {children}
          {actions(true)}
        </form>
      ) : (
        <div className="space-y-4">
          {children}
          {actions(false)}
        </div>
      )}
    </Dialog>
  );
}
