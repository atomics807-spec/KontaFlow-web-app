import Link from "next/link";
import type { Metadata } from "next";
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  Banknote,
  HandCoins,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { CashflowChart } from "@/components/charts/cashflow-chart";
import { KpiCard, deltaTenths } from "@/components/dashboard/kpi-card";
import { TransactionListCard } from "@/components/dashboard/transaction-list";
import { GettingStarted } from "@/components/dashboard/getting-started";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getDashboardSummary } from "@/services/dashboard";
import { requireWorkspaceContext } from "@/lib/supabase/auth";
import { resolveLocale, intlLocale, pickTranslation } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/server";
import { interpolate } from "@/lib/i18n/interpolate";
import { formatMoney, moneyLocale, toMinorUnits } from "@/lib/money";
import { getCurrency } from "@/lib/currency";
import { formatDate, monthBounds, todayInZone } from "@/lib/dates";
import type { DashboardSummary } from "@/types/database";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const dict = await getDictionary(resolveLocale((await params).locale));
  return { title: dict.nav.overview, robots: { index: false, follow: false } };
}

export default async function DashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ welcome?: string; period?: string; from?: string; to?: string }>;
}) {
  const locale = resolveLocale((await params).locale);
  const query = await searchParams;
  const { welcome } = query;
  const dict = await getDictionary(locale);
  const context = await requireWorkspaceContext(locale);
  const { workspace, profile } = context;

  const period = resolvePeriod(query.period, query.from, query.to, workspace.timezone);

  let summary: DashboardSummary | null = null;
  let failed = false;
  try {
    summary = await getDashboardSummary(workspace.id, period.from, period.to);
  } catch {
    failed = true;
  }

  const currency = workspace.currency;
  const moneyFormat = (value: bigint) => formatMoney(value, currency, moneyLocale(locale, currency));
  const firstName = (profile.full_name || "").split(" ")[0];

  const header = (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-heading sm:text-[1.7rem]">
          {dict.dashboard.greeting}
          {firstName ? `, ${firstName}` : ""}
        </h1>
        <p className="mt-1 text-sm text-muted">
          {interpolate(dict.dashboard.subtitle, { business: workspace.name }, { locale: intlLocale(locale) })}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="forest">
          {formatDate(period.from, intlLocale(locale), workspace.timezone)} —{" "}
          {formatDate(period.to, intlLocale(locale), workspace.timezone)}
        </Badge>
        <Badge tone="outline">{getCurrency(currency).symbol}</Badge>
      </div>
    </header>
  );

  if (failed || !summary) {
    return (
      <div className="space-y-6">
        {header}
        <Card className="p-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 text-danger" aria-hidden />
            <div>
              <p className="font-bold text-heading">{dict.errors.generic}</p>
              <p className="mt-1 text-sm text-muted">{dict.errors.network}</p>
              <Link href={`/${locale}/dashboard`} className={buttonVariants({ variant: "secondary", size: "sm", className: "mt-4" })}>
                {dict.common.retry}
              </Link>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  const income = toMinorUnits(summary.totalIncomeMinor);
  const expense = toMinorUnits(summary.totalExpenseMinor);
  const net = toMinorUnits(summary.netProfitMinor);
  const cash = toMinorUnits(summary.cashBalanceMinor);
  const prevIncome = toMinorUnits(summary.previousIncomeMinor);
  const prevExpense = toMinorUnits(summary.previousExpenseMinor);
  const series = summary.monthlySeries.map((point) => ({
    month: point.month.slice(5),
    income: Number(BigInt(point.income)),
    expense: Number(BigInt(point.expense)),
  }));

  const hasActivity = income > 0n || expense > 0n || cash !== 0n;
  const topCategory = summary.topExpenseCategories[0];
  const share = income > 0n ? Number((expense * 100n) / income) : null;
  const margin = income > 0n ? Number((net * 100n) / income) : null;
  const runwayTenths = expense > 0n ? Number((cash * 10n) / expense) : null;

  const insights: string[] = [];
  if (topCategory) {
    insights.push(
      interpolate(dict.insights.topCategory, {
        name: pickTranslation(topCategory.translations, locale) ?? topCategory.name,
        amount: moneyFormat(toMinorUnits(topCategory.total)),
      }),
    );
  }
  if (share !== null) insights.push(interpolate(dict.insights.expenseShare, { share }));
  if (margin !== null && net > 0n) insights.push(interpolate(dict.insights.margin, { margin }));
  if (runwayTenths !== null) insights.push(interpolate(dict.insights.runway, { months: (runwayTenths / 10).toFixed(1) }, { locale: intlLocale(locale) }));

  return (
    <div className="space-y-6">
      {header}

      <Card className="p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <nav aria-label={dict.dashboard.period} className="flex flex-wrap gap-2">
            {PERIOD_PRESETS.map((option) => (
              <Link
                key={option.value}
                href={`/${locale}/dashboard${option.value === "month" ? "" : `?period=${option.value}`}`}
                aria-current={period.preset === option.value ? "page" : undefined}
                className={
                  period.preset === option.value
                    ? "rounded-full bg-forest px-3.5 py-1.5 text-xs font-bold text-white"
                    : "rounded-full border border-line bg-panel px-3.5 py-1.5 text-xs font-semibold text-muted hover:border-accent-line hover:text-heading"
                }
              >
                {dict.dashboard[option.labelKey]}
              </Link>
            ))}
          </nav>
          <form method="get" className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="period" value="custom" />
            <div>
              <label htmlFor="dash-from" className="mb-1 block text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-muted">
                {dict.dashboard.from}
              </label>
              <input
                id="dash-from"
                name="from"
                type="date"
                defaultValue={period.from}
                max={period.to}
                className="h-9 rounded-xl border border-line bg-panel px-2.5 text-xs text-ink focus:border-accent-strong focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="dash-to" className="mb-1 block text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-muted">
                {dict.dashboard.to}
              </label>
              <input
                id="dash-to"
                name="to"
                type="date"
                defaultValue={period.to}
                className="h-9 rounded-xl border border-line bg-panel px-2.5 text-xs text-ink focus:border-accent-strong focus:outline-none"
              />
            </div>
            <Button type="submit" variant="dark" size="sm">
              {dict.dashboard.apply}
            </Button>
          </form>
        </div>
        <p className="mt-2 text-xs text-muted">
          {formatDate(period.from, intlLocale(locale), workspace.timezone)} —{" "}
          {formatDate(period.to, intlLocale(locale), workspace.timezone)}
        </p>
      </Card>

      {welcome === "1" ? <GettingStarted locale={locale} dict={dict} /> : null}

      <section aria-label={dict.dashboard.quickActions} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard
          label={dict.dashboard.income}
          value={moneyFormat(income)}
          deltaTenths={deltaTenths(income, prevIncome)}
          deltaLabel={dict.dashboard.vsPrevious}
          icon={TrendingUp}
          tone="jade"
        />
        <KpiCard
          label={dict.dashboard.expenses}
          value={moneyFormat(expense)}
          deltaTenths={deltaTenths(expense, prevExpense)}
          deltaLabel={dict.dashboard.vsPrevious}
          inverse
          icon={TrendingDown}
          tone="mango"
        />
        <KpiCard
          label={dict.dashboard.profit}
          value={moneyFormat(net)}
          hint={dict.dashboard.thisMonthLabel}
          icon={Wallet}
        />
        <KpiCard
          label={dict.dashboard.cashBalance}
          value={moneyFormat(cash)}
          hint={getCurrency(currency).name}
          icon={Banknote}
        />
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <Link
          href={`/${locale}/debts?direction=receivable`}
          className="surface group flex items-center gap-3 p-4 transition hover:border-accent-line"
        >
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
            <HandCoins className="h-4 w-4" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.1em] text-muted">{dict.dashboard.receivables}</p>
            <p className="kpi-value mt-0.5 text-lg font-semibold text-heading">{moneyFormat(toMinorUnits(summary.outstandingReceivablesMinor))}</p>
            <p className="mt-0.5 text-xs text-muted">
              {dict.dashboard.overdue}: {moneyFormat(toMinorUnits(summary.overdueReceivablesMinor))}
            </p>
          </div>
          <ArrowRight className="h-4 w-4 shrink-0 text-muted transition group-hover:text-accent" aria-hidden />
        </Link>
        <Link
          href={`/${locale}/debts?direction=payable`}
          className="surface group flex items-center gap-3 p-4 transition hover:border-accent-line"
        >
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-warn-soft text-warn">
            <HandCoins className="h-4 w-4" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.1em] text-muted">{dict.dashboard.payables}</p>
            <p className="kpi-value mt-0.5 text-lg font-semibold text-heading">{moneyFormat(toMinorUnits(summary.outstandingPayablesMinor))}</p>
            <p className="mt-0.5 text-xs text-muted">
              {dict.dashboard.overdue}: {moneyFormat(toMinorUnits(summary.overduePayablesMinor))}
            </p>
          </div>
          <ArrowRight className="h-4 w-4 shrink-0 text-muted transition group-hover:text-accent" aria-hidden />
        </Link>
      </section>

      {!hasActivity ? (
        <Card className="overflow-hidden">
          <div className="relative px-6 py-10 text-center">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(22,169,126,0.14),transparent_60%)]"
            />
            <p className="relative text-lg font-extrabold text-heading">{dict.dashboard.noTransactions}</p>
            <p className="relative mx-auto mt-2 max-w-md text-sm text-muted">{dict.dashboard.noTransactionsHint}</p>
            <div className="relative mt-6 flex flex-col justify-center gap-2 sm:flex-row">
              <Link href={`/${locale}/transactions/new?kind=income`} className={buttonVariants({ size: "md" })}>
                <ArrowDownLeft className="h-4 w-4" aria-hidden />
                {dict.dashboard.recordIncome}
              </Link>
              <Link
                href={`/${locale}/transactions/new?kind=expense`}
                className={buttonVariants({ variant: "secondary", size: "md" })}
              >
                <ArrowUpRight className="h-4 w-4" aria-hidden />
                {dict.dashboard.recordExpense}
              </Link>
            </div>
          </div>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1.55fr_1fr]">
        <section className="surface p-5 sm:p-6" aria-labelledby="cashflow-title">
          <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 id="cashflow-title" className="text-base font-bold text-heading">
                {dict.dashboard.cashflow}
              </h2>
              <p className="mt-0.5 text-sm text-muted">{dict.dashboard.cashflowSubtitle}</p>
            </div>
            <Badge tone="jade">{dict.dashboard.thisMonthLabel}</Badge>
          </div>
          <CashflowChart
            data={series}
            currency={currency}
            locale={locale}
            incomeLabel={dict.dashboard.income}
            expenseLabel={dict.dashboard.expenses}
            emptyLabel={dict.dashboard.noTransactionsHint}
            monthLabel={dict.common.month}
          />
        </section>

        <section
          aria-labelledby="insight-title"
          className="relative overflow-hidden rounded-2xl bg-forest p-5 text-white sm:p-6"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_85%_-10%,rgba(242,182,75,0.22),transparent_45%),radial-gradient(circle_at_0%_100%,rgba(22,169,126,0.35),transparent_55%)]"
          />
          <div className="relative flex h-full flex-col">
            <div className="flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-xl bg-white/10">
                <Sparkles className="h-4 w-4 text-mango-400" aria-hidden />
              </span>
              <div>
                <h2 id="insight-title" className="text-sm font-bold">
                  {dict.insights.title}
                </h2>
                <p className="text-[0.7rem] text-jade-200/70">{dict.insights.subtitle}</p>
              </div>
            </div>

            {insights.length > 0 ? (
              <ul className="mt-5 space-y-3">
                {insights.map((insight) => (
                  <li key={insight} className="flex gap-2.5 text-sm leading-relaxed text-jade-50/90">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-mango-400" aria-hidden />
                    {insight}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-5 text-sm leading-relaxed text-jade-50/85">{dict.insights.empty}</p>
            )}

            <div className="mt-auto pt-5">
              <Link
                href={`/${locale}/assistant`}
                className={buttonVariants({
                  variant: "mango",
                  size: "sm",
                  className: "w-full justify-center",
                })}
              >
                <Sparkles className="h-3.5 w-3.5" aria-hidden />
                {dict.dashboard.askAi}
              </Link>
            </div>
          </div>
        </section>
      </div>

      <section className="surface p-5 sm:p-6" aria-labelledby="budget-progress-title">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-accent-soft text-accent">
              <Target className="h-4 w-4" aria-hidden />
            </span>
            <div>
              <h2 id="budget-progress-title" className="text-base font-bold text-heading">
                {dict.dashboard.budgetProgress}
              </h2>
              <p className="text-[0.7rem] text-muted">{dict.finance.budgets.subtitle}</p>
            </div>
          </div>
          <Link href={`/${locale}/budgets`} className="text-xs font-semibold text-accent hover:underline">
            {dict.common.viewAll}
          </Link>
        </div>

        {summary.budgetProgress.length === 0 ? (
          <p className="mt-4 text-sm text-muted">{dict.dashboard.noBudgets}</p>
        ) : (
          <ul className="mt-4 grid gap-4 sm:grid-cols-2">
            {summary.budgetProgress.slice(0, 4).map((budget) => {
              const budgetAmount = toMinorUnits(budget.amount_minor);
              const spent = toMinorUnits(budget.spent_minor);
              const percent = budgetAmount > 0n ? Math.min(100, Number((spent * 100n) / budgetAmount)) : 0;
              const over = spent > budgetAmount;
              return (
                <li key={budget.id}>
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="truncate text-sm font-semibold text-heading">{budget.name}</p>
                    <p className="kpi-value shrink-0 text-xs text-muted">
                      {interpolate(dict.dashboard.budgetSpent, { spent: moneyFormat(spent), budget: moneyFormat(budgetAmount) })}
                    </p>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-page-soft">
                    <div
                      className={over ? "h-full rounded-full bg-danger" : "h-full rounded-full bg-accent"}
                      style={{ width: `${Math.max(percent, 2)}%` }}
                    />
                  </div>
                  <p className={over ? "mt-1 text-[0.7rem] font-semibold text-danger" : "mt-1 text-[0.7rem] text-muted"}>
                    {percent}%{over ? ` · ${dict.finance.budgets.remainingNegative}` : ""}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.55fr]">
        <section className="surface p-5 sm:p-6" aria-labelledby="categories-title">
          <div className="flex items-center justify-between">
            <h2 id="categories-title" className="text-base font-bold text-heading">
              {dict.dashboard.topCategories}
            </h2>
            <Badge tone="outline">{dict.dashboard.thisMonthLabel}</Badge>
          </div>

          {summary.topExpenseCategories.length === 0 ? (
            <p className="mt-6 text-sm text-muted">{dict.dashboard.insightEmpty}</p>
          ) : (
            <ul className="mt-5 space-y-4">
              {summary.topExpenseCategories.slice(0, 5).map((category) => {
                const total = toMinorUnits(category.total);
                const percent = expense > 0n ? Number((total * 100n) / expense) : 0;
                return (
                  <li key={category.name}>
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="truncate text-sm font-semibold text-heading">
                        {pickTranslation(category.translations, locale) ?? category.name}
                      </p>
                      <p className="kpi-value shrink-0 text-sm text-heading">{moneyFormat(total)}</p>
                    </div>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-page-soft">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${Math.max(percent, 2)}%`, backgroundColor: category.color || "#0B7A5A" }}
                      />
                    </div>
                    <p className="mt-1 text-[0.7rem] text-muted">{percent}%</p>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <TransactionListCard
          title={dict.dashboard.recentTransactions}
          viewAllHref={`/${locale}/transactions`}
          items={summary.recentTransactions.map((row) => ({
            id: row.id,
            kind: row.kind,
            status: row.status,
            amountMinor: row.amount_minor,
            currency: row.currency,
            occurredOn: row.occurred_on,
            description: row.description,
            categoryName: pickTranslation(row.category_translations, locale) ?? row.category_name,
            contactName: row.contact_name,
            channel: row.channel,
            accountName: row.account_name,
          }))}
          emptyAction={
            context.can("transactions:create") ? (
              <Link href={`/${locale}/transactions/new`} className={buttonVariants({ size: "sm" })}>
                {dict.transactions.new}
              </Link>
            ) : undefined
          }
        />
      </div>

      <section aria-label={dict.dashboard.quickActions} className="grid gap-3 sm:grid-cols-3">
        {[
          { href: `/${locale}/transactions/new?kind=income`, label: dict.dashboard.recordIncome, icon: ArrowDownLeft },
          { href: `/${locale}/transactions/new?kind=expense`, label: dict.dashboard.recordExpense, icon: ArrowUpRight },
          { href: `/${locale}/reports`, label: dict.dashboard.viewReports, icon: TrendingUp },
        ].map((action) => (
          <Link
            key={action.label}
            href={action.href}
            className="group flex items-center gap-3 rounded-2xl border border-line bg-panel px-4 py-3.5 text-sm font-semibold text-heading transition hover:border-accent-line hover:bg-accent-soft"
          >
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-page-soft text-accent transition group-hover:bg-panel">
              <action.icon className="h-4 w-4" aria-hidden />
            </span>
            {action.label}
          </Link>
        ))}
      </section>
    </div>
  );
}


type PeriodPreset = "month" | "last-month" | "quarter" | "year" | "custom";

const PERIOD_PRESETS: { value: Exclude<PeriodPreset, "custom">; labelKey: "thisMonthLabel" | "lastMonth" | "quarter" | "year" }[] = [
  { value: "month", labelKey: "thisMonthLabel" },
  { value: "last-month", labelKey: "lastMonth" },
  { value: "quarter", labelKey: "quarter" },
  { value: "year", labelKey: "year" },
];

function resolvePeriod(
  requested: string | undefined,
  fromParam: string | undefined,
  toParam: string | undefined,
  timezone: string,
): { preset: PeriodPreset; from: string; to: string } {
  const today = todayInZone(timezone);
  const [year, month] = today.split("-").map(Number);
  const preset: PeriodPreset =
    requested === "last-month" || requested === "quarter" || requested === "year" || requested === "custom"
      ? requested
      : "month";


  if (preset === "custom") {
    const validFrom = /^\d{4}-\d{2}-\d{2}$/.test(fromParam ?? "");
    const validTo = /^\d{4}-\d{2}-\d{2}$/.test(toParam ?? "");
    if (validFrom && validTo && fromParam! <= toParam!) {
      const days = Math.round((Date.parse(`${toParam}T00:00:00Z`) - Date.parse(`${fromParam}T00:00:00Z`)) / 86400000) + 1;
      if (days <= 731) {
        return { preset: "custom", from: fromParam!, to: toParam! };
      }
    }
  }

  if (preset === "last-month") {
    const start = new Date(Date.UTC(year, month - 2, 1));
    const bounds = monthBounds(start, timezone);
    return { preset: "last-month", from: bounds.start, to: bounds.end };
  }
  if (preset === "quarter") {
    const quarterStartMonth = Math.floor((month - 1) / 3) * 3 + 1;
    const start = `${year}-${String(quarterStartMonth).padStart(2, "0")}-01`;
    const end = new Date(Date.UTC(year, quarterStartMonth + 2, 0)).toISOString().slice(0, 10);
    return { preset: "quarter", from: start, to: end };
  }
  if (preset === "year") {
    return { preset: "year", from: `${year}-01-01`, to: `${year}-12-31` };
  }

  const bounds = monthBounds(new Date(), timezone);
  return { preset: "month", from: bounds.start, to: bounds.end };
}
