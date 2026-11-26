import { AdaptiveImage } from "@/components/pwa/adaptive-image";
import Link from "next/link";
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  BookOpenCheck,
  Bot,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  CloudOff,
  Download,
  FileBarChart2,
  Globe2,
  MessageCircle,
  Phone,
  ReceiptText,
  Send,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
  WalletCards,
  WifiOff,
  Zap,
} from "lucide-react";
import type { HomeCopy } from "@/lib/content/types";
import type { Locale } from "@/lib/i18n/config";
import { buttonVariants } from "@/components/ui/button";
import { Reveal } from "@/components/motion/reveal";
import { cn } from "@/lib/utils";
import { CtaBand, FaqList, PricingTiers, SectionHeading } from "./site";
import { sampleMoney, type HomeLabels } from "./home-hero";

export function PositioningSection({ copy }: { copy: HomeCopy }) {
  return (
    <section className="py-20 sm:py-24">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[0.82fr_1.18fr] lg:gap-16">
          <Reveal>
            <p className="text-[0.7rem] font-bold uppercase tracking-[0.16em] text-accent">
              {copy.position.eyebrow}
            </p>
            <h2 className="mt-3 text-balance text-3xl font-extrabold tracking-tight text-heading sm:text-4xl">
              {copy.position.title}
            </h2>
            <p className="mt-5 max-w-lg text-base leading-relaxed text-muted">{copy.position.body}</p>
            <div className="mt-8 flex flex-wrap gap-2">
              {copy.position.stack.map((item) => (
                <span
                  key={item}
                  className="rounded-full border border-line bg-panel px-3 py-1 text-[0.65rem] font-semibold text-muted"
                >
                  {item}
                </span>
              ))}
            </div>
          </Reveal>
          <div className="grid gap-4 sm:grid-cols-2">
            {copy.position.points.map((point, index) => {
              const icons = [WalletCards, BookOpenCheck, CloudOff];
              const Icon = icons[index] ?? WalletCards;
              return (
                <Reveal key={point.title} delay={index * 0.05}>
                  <article className="h-full rounded-2xl border border-line bg-panel p-6">
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent-soft text-accent-strong">
                      <Icon className="h-5 w-5" aria-hidden />
                    </span>
                    <h3 className="mt-4 text-base font-bold text-heading">{point.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted">{point.body}</p>
                  </article>
                </Reveal>
              );
            })}
            <Reveal delay={0.15} className="sm:col-span-2">
              <div className="flex items-center gap-3 rounded-2xl border border-jade-200 bg-accent-soft px-5 py-4">
                <ShieldCheck className="h-5 w-5 shrink-0 text-accent-strong" aria-hidden />
                <p className="text-sm font-semibold text-heading">
                  {copy.position.note}
                </p>
              </div>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}

export function ProblemSection({ copy }: { copy: HomeCopy }) {
  return (
    <section className="border-y border-line bg-panel py-20 sm:py-24">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading eyebrow={copy.problem.eyebrow} title={copy.problem.title} subtitle={copy.problem.subtitle} />
        <div className="mt-12 grid items-stretch gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <Reveal>
            <figure className="relative h-full min-h-[20rem] overflow-hidden rounded-[1.8rem] border border-line">
              <AdaptiveImage
                src="/images/marketing/market-douala.webp"
                alt={copy.problem.imageAlt}
                fill
                sizes="(max-width: 1024px) 100vw, 52vw"
                className="object-cover"
              />
              <div aria-hidden className="absolute inset-0 bg-[linear-gradient(180deg,rgba(10,51,39,0.05),rgba(10,51,39,0.7))]" />
              <figcaption className="absolute bottom-4 left-4 right-4 text-xs text-white/75">
                {copy.problem.imageCaption}
              </figcaption>
            </figure>
          </Reveal>
          <div className="grid gap-3">
            {copy.problem.cards.map((card, index) => (
              <Reveal key={card.title} delay={index * 0.05}>
                <article className="rounded-2xl border border-line bg-page p-5">
                  <div className="flex items-start gap-4">
                    <span className="kpi-value grid h-9 w-9 shrink-0 place-items-center rounded-full bg-danger-soft text-xs font-bold text-danger">
                      0{index + 1}
                    </span>
                    <div>
                      <h3 className="text-base font-bold text-heading">{card.title}</h3>
                      <p className="mt-1.5 text-sm leading-relaxed text-muted">{card.body}</p>
                    </div>
                  </div>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export function SolutionSection({ copy }: { copy: HomeCopy }) {
  return (
    <section className="py-20 sm:py-24">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading eyebrow={copy.solution.eyebrow} title={copy.solution.title} subtitle={copy.solution.subtitle} />
        <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {copy.solution.cards.map((card, index) => {
            const icons = [Zap, ReceiptText, BarChart3, Bot];
            const Icon = icons[index] ?? Zap;
            return (
              <Reveal key={card.title} delay={index * 0.05}>
                <article className="relative h-full overflow-hidden rounded-2xl border border-line bg-panel p-6">
                  <span aria-hidden className="absolute -right-6 -top-6 kpi-value text-6xl font-bold text-accent-soft">
                    0{index + 1}
                  </span>
                  <span className="relative grid h-10 w-10 place-items-center rounded-xl bg-forest text-white">
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <h3 className="relative mt-5 text-base font-bold text-heading">{card.title}</h3>
                  <p className="relative mt-2 text-sm leading-relaxed text-muted">{card.body}</p>
                </article>
              </Reveal>
            );
          })}
        </div>
        <Reveal delay={0.1}>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2 rounded-2xl border border-line bg-panel px-4 py-3 text-[0.68rem] font-semibold text-muted">
            {copy.hero.channels.map((channel, index) => (
              <span key={channel} className="flex items-center gap-2">
                {index > 0 ? <ChevronRight className="h-3 w-3 text-line-strong" aria-hidden /> : null}
                <span className="rounded-full bg-page px-2.5 py-1 text-heading">{channel}</span>
              </span>
            ))}
            <span className="ml-1 text-muted">{copy.solution.ledgerNote}</span>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export function AiSection({ copy }: { copy: HomeCopy }) {
  return (
    <section className="relative overflow-hidden bg-forest py-20 text-white sm:py-24">
      <div aria-hidden className="pointer-events-none absolute inset-0 grid-lines opacity-[0.05]" />
      <div className="relative mx-auto grid w-full max-w-7xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-[1fr_0.9fr] lg:px-8">
        <div>
          <SectionHeading
            eyebrow={copy.ai.eyebrow}
            title={copy.ai.title}
            subtitle={copy.ai.subtitle}
            align="left"
            dark
          />
          <ul className="mt-8 space-y-3">
            {copy.ai.bullets.map((bullet) => (
              <li key={bullet} className="flex items-start gap-3 text-sm text-jade-50/85">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-mango-400" aria-hidden />
                {bullet}
              </li>
            ))}
          </ul>
          <p className="mt-6 max-w-md text-xs leading-relaxed text-jade-100/55">{copy.ai.note}</p>
        </div>
        <Reveal delay={0.08}>
          <div className="relative overflow-hidden rounded-[1.8rem] border border-white/15 bg-white/[0.06] p-2">
            <AdaptiveImage
              src="/images/marketing/ai-bookkeeping-phone.webp"
              alt={copy.ai.imageAlt}
              width={900}
              height={600}
              sizes="(max-width: 1024px) 100vw, 44vw"
              className="h-52 w-full rounded-[1.4rem] object-cover sm:h-64"
            />
            <div className="relative -mt-10 space-y-2.5 px-3 pb-3 sm:px-5">
              <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-mango-500 px-4 py-3 text-sm font-medium text-heading shadow-lg">
                {copy.ai.prompt}
              </div>
              <div className="max-w-[92%] rounded-2xl rounded-bl-sm border border-white/15 bg-forest/90 px-4 py-3 text-sm leading-relaxed text-white/90 shadow-lg backdrop-blur">
                <span className="mb-1 flex items-center gap-2 text-[0.58rem] font-bold uppercase tracking-wider text-jade-300">
                  <Bot className="h-3.5 w-3.5" aria-hidden />
                  KontaFlow AI
                </span>
                {copy.ai.reply}
              </div>
              <div className="flex gap-2">
                <span className="rounded-full bg-jade-600 px-3 py-1.5 text-[0.65rem] font-bold text-white">
                  {copy.ai.confirm}
                </span>
                <span className="rounded-full border border-white/20 px-3 py-1.5 text-[0.65rem] font-semibold text-white/75">
                  {copy.ai.edit}
                </span>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function DashboardMock({
  locale,
  labels,
  sampleRows,
}: {
  locale: Locale;
  labels: HomeLabels;
  sampleRows: { label: string; channel: string }[];
}) {
  return (
    <div className="overflow-hidden rounded-[1.8rem] border border-line bg-panel shadow-pop">
      <div className="flex items-center gap-2 border-b border-line bg-page px-4 py-3">
        <span className="h-2.5 w-2.5 rounded-full bg-danger/60" aria-hidden />
        <span className="h-2.5 w-2.5 rounded-full bg-warn/60" aria-hidden />
        <span className="h-2.5 w-2.5 rounded-full bg-jade-400/70" aria-hidden />
        <span className="ml-3 flex-1 rounded-md bg-panel px-3 py-1 text-center text-[0.58rem] font-medium text-muted">
          app.kontaflow.com/{locale}/dashboard
        </span>
        <span className="rounded-full bg-warn-soft px-2 py-0.5 text-[0.5rem] font-bold uppercase text-warn">
          {labels.sample}
        </span>
      </div>
      <div className="grid sm:grid-cols-[7.5rem_1fr]">
        <aside className="hidden border-r border-line bg-page/60 p-3 sm:block">
          <p className="flex items-center gap-2 rounded-lg bg-accent-soft px-2 py-1.5 text-[0.55rem] font-bold text-accent-strong">
            <BarChart3 className="h-3 w-3" aria-hidden />
            {labels.dashboard}
          </p>
          {[
            [ReceiptText, labels.transactions],
            [FileBarChart2, labels.reports],
            [Bot, labels.assistant],
            [Users, labels.team],
            [ShieldCheck, labels.settings],
          ].map(([Icon, label]) => {
            const ItemIcon = Icon as typeof ReceiptText;
            return (
              <p key={String(label)} className="mt-2 flex items-center gap-2 px-2 py-1.5 text-[0.55rem] text-muted">
                <ItemIcon className="h-3 w-3" aria-hidden />
                {String(label)}
              </p>
            );
          })}
        </aside>
        <div className="p-4 sm:p-5">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="text-[0.6rem] text-muted">{labels.thisMonth}</p>
              <h3 className="text-base font-extrabold text-heading">Nkeng Fresh Foods</h3>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-2 py-1 text-[0.5rem] font-bold text-accent-strong">
              <span className="h-1.5 w-1.5 rounded-full bg-jade-500" aria-hidden />
              {labels.saved}
            </span>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { label: labels.income, value: 1240000, tone: "text-jade-700" },
              { label: labels.expenses, value: 760000, tone: "text-clay" },
              { label: labels.profit, value: 480000, tone: "text-accent-strong" },
              { label: labels.cash, value: 185000, tone: "text-heading" },
            ].map((item) => (
              <div key={item.label} className="rounded-xl border border-line bg-page px-2.5 py-2">
                <p className="text-[0.48rem] uppercase tracking-wide text-muted">{item.label}</p>
                <p className={cn("kpi-value mt-1 text-[0.64rem] font-bold", item.tone)}>{sampleMoney(locale, item.value)}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-xl border border-line p-3">
            <div className="flex items-center justify-between">
              <p className="text-[0.58rem] font-bold text-heading">{labels.recent}</p>
              <span className="text-[0.5rem] text-muted">{labels.thisMonth}</span>
            </div>
            <div className="mt-3 flex h-24 items-end gap-2">
              {[34, 52, 42, 68, 57, 84, 64, 73, 45, 78, 62, 90].map((height, index) => (
                <div key={index} className="flex flex-1 flex-col justify-end gap-0.5">
                  <span style={{ height: `${height * 0.55}%` }} className="rounded-t-sm bg-jade-400" />
                  <span style={{ height: `${height * 0.3}%` }} className="rounded-t-sm bg-mango-400" />
                </div>
              ))}
            </div>
          </div>
          <div className="mt-3 space-y-1.5">
            {sampleRows.map((row, index) => {
              const Icon = [MessageCircle, Globe2, WifiOff][index] ?? MessageCircle;
              return (
              <div key={row.label} className="flex items-center justify-between rounded-lg bg-page px-2.5 py-2">
                <span className="flex items-center gap-2 text-[0.55rem] font-semibold text-heading">
                  <Icon className="h-3 w-3 text-accent-strong" aria-hidden />
                  {row.label}
                </span>
                <span className="text-[0.48rem] text-muted">{row.channel}</span>
              </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export function DashboardSection({
  locale,
  copy,
  labels,
}: {
  locale: Locale;
  copy: HomeCopy;
  labels: HomeLabels;
}) {
  return (
    <section className="border-y border-line bg-panel py-20 sm:py-24">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading eyebrow={copy.dashboard.eyebrow} title={copy.dashboard.title} subtitle={copy.dashboard.subtitle} />
        <div className="mt-12 grid items-center gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:gap-14">
          <Reveal>
            <DashboardMock locale={locale} labels={labels} sampleRows={copy.dashboard.sampleRows} />
          </Reveal>
          <Reveal delay={0.08}>
            <ul className="space-y-4">
              {copy.dashboard.bullets.map((bullet) => (
                <li key={bullet} className="flex items-start gap-3 rounded-xl border border-line bg-page px-4 py-3.5 text-sm leading-relaxed text-muted">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent-strong" aria-hidden />
                  {bullet}
                </li>
              ))}
            </ul>
            <p className="mt-5 text-xs text-muted">{copy.dashboard.note}</p>
            <Link href={`/${locale}/signup`} className={buttonVariants({ className: "mt-6" })}>
              {copy.hero.primary}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

export function IncomeExpenseSection({ copy }: { copy: HomeCopy }) {
  return (
    <section className="py-20 sm:py-24">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-10 lg:grid-cols-[0.92fr_1.08fr] lg:gap-14">
          <Reveal>
            <div className="relative overflow-hidden rounded-[1.8rem] border border-line">
              <AdaptiveImage
                src="/images/marketing/mobile-money.webp"
                alt={copy.incomeExpense.imageAlt}
                width={1200}
                height={900}
                sizes="(max-width: 1024px) 100vw, 46vw"
                className="h-[24rem] w-full object-cover"
              />
              <div aria-hidden className="absolute inset-0 bg-[linear-gradient(180deg,transparent_50%,rgba(10,51,39,0.55))]" />
              <div className="absolute bottom-4 left-4 right-4 flex items-center gap-3 rounded-2xl border border-white/20 bg-forest/85 p-3 text-white backdrop-blur">
                <CircleDollarSign className="h-5 w-5 text-mango-400" aria-hidden />
                <p className="text-xs font-semibold">{copy.incomeExpense.caption}</p>
              </div>
            </div>
          </Reveal>
          <div>
            <SectionHeading
              eyebrow={copy.incomeExpense.eyebrow}
              title={copy.incomeExpense.title}
              subtitle={copy.incomeExpense.subtitle}
              align="left"
            />
            <div className="mt-8 space-y-3">
              {copy.incomeExpense.cards.map((card, index) => (
                <Reveal key={card.title} delay={index * 0.05}>
                  <article className="flex gap-4 rounded-2xl border border-line bg-panel p-5">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent-strong">
                      {index === 0 ? (
                        <ArrowDownLeft className="h-5 w-5" aria-hidden />
                      ) : index === 1 ? (
                        <ArrowUpRight className="h-5 w-5" aria-hidden />
                      ) : (
                        <ReceiptText className="h-5 w-5" aria-hidden />
                      )}
                    </span>
                    <div>
                      <h3 className="text-base font-bold text-heading">{card.title}</h3>
                      <p className="mt-1.5 text-sm leading-relaxed text-muted">{card.body}</p>
                    </div>
                  </article>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function AnalysisSection({ copy }: { copy: HomeCopy }) {
  return (
    <section className="border-y border-line bg-panel py-20 sm:py-24">
      <div className="mx-auto grid w-full max-w-7xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
        <div>
          <SectionHeading
            eyebrow={copy.analysis.eyebrow}
            title={copy.analysis.title}
            subtitle={copy.analysis.subtitle}
            align="left"
          />
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {copy.analysis.cards.map((card) => (
              <div key={card.title} className="rounded-2xl border border-line bg-page p-5">
                <h3 className="text-sm font-bold text-heading">{card.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{card.body}</p>
              </div>
            ))}
            <div className="flex items-center gap-3 rounded-2xl border border-jade-200 bg-accent-soft p-5 sm:col-span-2">
              <FileBarChart2 className="h-5 w-5 shrink-0 text-accent-strong" aria-hidden />
              <p className="text-sm font-semibold text-heading">{copy.analysis.note}</p>
            </div>
          </div>
        </div>
        <Reveal delay={0.08}>
          <div className="rounded-[1.8rem] border border-line bg-page p-5 shadow-soft sm:p-7">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[0.6rem] font-bold uppercase tracking-wider text-muted">
                  {copy.analysis.chart.kicker}
                </p>
                <p className="mt-1 text-lg font-extrabold text-heading">{copy.analysis.chart.title}</p>
              </div>
              <span className="rounded-full bg-warn-soft px-2.5 py-1 text-[0.55rem] font-bold uppercase text-warn">
                {copy.analysis.chart.sample}
              </span>
            </div>
            <div className="mt-6 space-y-4">
              {copy.analysis.chart.categories.map((item, index) => (
                <div key={item.label}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-heading">{item.label}</span>
                    <span className="kpi-value text-muted">{item.pct}%</span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-panel-muted">
                    <div
                      className={cn(
                        "h-full rounded-full",
                        ["bg-jade-500", "bg-mango-500", "bg-jade-700", "bg-mango-400", "bg-jade-300"][index] ??
                          "bg-jade-500",
                      )}
                      style={{ width: `${item.pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6 rounded-xl border border-line bg-panel p-4">
              <p className="flex items-center gap-2 text-[0.6rem] font-bold uppercase tracking-wider text-accent">
                <TrendingUp className="h-3.5 w-3.5" aria-hidden />
                {copy.analysis.chart.period}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-muted">{copy.analysis.chart.note}</p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export function OfflineSection({ copy }: { copy: HomeCopy }) {
  return (
    <section className="py-20 sm:py-24">
      <div className="mx-auto grid w-full max-w-7xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8">
        <Reveal>
          <div className="relative overflow-hidden rounded-[1.8rem] border border-line bg-forest">
            <AdaptiveImage
              src="/images/marketing/phone-feature.webp"
              alt={copy.offline.imageAlt}
              width={700}
              height={1000}
              sizes="(max-width: 1024px) 100vw, 42vw"
              className="h-[25rem] w-full object-cover opacity-90"
            />
            <div aria-hidden className="absolute inset-0 bg-[linear-gradient(180deg,rgba(10,51,39,0.1),rgba(10,51,39,0.9))]" />
            <div className="absolute bottom-4 left-4 right-4 rounded-2xl border border-white/15 bg-forest/90 p-4 backdrop-blur">
              <div className="flex items-center gap-2 text-[0.65rem] font-bold uppercase tracking-wider text-mango-400">
                <CloudOff className="h-4 w-4" aria-hidden />
                {copy.offline.queued}
              </div>
              <div className="mt-3 flex items-center gap-2 text-xs text-jade-100/80">
                <CheckCircle2 className="h-4 w-4 text-jade-300" aria-hidden />
                {copy.offline.synced}
              </div>
            </div>
          </div>
        </Reveal>
        <div>
          <SectionHeading
            eyebrow={copy.offline.eyebrow}
            title={copy.offline.title}
            subtitle={copy.offline.subtitle}
            align="left"
          />
          <ul className="mt-8 space-y-3">
            {copy.offline.bullets.map((bullet) => (
              <li key={bullet} className="flex items-start gap-3 text-sm leading-relaxed text-muted">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent-strong" aria-hidden />
                {bullet}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

export function WhatsAppSection({ copy }: { copy: HomeCopy }) {
  return (
    <section className="border-y border-line bg-accent-soft/60 py-20 sm:py-24">
      <div className="mx-auto grid w-full max-w-7xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:px-8">
        <div>
          <SectionHeading
            eyebrow={copy.whatsapp.eyebrow}
            title={copy.whatsapp.title}
            subtitle={copy.whatsapp.subtitle}
            align="left"
          />
          <ul className="mt-8 space-y-3">
            {copy.whatsapp.bullets.map((bullet) => (
              <li key={bullet} className="flex items-start gap-3 text-sm leading-relaxed text-muted">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent-strong" aria-hidden />
                {bullet}
              </li>
            ))}
          </ul>
          <p className="mt-5 text-xs leading-relaxed text-muted">{copy.whatsapp.note}</p>
        </div>
        <Reveal delay={0.08}>
          <div className="mx-auto w-full max-w-sm rounded-[2rem] border border-line bg-panel p-3 shadow-pop">
            <div className="flex items-center gap-3 rounded-t-[1.4rem] border-b border-line bg-[#075e54] px-4 py-3 text-white">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-white/15">
                <MessageCircle className="h-4 w-4" aria-hidden />
              </span>
              <div>
                <p className="text-xs font-bold">KontaFlow</p>
                <p className="text-[0.55rem] text-white/70">{copy.whatsapp.businessLabel}</p>
              </div>
              <Phone className="ml-auto h-3.5 w-3.5 opacity-70" aria-hidden />
            </div>
            <div className="space-y-2.5 bg-[#ece5dd] px-3 py-4">
              {copy.whatsapp.chat.map((message, index) => (
                <div
                  key={`${message.from}-${index}`}
                  className={cn(
                    "max-w-[86%] rounded-xl px-3 py-2 text-[0.7rem] leading-relaxed shadow-sm",
                    message.from === "us"
                      ? "ml-auto rounded-br-sm bg-[#dcf8c6] text-heading"
                      : "rounded-bl-sm bg-white text-heading",
                  )}
                >
                  {message.text}
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 rounded-b-[1.4rem] bg-panel-muted px-3 py-2">
              <span className="flex-1 rounded-full bg-panel px-3 py-2 text-[0.6rem] text-muted">
                {copy.whatsapp.messagePlaceholder}
              </span>
              <span className="grid h-7 w-7 place-items-center rounded-full bg-[#075e54] text-white">
                <Send className="h-3 w-3" aria-hidden />
              </span>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export function UssdSection({ copy }: { copy: HomeCopy }) {
  return (
    <section className="relative overflow-hidden bg-forest py-20 text-white sm:py-24">
      <div aria-hidden className="pointer-events-none absolute -right-24 top-0 h-96 w-96 rounded-full bg-[radial-gradient(circle,rgba(242,182,75,0.14),transparent_65%)] blur-2xl" />
      <div className="relative mx-auto grid w-full max-w-7xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-[0.95fr_1.05fr] lg:px-8">
        <Reveal>
          <div className="mx-auto w-full max-w-xs rounded-[2.2rem] border-[8px] border-[#1a2c25] bg-[#c8d0b7] p-2 shadow-pop">
            <div className="mx-auto mb-2 h-2 w-12 rounded-full bg-[#1a2c25]/50" />
            <div className="rounded-xl bg-[#101d17] p-4 font-mono text-[0.68rem] text-[#d8f5c8] shadow-inner">
              <p className="text-center text-[0.58rem] text-[#8fbf78]">MTN CAMEROON</p>
              <p className="mt-3 text-center text-sm font-bold text-white">{copy.ussd.screenTitle}</p>
              <p className="mt-4 text-[0.6rem] font-semibold text-[#f2e3a6]">{copy.ussd.screenTitle}</p>
              <ol className="mt-2 space-y-1.5">
                {copy.ussd.screenLines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ol>
              <p className="mt-4 border-t border-[#2a4030] pt-2 text-[0.55rem] text-[#8fbf78]">
                {copy.ussd.screenFooter}
              </p>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-1">
              {Array.from({ length: 9 }).map((_, index) => (
                <span key={index} className="rounded bg-[#1a2c25]/20 py-1.5 text-center font-mono text-[0.55rem] text-[#1a2c25]">
                  {index + 1}
                </span>
              ))}
            </div>
          </div>
        </Reveal>
        <div>
          <SectionHeading
            eyebrow={copy.ussd.eyebrow}
            title={copy.ussd.title}
            subtitle={copy.ussd.subtitle}
            align="left"
            dark
          />
          <ul className="mt-8 space-y-3">
            {copy.ussd.bullets.map((bullet) => (
              <li key={bullet} className="flex items-start gap-3 text-sm leading-relaxed text-jade-50/85">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-mango-400" aria-hidden />
                {bullet}
              </li>
            ))}
          </ul>
          <p className="mt-5 text-xs leading-relaxed text-jade-100/55">{copy.ussd.note}</p>
        </div>
      </div>
    </section>
  );
}

export function ReportsSection({ copy }: { copy: HomeCopy }) {
  return (
    <section className="py-20 sm:py-24">
      <div className="mx-auto grid w-full max-w-7xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:px-8">
        <div>
          <SectionHeading
            eyebrow={copy.reports.eyebrow}
            title={copy.reports.title}
            subtitle={copy.reports.subtitle}
            align="left"
          />
          <p className="mt-5 max-w-lg text-sm leading-relaxed text-muted">{copy.reports.body}</p>
          <div className="mt-7 grid gap-2 sm:grid-cols-2">
            {copy.reports.items.map((item) => (
              <div key={item} className="flex items-center gap-2 rounded-xl border border-line bg-panel px-3 py-2.5 text-sm font-semibold text-heading">
                <FileBarChart2 className="h-4 w-4 shrink-0 text-accent-strong" aria-hidden />
                {item}
              </div>
            ))}
          </div>
        </div>
        <Reveal delay={0.08}>
          <div className="relative overflow-hidden rounded-[1.8rem] border border-line">
            <AdaptiveImage
              src="/images/marketing/analysis-report.webp"
              alt={copy.reports.imageAlt}
              width={1200}
              height={800}
              sizes="(max-width: 1024px) 100vw, 45vw"
              className="h-[26rem] w-full object-cover"
            />
            <div aria-hidden className="absolute inset-0 bg-[linear-gradient(180deg,transparent_45%,rgba(10,51,39,0.78))]" />
            <div className="absolute bottom-4 left-4 right-4 rounded-2xl border border-white/20 bg-forest/90 p-4 text-white backdrop-blur">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[0.6rem] font-bold uppercase tracking-wider text-mango-400">
                    {copy.reports.packTitle}
                  </p>
                  <p className="mt-1 text-sm font-semibold">{copy.reports.packLine}</p>
                </div>
                <span className="grid h-9 w-9 place-items-center rounded-full bg-white/10">
                  <Download className="h-4 w-4" aria-hidden />
                </span>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export function IntelligenceSection({ copy }: { copy: HomeCopy }) {
  return (
    <section className="border-y border-line bg-panel py-20 sm:py-24">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow={copy.intelligence.eyebrow}
          title={copy.intelligence.title}
          subtitle={copy.intelligence.subtitle}
        />
        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {copy.intelligence.insights.map((insight, index) => (
            <Reveal key={insight.label} delay={index * 0.05}>
              <article className="h-full rounded-2xl border border-line bg-page p-5">
                <div className="flex items-center justify-between">
                  <p className="text-[0.65rem] font-bold uppercase tracking-wider text-muted">{insight.label}</p>
                  <Sparkles className="h-4 w-4 text-mango-500" aria-hidden />
                </div>
                <p className="mt-4 text-2xl font-extrabold tracking-tight text-heading">{insight.value}</p>
                <p className="mt-1 text-xs text-muted">{insight.note}</p>
                <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-panel-muted">
                  <div
                    className={cn("h-full rounded-full", index === 0 ? "bg-mango-500" : "bg-jade-500")}
                    style={{ width: `${58 + index * 13}%` }}
                  />
                </div>
              </article>
            </Reveal>
          ))}
        </div>
        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_0.8fr] lg:items-center">
          <ul className="grid gap-2 sm:grid-cols-3">
            {copy.intelligence.bullets.map((bullet) => (
              <li key={bullet} className="flex items-start gap-2 rounded-xl border border-line bg-page px-3 py-3 text-xs leading-relaxed text-muted">
                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent-strong" aria-hidden />
                {bullet}
              </li>
            ))}
          </ul>
          <p className="text-xs leading-relaxed text-muted">{copy.intelligence.note}</p>
        </div>
      </div>
    </section>
  );
}

export function SubscriptionSection({ locale, copy }: { locale: Locale; copy: HomeCopy }) {
  return (
    <section id="pricing" className="scroll-mt-24 py-20 sm:py-24">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow={copy.subscription.eyebrow}
          title={copy.subscription.title}
          subtitle={copy.subscription.subtitle}
        />
        <PricingTiers tiers={copy.subscription.tiers} locale={locale} footnote={copy.subscription.footnote} />
      </div>
    </section>
  );
}

export function FaqSection({ copy }: { copy: HomeCopy }) {
  return (
    <section className="border-y border-line bg-panel py-20 sm:py-24">
      <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[0.7fr_1.3fr] lg:px-8">
        <div>
          <SectionHeading
            eyebrow={copy.faq.eyebrow}
            title={copy.faq.title}
            subtitle={copy.faq.subtitle}
            align="left"
          />
          <Link href="./faq" className="mt-6 inline-flex items-center gap-1.5 text-sm font-bold text-accent-strong hover:underline">
            {copy.faq.viewAll}
            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </div>
        <FaqList items={copy.faq.items} />
      </div>
    </section>
  );
}

export function HomeFinalCta({ locale, copy }: { locale: Locale; copy: HomeCopy }) {
  return (
    <CtaBand
      title={copy.finalCta.title}
      body={copy.finalCta.subtitle}
      primary={copy.finalCta.primary}
      secondary={copy.finalCta.secondary}
      locale={locale}
      href="signup"
      secondaryHref="contact"
    />
  );
}
