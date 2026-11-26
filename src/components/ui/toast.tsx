"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CheckCircle2, Info, TriangleAlert, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/components/layout/i18n-provider";

export type ToastTone = "success" | "error" | "info";

type ToastRecord = {
  id: string;
  title: string;
  description?: string;
  tone: ToastTone;
};

type ToastInput = { title: string; description?: string; tone?: ToastTone };

type ToastValue = { toast: (input: ToastInput) => void; dismiss: (id: string) => void };

const ToastContext = createContext<ToastValue | null>(null);

let toastSequence = 0;
function nextToastId(): string {
  toastSequence += 1;
  return `toast-${toastSequence}`;
}

const TONE_STYLES: Record<ToastTone, { icon: typeof Info; className: string }> = {
  success: { icon: CheckCircle2, className: "text-accent" },
  error: { icon: TriangleAlert, className: "text-danger" },
  info: { icon: Info, className: "text-muted" },
};

function ToastItem({
  item,
  onDismiss,
  dismissLabel,
}: {
  item: ToastRecord;
  onDismiss: (id: string) => void;
  dismissLabel: string;
}) {
  const { icon: Icon, className } = TONE_STYLES[item.tone];

  useEffect(() => {
    const timer = window.setTimeout(() => onDismiss(item.id), 5200);
    return () => window.clearTimeout(timer);
  }, [item.id, onDismiss]);

  return (
    <motion.li
      layout={false}
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.98 }}
      transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
      className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border border-line bg-panel px-4 py-3 shadow-lift"
    >
      <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", className)} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-heading">{item.title}</p>
        {item.description ? <p className="mt-0.5 text-xs leading-relaxed text-muted">{item.description}</p> : null}
      </div>
      <button
        type="button"
        onClick={() => onDismiss(item.id)}
        className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-muted transition hover:bg-page hover:text-heading"
        aria-label={dismissLabel}
      >
        <X className="h-3.5 w-3.5" aria-hidden />
      </button>
    </motion.li>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const { dict } = useI18n();
  const [items, setItems] = useState<ToastRecord[]>([]);

  const dismiss = useCallback((id: string) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const toast = useCallback((input: ToastInput) => {
    setItems((current) => [
      ...current.slice(-2),
      { id: nextToastId(), title: input.title, description: input.description, tone: input.tone ?? "info" },
    ]);
  }, []);

  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed inset-x-4 bottom-4 z-[100] flex flex-col items-center gap-2 sm:inset-x-auto sm:right-6 sm:bottom-6 sm:items-end"
      >
        <AnimatePresence initial={false}>
          {items.map((item) => (
            <ToastItem key={item.id} item={item} onDismiss={dismiss} dismissLabel={dict.common.dismiss} />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside ToastProvider");
  return context;
}
