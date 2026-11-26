"use client";

import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Sheet panel built on <dialog>, so it inherits focus trapping and Escape.
 * Use for mobile navigation and contextual detail panels.
 */
export function Drawer({
  open,
  onClose,
  title,
  children,
  side = "left",
  closeLabel,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  side?: "left" | "right";
  closeLabel: string;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      data-side={side}
      aria-labelledby={titleId}
      onClose={onClose}
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
      className={cn(
        "fixed inset-y-0 m-0 h-dvh max-h-dvh w-[19rem] max-w-[86vw] overflow-hidden bg-transparent p-0",
        side === "left" ? "left-0" : "right-0",
      )}
    >
      <div
        className={cn(
          "flex h-full flex-col overflow-y-auto bg-forest text-white shadow-2xl",
          side === "left" ? "rounded-r-2xl" : "rounded-l-2xl",
          className,
        )}
      >
        <div className="flex items-center justify-between px-4 pt-4">
          <p id={titleId} className="sr-only">
            {title}
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
            className="ml-auto grid h-9 w-9 place-items-center rounded-full text-jade-100 transition hover:bg-white/10"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
