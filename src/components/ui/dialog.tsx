"use client";

import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export type DialogSize = "sm" | "md" | "lg";

const SIZES: Record<DialogSize, string> = {
  sm: "w-[min(24rem,calc(100vw-2rem))]",
  md: "w-[min(32rem,calc(100vw-2rem))]",
  lg: "w-[min(44rem,calc(100vw-2rem))]",
};

/**
 * Native <dialog> gives focus trapping, Escape handling and a real backdrop
 * without extra dependencies. It lives in the top layer, so it never fights
 * with sticky headers or transformed containers.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  closeLabel,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  size?: DialogSize;
  closeLabel: string;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onClose={onClose}
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
      className={cn("fixed inset-0 m-auto h-fit max-h-[85dvh] overflow-visible bg-transparent p-0", SIZES[size])}
    >
      <div className={cn("surface shadow-pop flex max-h-[85dvh] flex-col overflow-hidden", className)}>
        <div className="flex items-start justify-between gap-4 px-5 pt-5 sm:px-6 sm:pt-6">
          <div className="min-w-0">
            <h2 id={titleId} className="text-base font-bold tracking-tight text-heading">
              {title}
            </h2>
            {description ? (
              <p id={descriptionId} className="mt-1 text-sm leading-relaxed text-muted">
                {description}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted transition hover:bg-page hover:text-heading"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
        {children ? <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6">{children}</div> : null}
        {footer ? (
          <div className="flex flex-wrap justify-end gap-2 border-t border-line bg-panel-muted/60 px-5 py-4 sm:px-6">
            {footer}
          </div>
        ) : null}
      </div>
    </dialog>
  );
}
