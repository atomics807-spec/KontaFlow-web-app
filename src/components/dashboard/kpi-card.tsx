import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

export function KpiCard({
  label,
  value,
  hint,
  deltaTenths,
  deltaLabel,
  inverse = false,
  icon: Icon,
  tone = "neutral",
}: {
  label: string;
  value: string;
  hint?: string;
  deltaTenths?: number | null;
  deltaLabel?: string;
  inverse?: boolean;
  icon?: LucideIcon;
  tone?: "neutral" | "jade" | "mango";
}) {
  const hasDelta = deltaTenths !== null && deltaTenths !== undefined && Number.isFinite(deltaTenths);
  const up = hasDelta && deltaTenths > 0;
  const down = hasDelta && deltaTenths < 0;
  const good = inverse ? down : up;
  const bad = inverse ? up : down;

  return (
    <div className="surface p-5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[0.7rem] font-semibold uppercase tracking-[0.1em] text-muted">{label}</p>
        {Icon ? (
          <span
            className={cn(
              "grid h-8 w-8 place-items-center rounded-lg",
              tone === "jade" && "bg-accent-soft text-accent",
              tone === "mango" && "bg-warn-soft text-warn",
              tone === "neutral" && "bg-page-soft text-muted",
            )}
          >
            <Icon className="h-4 w-4" aria-hidden />
          </span>
        ) : null}
      </div>

      <p className="kpi-value mt-3 text-[1.55rem] font-semibold leading-tight text-heading">{value}</p>

      <div className="mt-2 flex min-h-5 items-center gap-2">
        {hasDelta ? (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[0.7rem] font-bold",
              good && "bg-accent-soft text-accent",
              bad && "bg-danger-soft text-danger",
              !good && !bad && "bg-page-soft text-muted",
            )}
          >
            {up ? (
              <ArrowUpRight className="h-3 w-3" aria-hidden />
            ) : down ? (
              <ArrowDownRight className="h-3 w-3" aria-hidden />
            ) : (
              <Minus className="h-3 w-3" aria-hidden />
            )}
            {Math.abs(deltaTenths / 10).toFixed(1)}%
          </span>
        ) : null}
        <span className="truncate text-xs text-muted">{hasDelta ? deltaLabel : hint}</span>
      </div>
    </div>
  );
}

/** Integer-only percent change in tenths of a percent (avoids float drift). */
export function deltaTenths(current: bigint, previous: bigint): number | null {
  if (previous === 0n) return null;
  const scaled = ((current - previous) * 1000n) / (previous < 0n ? -previous : previous);
  return Number(scaled);
}
