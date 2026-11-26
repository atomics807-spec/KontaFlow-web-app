import Link from "next/link";
import type { Metadata } from "next";
import { AlertTriangle, ArrowDownLeft, ArrowUpRight, Banknote, Sparkles, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { CashflowChart } from "@/components/charts/cashflow-chart";
import { KpiCard, deltaTenths } from "@/components/dashboard/kpi-card";
import { TransactionListCard } from "@/components/dashboard/transaction-list";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getDashboardForMonth } from "@/services/dashboard";
import { requireWorkspaceContext } from "@/lib/supabase/auth";
import { resolveLocale, intlLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/server";
import { interpolate } from "@/lib/i18n/interpolate";
import { formatMoney, moneyLocale, toMinorUnits } from "@/lib/money";
import { getCurrency } from "@/lib/currency";
import { formatDate } from "@/lib/dates";
import type { DashboardSummary } from "@/types/database";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const dict = await getDictionary(resolveLocale((await params).locale));
  return { title: dict.nav.overview, robots: { index: false, follow: false } };
}

export default async function DashboardPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = resolveLocale((await params).locale);
  const dict = await getDictionary(locale);
  const context = await requireWorkspaceContext(locale);
  const { workspace, profile } = context;

  let summary: DashboardSummary | null = null;
  let failed = false;
  try {
    summary = await getDashboardForMonth(workspace.id, workspace.timezone);
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
          {interpolate(dict.dashboard.subtitle, { business: workspace.name })}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Badge tone="forest">
          {dict.dashboard.thisMonthLabel} · {formatDate(new Date(), intlLocale(locale), workspace.timezone, { month: "long", year: "numeric", day: undefined })}
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
  const decimals = getCurrency(currency).decimals;
  const factor = 10 ** decimals;

  const series = summary.monthlySeries.map((point) => ({
    month: point.month.slice(5),
    income: Number(BigInt(point.income)) / factor,
    expense: Number(BigInt(point.expense)) / factor,
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
        name: topCategory.translations?.[locale] ?? topCategory.name,
        amount: moneyFormat(toMinorUnits(topCategory.total)),
      }),
    );
  }
  if (share !== null) insights.push(interpolate(dict.insights.expenseShare, { share }));
  if (margin !== null && net > 0n) insights.push(interpolate(dict.insights.margin, { margin }));
  if (runwayTenths !== null) insights.push(interpolate(dict.insights.runway, { months: (runwayTenths / 10).toFixed(1) }));

  return (
    <div className="space-y-6">
      {header}

      <section aria-label={dict.dashboard.quickActions} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard
          label={dict.dashboard.income}
          value={moneyFormat(income)}
          deltaTenths={deltaTenths(income, prevIncome)}
          deltaLabel={dict.dashboard.vsLastMonth}
          icon={TrendingUp}
          tone="jade"
        />
        <KpiCard
          label={dict.dashboard.expenses}
          value={moneyFormat(expense)}
          deltaTenths={deltaTenths(expense, prevExpense)}
          deltaLabel={dict.dashboard.vsLastMonth}
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
                        {category.translations?.[locale] ?? category.name}
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
            categoryName: row.category_translations?.[locale] ?? row.category_name,
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
