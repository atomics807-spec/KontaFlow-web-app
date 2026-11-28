import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronRight,
  HandCoins,
  ShoppingBasket,
  Wallet,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { SpeakButton } from "@/components/easy/speak-button";
import { getDashboardForMonth } from "@/services/dashboard";
import { requireWorkspaceContext } from "@/lib/supabase/auth";
import { intlLocale, resolveLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/server";
import { interpolate } from "@/lib/i18n/interpolate";
import { formatMoney, moneyLocale, toMinorUnits } from "@/lib/money";
import { formatDate } from "@/lib/dates";
import { getCurrency } from "@/lib/currency";
import type { DashboardSummary } from "@/types/database";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const dict = await getDictionary(resolveLocale((await params).locale));
  return { title: dict.easy.title, robots: { index: false, follow: false } };
}

export default async function EasyPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ recorded?: string }>;
}) {
  const locale = resolveLocale((await params).locale);
  const dict = await getDictionary(locale);
  const context = await requireWorkspaceContext(locale);
  const { workspace } = context;
  const canRecord = context.can("transactions:create");
  const recorded = (await searchParams).recorded === "1";

  let summary: DashboardSummary | null = null;
  try {
    summary = await getDashboardForMonth(workspace.id, workspace.timezone);
  } catch {
    summary = null;
  }

  const money = (value: string | bigint) =>
    formatMoney(typeof value === "bigint" ? value : toMinorUnits(value), workspace.currency, moneyLocale(locale, workspace.currency));

  const income = summary ? money(summary.totalIncomeMinor) : "—";
  const expense = summary ? money(summary.totalExpenseMinor) : "—";
  const cash = summary ? money(summary.cashBalanceMinor) : "—";
  const receivables = summary ? money(summary.outstandingReceivablesMinor) : "—";
  const payables = summary ? money(summary.outstandingPayablesMinor) : "—";
  const spokenSummary = summary
    ? interpolate(dict.easy.summarySpoken, { income, expense, cash }, { locale: intlLocale(locale) })
    : dict.easy.summaryUnavailable;

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <header className="text-center">
        <Badge tone="jade">{dict.easy.badge}</Badge>
        <h1 className="mt-3 text-3xl font-black tracking-tight text-heading sm:text-4xl">{dict.easy.title}</h1>
        <p className="mx-auto mt-2 max-w-md text-lg font-medium leading-snug text-muted">{dict.easy.subtitle}</p>
        <SpeakButton text={dict.easy.instructionsSpoken} label={dict.easy.listen} className="mt-4" />
      </header>

      {recorded ? <Alert tone="success">{dict.easy.recordedBanner}</Alert> : null}

      {!summary ? <Alert tone="warning">{dict.easy.summaryUnavailable}</Alert> : null}

      <section aria-label={dict.easy.moneyTitle} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-3xl border-2 border-jade-200 bg-jade-50 p-4 text-center">
          <ArrowDownLeft className="mx-auto h-7 w-7 text-accent" aria-hidden />
          <p className="mt-1 text-sm font-bold text-accent">{dict.easy.moneyIn}</p>
          <p className="kpi-value mt-1 text-xl font-black text-heading">{income}</p>
          <p className="text-xs font-semibold text-muted">{dict.easy.thisMonth}</p>
        </div>
        <div className="rounded-3xl border-2 border-danger/20 bg-clay-soft p-4 text-center">
          <ArrowUpRight className="mx-auto h-7 w-7 text-danger" aria-hidden />
          <p className="mt-1 text-sm font-bold text-danger">{dict.easy.moneyOut}</p>
          <p className="kpi-value mt-1 text-xl font-black text-heading">{expense}</p>
          <p className="text-xs font-semibold text-muted">{dict.easy.thisMonth}</p>
        </div>
        <div className="rounded-3xl border-2 border-mango-400 bg-mango-100 p-4 text-center">
          <Wallet className="mx-auto h-7 w-7 text-heading" aria-hidden />
          <p className="mt-1 text-sm font-bold text-heading">{dict.easy.moneyLeft}</p>
          <p className="kpi-value mt-1 text-xl font-black text-heading">{cash}</p>
          <p className="text-xs font-semibold text-muted">{dict.easy.cashToday}</p>
        </div>
      </section>

      {canRecord ? (
      <section aria-label={dict.easy.actionsTitle} className="space-y-3">
        <Link
          href={`/${locale}/easy/record?kind=income`}
          className="group flex min-h-32 items-center gap-4 rounded-3xl bg-jade-600 px-5 py-5 text-white shadow-[0_16px_30px_-18px_rgba(11,122,90,0.9)] transition active:scale-[0.99] hover:bg-jade-700"
        >
          <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-white/15">
            <ShoppingBasket className="h-9 w-9" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-2xl font-black leading-tight">{dict.easy.iSold}</span>
            <span className="mt-0.5 block text-sm font-medium text-jade-50/85">{dict.easy.iSoldHint}</span>
          </span>
          <ChevronRight className="h-7 w-7 shrink-0" aria-hidden />
        </Link>

        <Link
          href={`/${locale}/easy/record?kind=expense`}
          className="group flex min-h-32 items-center gap-4 rounded-3xl bg-danger px-5 py-5 text-white shadow-[0_16px_30px_-18px_rgba(190,18,60,0.9)] transition active:scale-[0.99] hover:bg-danger/90"
        >
          <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-white/15">
            <ArrowUpRight className="h-9 w-9" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-2xl font-black leading-tight">{dict.easy.iSpent}</span>
            <span className="mt-0.5 block text-sm font-medium text-white/85">{dict.easy.iSpentHint}</span>
          </span>
          <ChevronRight className="h-7 w-7 shrink-0" aria-hidden />
        </Link>
      </section>
      ) : (
        <Alert tone="info">{dict.easy.viewOnly}</Alert>
      )}

      <SpeakButton text={spokenSummary} label={dict.easy.hearMoney} className="w-full bg-mango-100" />

      <section aria-label={dict.easy.debtsTitle} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Link
          href={`/${locale}/debts?direction=receivable`}
          className="flex min-h-24 items-center gap-3 rounded-2xl border-2 border-line bg-panel px-4 py-3 transition hover:border-accent-line"
        >
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
            <HandCoins className="h-6 w-6" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold text-heading">{dict.easy.owedToMe}</span>
            <span className="kpi-value mt-0.5 block text-base font-black text-heading">{receivables}</span>
          </span>
          <ChevronRight className="h-5 w-5 text-muted" aria-hidden />
        </Link>
        <Link
          href={`/${locale}/debts?direction=payable`}
          className="flex min-h-24 items-center gap-3 rounded-2xl border-2 border-line bg-panel px-4 py-3 transition hover:border-warn/40"
        >
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-warn-soft text-warn">
            <HandCoins className="h-6 w-6" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold text-heading">{dict.easy.iOwe}</span>
            <span className="kpi-value mt-0.5 block text-base font-black text-heading">{payables}</span>
          </span>
          <ChevronRight className="h-5 w-5 text-muted" aria-hidden />
        </Link>
      </section>

      {summary && summary.recentTransactions.length > 0 ? (
        <section aria-labelledby="easy-recent-title" className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h2 id="easy-recent-title" className="text-lg font-black text-heading">{dict.easy.recent}</h2>
            <Link href={`/${locale}/transactions`} className="text-sm font-bold text-accent hover:underline">
              {dict.common.viewAll}
            </Link>
          </div>
          <div className="overflow-hidden rounded-2xl border-2 border-line bg-panel">
            {summary.recentTransactions.slice(0, 4).map((transaction) => {
              const incoming = transaction.kind === "income";
              return (
                <div
                  key={transaction.id}
                  className="flex items-center gap-3 border-b border-line px-4 py-3 last:border-b-0"
                >
                  <span
                    className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${
                      incoming ? "bg-accent-soft text-accent" : "bg-danger-soft text-danger"
                    }`}
                  >
                    {incoming ? <ArrowDownLeft className="h-5 w-5" aria-hidden /> : <ArrowUpRight className="h-5 w-5" aria-hidden />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-heading">
                      {transaction.category_name ?? transaction.description}
                    </span>
                    <span className="block text-xs text-muted">
                      {formatDate(transaction.occurred_on, intlLocale(locale), workspace.timezone)}
                    </span>
                  </span>
                  <span className={`shrink-0 text-sm font-black ${incoming ? "text-accent" : "text-danger"}`}>
                    {incoming ? "+" : "−"}
                    {money(transaction.amount_minor)}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      ) : (
        <Card className="p-6 text-center">
          <p className="text-lg font-black text-heading">{dict.easy.noEntries}</p>
          <p className="mt-1 text-sm text-muted">{dict.easy.noEntriesHint}</p>
        </Card>
      )}

      <section className="rounded-2xl border-2 border-dashed border-line bg-panel/60 p-4 text-center">
        <p className="text-sm font-semibold text-muted">{dict.easy.helpHint}</p>
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          <Link href={`/${locale}/dashboard`} className="text-sm font-bold text-accent hover:underline">
            {dict.easy.backToFull}
          </Link>
          <span className="text-muted" aria-hidden>·</span>
          <span className="text-sm font-semibold text-muted">{getCurrency(workspace.currency).symbol}</span>
        </div>
      </section>
    </div>
  );
}
