import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-dashed border-sand-300 bg-sand/50 px-6 py-12 text-center",
        className,
      )}
    >
      <span className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-white text-jade-600 shadow-[0_1px_0_rgba(8,20,15,0.04)] ring-1 ring-line">
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <p className="text-sm font-bold text-forest">{title}</p>
      {description ? <p className="mt-1 max-w-sm text-sm text-muted">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
