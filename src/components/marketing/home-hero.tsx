import Image from "next/image";
import Link from "next/link";
import { ArrowDownLeft, ArrowRight, ArrowUpRight, CheckCircle2, Sparkles, TrendingUp } from "lucide-react";
import type { HomeCopy } from "@/lib/content/types";
import { intlLocale, type Locale } from "@/lib/i18n/config";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type HomeLabels = {
  income: string;
  expenses: string;
  profit: string;
  cash: string;
  thisMonth: string;
  recent: string;
  sample: string;
  dashboard: string;
  transactions: string;
  reports: string;
  assistant: string;
  settings: string;
  saved: string;
  team: string;
};

export function sampleMoney(locale: Locale, value: number): string {
  return `${new Intl.NumberFormat(intlLocale(locale), { maximumFractionDigits: 0 }).format(value)} FCFA`;
}

function DashboardCard({
  locale,
  labels,
  weekdays,
  className,
}: {
  locale: Locale;
  labels: HomeLabels;
  weekdays: string[];
  className?: string;
}) {
  const bars = [42, 58, 49, 76, 64, 88, 72];
  return (
    <div className={cn("rounded-2xl border border-line bg-panel p-4 text-ink shadow-pop", className)}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-forest text-[0.62rem] font-extrabold text-white">
            NF
          </span>
          <div>
            <p className="text-[0.65rem] font-bold text-heading">Nkeng Fresh Foods</p>
            <p className="text-[0.55rem] text-muted">{labels.thisMonth}</p>
          </div>
        </div>
        <span className="rounded-full bg-warn-soft px-2 py-0.5 text-[0.5rem] font-bold uppercase tracking-wider text-warn">
          {labels.sample}
        </span>
      </div>

      <dl className="mt-4 grid grid-cols-3 gap-2">
        {[
          { label: labels.income, value: 1240000, icon: ArrowDownLeft, className: "text-jade-700" },
          { label: labels.expenses, value: 760000, icon: ArrowUpRight, className: "text-mango-600" },
          { label: labels.profit, value: 480000, icon: TrendingUp, className: "text-accent-strong" },
        ].map((item) => (
          <div key={item.label} className="rounded-xl bg-page px-2.5 py-2">
            <dt className="flex items-center gap-1 text-[0.5rem] font-semibold uppercase tracking-wide text-muted">
              <item.icon className={cn("h-2.5 w-2.5", item.className)} aria-hidden />
              {item.label}
            </dt>
            <dd className="kpi-value mt-1 text-[0.66rem] font-bold text-heading">{sampleMoney(locale, item.value)}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-4 flex h-16 items-end gap-1.5" aria-hidden>
        {bars.map((height, index) => (
          <span
            key={index}
            style={{ height: `${height}%` }}
            className={cn("flex-1 rounded-t-sm", index === 5 ? "bg-jade-500" : "bg-accent-soft")}
          />
        ))}
      </div>
      <div className="mt-2 flex justify-between text-[0.48rem] uppercase tracking-wide text-muted">
        {weekdays.map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>
    </div>
  );
}

function PhonePreview({
  locale,
  labels,
  sampleRows,
  className,
}: {
  locale: Locale;
  labels: HomeLabels;
  sampleRows: { label: string; channel: string }[];
  className?: string;
}) {
  return (
    <div
      className={cn(
        "w-[10.5rem] rounded-[1.75rem] border-[6px] border-forest bg-page p-3 shadow-pop",
        className,
      )}
      aria-label={labels.sample}
    >
      <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-forest/30" />
      <p className="text-[0.52rem] font-bold text-heading">Nkeng Fresh Foods</p>
      <p className="mt-2 text-[0.48rem] uppercase tracking-wider text-muted">{labels.cash}</p>
      <p className="kpi-value mt-0.5 text-sm font-bold text-heading">{sampleMoney(locale, 185000)}</p>
      <div className="mt-3 grid grid-cols-2 gap-1.5">
        <span className="rounded-lg bg-jade-600 px-1.5 py-2 text-center text-[0.48rem] font-bold text-white">
          + {labels.income}
        </span>
        <span className="rounded-lg bg-mango-500 px-1.5 py-2 text-center text-[0.48rem] font-bold text-heading">
          − {labels.expenses}
        </span>
      </div>
      <div className="mt-3 space-y-1.5">
        {sampleRows.map((row) => (
          <div key={row.label} className="flex items-center justify-between rounded-lg bg-panel px-2 py-1.5">
            <span className="text-[0.46rem] font-semibold text-heading">{row.label}</span>
            <span className="text-[0.42rem] text-muted">{row.channel}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function HomeHero({
  locale,
  copy,
  labels,
}: {
  locale: Locale;
  copy: HomeCopy;
  labels: HomeLabels;
}) {
  return (
    <section className="relative overflow-hidden bg-forest text-white">
      <div aria-hidden className="pointer-events-none absolute inset-0 grid-lines opacity-[0.06]" />
      <div className="relative mx-auto grid w-full max-w-7xl items-center gap-10 px-4 pb-12 pt-10 sm:px-6 lg:grid-cols-[1.02fr_0.98fr] lg:gap-8 lg:px-8 lg:pb-0 lg:pt-16">
        <div className="animate-rise">
          <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[0.68rem] font-bold uppercase tracking-[0.14em] text-jade-200">
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            {copy.hero.eyebrow}
          </p>
          <h1 className="mt-6 text-balance text-[2.65rem] font-extrabold leading-[1.02] tracking-tight sm:text-6xl lg:text-[4.15rem]">
            {copy.hero.title} <span className="text-jade-300">{copy.hero.accent}</span>
          </h1>
          <p className="mt-6 max-w-xl text-balance text-base leading-relaxed text-jade-50/80 sm:text-lg">
            {copy.hero.subtitle}
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link href={`/${locale}/signup`} className={buttonVariants({ variant: "mango", size: "lg" })}>
              {copy.hero.primary}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            <Link
              href={`/${locale}/features`}
              className={buttonVariants({
                variant: "secondary",
                size: "lg",
                className: "border-white/20 bg-white/10 text-white hover:border-white/35 hover:bg-white/15",
              })}
            >
              {copy.hero.secondary}
            </Link>
          </div>
          <p className="mt-5 flex items-center gap-2 text-xs font-medium text-jade-100/70">
            <CheckCircle2 className="h-3.5 w-3.5 text-mango-400" aria-hidden />
            {copy.hero.note}
          </p>

          <div className="mt-8 flex flex-wrap gap-2">
            {copy.hero.channels.map((channel) => (
              <span
                key={channel}
                className="rounded-full border border-white/12 bg-white/[0.06] px-3 py-1 text-[0.65rem] font-semibold text-jade-100/85"
              >
                {channel}
              </span>
            ))}
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-[34rem] pb-10 lg:max-w-none lg:pb-16">
          <div className="relative aspect-[4/5] overflow-hidden rounded-[2rem] border border-white/15 sm:aspect-[5/5] lg:aspect-[4/4.5] lg:rounded-b-none lg:border-b-0">
            <Image
              src="/images/marketing/home-hero.webp"
              alt={copy.hero.imageAlt}
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 48vw"
              className="object-cover"
            />
            <div
              aria-hidden
              className="absolute inset-0 bg-[linear-gradient(180deg,rgba(10,51,39,0.15)_0%,rgba(10,51,39,0.12)_45%,rgba(10,51,39,0.75)_100%)]"
            />
            <div className="absolute left-4 top-4 max-w-[12.5rem] rounded-2xl border border-white/15 bg-forest/85 p-3 backdrop-blur-md">
              <p className="text-[0.58rem] font-bold uppercase tracking-[0.14em] text-mango-400">
                {copy.hero.overlayTitle}
              </p>
              <p className="mt-1 text-[0.7rem] font-medium leading-relaxed text-white/85">{copy.hero.overlayBody}</p>
            </div>
          </div>

          <DashboardCard
            locale={locale}
            labels={labels}
            weekdays={copy.dashboard.weekdays}
            className="absolute -bottom-2 left-2 w-[78%] max-w-[21rem] sm:-bottom-4 sm:left-0 lg:-left-14"
          />
          <PhonePreview
            locale={locale}
            labels={labels}
            sampleRows={copy.dashboard.sampleRows}
            className="absolute -right-1 bottom-10 hidden rotate-2 sm:block lg:-right-4 lg:bottom-16"
          />
        </div>
      </div>

      <div className="relative border-t border-white/10 bg-forest/60">
        <div className="mx-auto grid w-full max-w-7xl grid-cols-2 divide-x divide-white/10 px-4 sm:grid-cols-4 sm:px-6 lg:px-8">
          {copy.hero.trust.map((item) => (
            <div key={item.label} className="px-2 py-4 sm:px-5">
              <p className="text-[0.6rem] font-bold uppercase tracking-[0.14em] text-mango-400">{item.value}</p>
              <p className="mt-1 text-[0.7rem] text-jade-100/70">{item.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
