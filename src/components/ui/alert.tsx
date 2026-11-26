import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

const TONES = {
  info: {
    className: "border-jade-200 bg-jade-50 text-jade-700",
    Icon: Info,
  },
  error: {
    className: "border-clay/25 bg-clay-soft text-clay",
    Icon: AlertTriangle,
  },
  success: {
    className: "border-jade-200 bg-jade-50 text-jade-700",
    Icon: CheckCircle2,
  },
  warning: {
    className: "border-mango-400/40 bg-mango-100 text-mango-600",
    Icon: AlertTriangle,
  },
} as const;

export function Alert({
  tone = "info",
  children,
  className,
  ...props
}: ComponentProps<"div"> & { tone?: keyof typeof TONES }) {
  const { className: toneClass, Icon } = TONES[tone];
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn("flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-sm", toneClass, className)}
      {...props}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
