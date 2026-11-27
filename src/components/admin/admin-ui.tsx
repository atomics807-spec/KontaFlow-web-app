import type { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function AdminPageHeader({
  eyebrow,
  title,
  lead,
  icon: Icon,
  badge,
}: {
  eyebrow: string;
  title: string;
  lead: string;
  icon?: LucideIcon;
  badge?: string | number;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="text-[0.65rem] font-bold uppercase tracking-[0.16em] text-[#3f6b52]">{eyebrow}</p>
        <h1 className="mt-1 flex items-center gap-2 text-2xl font-extrabold tracking-tight text-[#151c19]">
          {Icon ? <Icon className="h-6 w-6 text-[#3f6b52]" aria-hidden /> : null}
          {title}
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-[#151c19]/55">{lead}</p>
      </div>
      {badge !== undefined ? <Badge tone="mango">{badge}</Badge> : null}
    </header>
  );
}

export function AdminStat({
  label,
  value,
  detail,
  tone = "neutral",
}: {
  label: string;
  value: string | number;
  detail?: string;
  tone?: "neutral" | "success" | "warning" | "danger" | "accent";
}) {
  const tones = {
    neutral: "border-black/8 bg-white text-[#151c19]",
    success: "border-[#b9d7b0] bg-[#edf4e8] text-[#2f5735]",
    warning: "border-[#e9d4a8] bg-[#fbf4e3] text-[#6d4b13]",
    danger: "border-[#efc4b8] bg-[#fbeee9] text-[#8b2d18]",
    accent: "border-[#c9e46a]/40 bg-[#eef3da] text-[#24301f]",
  } as const;

  return (
    <div className={`rounded-2xl border p-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)] ${tones[tone]}`}>
      <p className="text-[0.65rem] font-bold uppercase tracking-[0.14em] opacity-50">{label}</p>
      <p className="mt-2 text-2xl font-extrabold tracking-tight">{value}</p>
      {detail ? <p className="mt-1 text-xs opacity-55">{detail}</p> : null}
    </div>
  );
}

export function AdminSection({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-black/8 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-extrabold tracking-tight text-[#151c19]">{title}</h2>
          {description ? <p className="mt-1 text-xs text-[#151c19]/50">{description}</p> : null}
        </div>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function AdminBars({
  data,
  label,
}: {
  data: { label: string; value: number }[];
  label: string;
}) {
  const max = Math.max(...data.map((item) => item.value), 1);
  return (
    <div className="space-y-2" aria-label={label}>
      {data.length === 0 ? (
        <p className="rounded-xl bg-[#f4f2ec] px-4 py-5 text-sm text-[#151c19]/45">—</p>
      ) : (
        data.map((item) => (
          <div key={item.label} className="grid grid-cols-[7.5rem_1fr_3.5rem] items-center gap-3">
            <span className="truncate text-xs font-semibold text-[#151c19]/60">{item.label}</span>
            <span className="h-2 overflow-hidden rounded-full bg-[#eeece5]">
              <span
                className="block h-full rounded-full bg-[#3f6b52]"
                style={{ width: `${Math.max(2, Math.round((item.value / max) * 100))}%` }}
              />
            </span>
            <span className="text-right text-xs font-bold tabular-nums text-[#151c19]">
              {item.value.toLocaleString()}
            </span>
          </div>
        ))
      )}
    </div>
  );
}

export function AdminEmpty({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl bg-[#f4f2ec] px-4 py-6 text-center text-sm text-[#151c19]/45">{children}</p>
  );
}
