import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

const TONES = {
  info: {
    className: "border-accent-line bg-accent-soft text-accent",
    Icon: Info,
  },
  error: {
    className: "border-danger/25 bg-danger-soft text-danger",
    Icon: AlertTriangle,
  },
  success: {
    className: "border-accent-line bg-accent-soft text-accent",
    Icon: CheckCircle2,
  },
  warning: {
    className: "border-warn/35 bg-warn-soft text-warn",
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
