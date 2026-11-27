import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BadgeCheck,
  BrainCircuit,
  CheckCircle2,
  CircleDollarSign,
  Gauge,
  Lightbulb,
  Sparkles,
  Target,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PlanGate } from "@/components/ui/plan-gate";
import { buttonVariants } from "@/components/ui/button";
import { CashflowChart } from "@/components/charts/cashflow-chart";
import { DailyChart } from "@/components/charts/daily-chart";
import { buildAdvisorBrief } from "@/lib/ai/advisor";
import { analysisBounds, getBusinessIntelligence } from "@/services/business-intelligence";
import { getAiPreferences } from "@/services/ai-preferences";
import { requireWorkspaceContext } from "@/lib/supabase/auth";
import { getWorkspaceEntitlements } from "@/lib/entitlements/service";
import { intlLocale, pickTranslation, resolveLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/server";
import { interpolate } from "@/lib/i18n/interpolate";
import { formatMoney, moneyLocale, toMinorUnits } from "@/lib/money";
import { formatDate, todayInZone } from "@/lib/dates";
import type { AdvisorEvidence, AdvisorInsight, BusinessIntelligence } from "@/types/ai-advisor";

const WINDOWS = [30, 90, 180, 365, 730] as const;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const dict = await getDictionary(resolveLocale((await params).locale));
  return { title: dict.advisor.title, robots: { index: false, follow: false } };
}

export default async function InsightsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ window?: string }>;
}) {
  const locale = resolveLocale((await params).locale);
  const dict = await getDictionary(locale);
  const context = await requireWorkspaceContext(locale);
  const entitlements = await getWorkspaceEntitlements(context.workspace.id, context.user.id);
  if (!entitlements.features.advanced_analytics.included) {
    return (
      <div className="space-y-5">
        <header>
          <h1 className="text-2xl font-extrabold tracking-tight text-heading">{dict.advisor.title}</h1>
          <p className="mt-1 text-sm text-muted">{dict.advisor.subtitle}</p>
        </header>
        <PlanGate
          title={dict.plans.lockedTitle}
          body={interpolate(dict.plans.lockedBody, {
            plan: entitlements.features.advanced_analytics.requiredPlan ?? dict.plans.growth,
          })}
          cta={dict.plans.upgrade}
          href={`/${locale}/billing`}
        />
      </div>
    );
  }
  const { workspace } = context;
  const query = await searchParams;
  const preferences = await getAiPreferences(workspace.id);
  const isOwner = context.role === "owner";
  const requestedWindow = Number(query.window);
  const windowDays = (WINDOWS as readonly number[]).includes(requestedWindow)
    ? requestedWindow
    : preferences.analysisWindowDays;

  if (!preferences.insightsEnabled) {
    return (
      <div className="space-y-5">
        <Header locale={locale} dict={dict} />
        <Card className="p-6 sm:p-8">
          <div className="mx-auto max-w-lg text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-soft text-accent-strong">
              <BrainCircuit className="h-6 w-6" aria-hidden />
            </div>
            <h2 className="mt-4 text-lg font-bold text-heading">{dict.advisor.disabledTitle}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">{dict.advisor.disabledBody}</p>
            {isOwner ? (
              <Link
                href={`/${locale}/settings#ai-advisor`}
                className={buttonVariants({ variant: "secondary", size: "sm", className: "mt-5" })}
              >
                {dict.advisor.manageSettings}
              </Link>
            ) : null}
          </div>
        </Card>
      </div>
    );
  }

  const { from, to } = analysisBounds(todayInZone(workspace.timezone), windowDays);
  let intelligence: BusinessIntelligence | null = null;
  try {
    intelligence = await getBusinessIntelligence(workspace.id, from, to);
  } catch {
    intelligence = null;
  }

  if (!intelligence) {
    return (
      <div className="space-y-5">
        <Header locale={locale} dict={dict} />
        <Card className="p-6 text-sm text-muted">{dict.advisor.emptyBody}</Card>
      </div>
    );
  }

  const currency = workspace.currency;
  const intlNumber = new Intl.NumberFormat(intlLocale(locale), { maximumFractionDigits: 2 });
  const money = (value: string | bigint) =>
    formatMoney(toMinorUnits(value), currency, moneyLocale(locale, currency));
  const toChartNumber = (value: string) => Number(BigInt(value || "0"));
  const dateLabel = (value: string) => formatDate(value, intlLocale(locale), workspace.timezone);
  const brief = buildAdvisorBrief(intelligence, preferences.advisorFocus);

  const categoryNames = new Map<string, string>();
  for (const row of [
    ...intelligence.expenseCategories,
    ...intelligence.incomeCategories,
    ...intelligence.categoryWeekComparisons,
  ]) {
    categoryNames.set(row.name, pickTranslation(row.translations, locale) ?? row.name);
  }

  const insightText = (item: AdvisorInsight) => {
    const params: Record<string, string | number> = { ...item.params };
    if (typeof params.category === "string") {
      params.category = categoryNames.get(params.category) ?? params.category;
    }
    for (const [key, value] of Object.entries(params)) {
      if (typeof value === "number") params[key] = intlNumber.format(value);
    }
    return interpolate(dict.advisor.insights[item.code], params, { locale: intlLocale(locale) });
  };

  const evidenceText = (item: AdvisorEvidence) =>
    `${dict.advisor.evidence[item.key]}: ${money(item.amountMinor)}${item.date ? ` · ${dateLabel(item.date)}` : ""}`;

  const monthly = intelligence.monthlySeries.map((point) => ({
    month: point.month,
    income: toChartNumber(point.income),
    expense: toChartNumber(point.expense),
  }));
  const weekly = intelligence.weeklySeries.slice(-12).map((point) => ({
    date: point.week_start,
    income: toChartNumber(point.income),
    expense: toChartNumber(point.expense),
  }));

  const net = toMinorUnits(intelligence.totals.netResultMinor);
  const agingLabel: Record<string, string> = {
    not_due: dict.advisor.bucketNotDue,
    days_1_30: dict.advisor.bucket1to30,
    days_31_60: dict.advisor.bucket31to60,
    days_61_plus: dict.advisor.bucket61plus,
  };

  return (
    <div className="space-y-5">
      <Header locale={locale} dict={dict} />

      <Card className="p-4 sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            <span className="font-semibold text-heading">{dict.advisor.period}:</span>
            <span className="text-muted">
              {dateLabel(intelligence.period.from)} – {dateLabel(intelligence.period.to)}
            </span>
            <span className="hidden text-line-strong sm:inline" aria-hidden>
              |
            </span>
            <span className="text-muted">
              {dict.advisor.previousPeriod}: {dateLabel(intelligence.previousPeriod.from)} –{" "}
              {dateLabel(intelligence.previousPeriod.to)}
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label={dict.advisor.windowLabel}>
            {WINDOWS.map((value) => (
              <Link
                key={value}
                href={`/${locale}/insights?window=${value}`}
                aria-current={windowDays === value ? "true" : undefined}
                className={
                  windowDays === value
                    ? "rounded-full bg-forest px-3 py-1.5 text-xs font-semibold text-white"
                    : "rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-muted transition hover:border-accent-line hover:text-heading"
                }
              >
                {dict.advisor.days.replace("{count}", String(value))}
              </Link>
            ))}
          </div>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-muted">{dict.advisor.disclaimer}</p>
      </Card>

      {intelligence.coverage.transactionCount === 0 ? (
        <Card className="p-6">
          <div className="mx-auto max-w-lg text-center">
            <Gauge className="mx-auto h-8 w-8 text-muted" aria-hidden />
            <h2 className="mt-3 text-base font-bold text-heading">{dict.advisor.emptyTitle}</h2>
            <p className="mt-2 text-sm text-muted">{dict.advisor.emptyBody}</p>
          </div>
        </Card>
      ) : (
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label={dict.advisor.coverageLabel}>
            <Kpi
              label={dict.advisor.kpiIncome}
              value={money(intelligence.totals.incomeMinor)}
              icon={ArrowUpRight}
              tone="positive"
            />
            <Kpi
              label={dict.advisor.kpiExpenses}
              value={money(intelligence.totals.expenseMinor)}
              icon={ArrowDownRight}
              tone="warning"
            />
            <Kpi
              label={dict.advisor.kpiNet}
              value={money(intelligence.totals.netResultMinor)}
              icon={CircleDollarSign}
              tone={net < 0n ? "danger" : "neutral"}
              hint={dict.advisor.netNote}
            />
            <Kpi
              label={dict.advisor.kpiCash}
              value={money(intelligence.cashFlow.cashBalanceMinor)}
              icon={Wallet}
              tone={toMinorUnits(intelligence.cashFlow.cashBalanceMinor) < 0n ? "danger" : "neutral"}
            />
          </section>

          <section className="grid gap-3 sm:grid-cols-2">
            <MiniStat label={dict.advisor.kpiAvgDaily} value={money(intelligence.totals.averageDailyExpenseMinor)} />
            <MiniStat label={dict.advisor.kpiAvgWeekly} value={money(intelligence.totals.averageWeeklyExpenseMinor)} />
          </section>

          <section className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
            <Card className="p-4 sm:p-5">
              <SectionHead title={dict.advisor.factsTitle} subtitle={dict.advisor.factsSubtitle} icon={CheckCircle2} />
              {brief.facts.length === 0 ? (
                <p className="mt-4 rounded-xl border border-dashed border-line-strong bg-page/40 p-4 text-sm text-muted">
                  {dict.advisor.noFacts}
                </p>
              ) : (
                <ul className="mt-4 space-y-2.5">
                  {brief.facts.map((item) => (
                    <InsightRow
                      key={item.id}
                      text={insightText(item)}
                      evidence={item.evidence.map(evidenceText)}
                      severity={item.severity}
                      period={
                        item.period
                          ? `${dateLabel(item.period.from)} – ${dateLabel(item.period.to)}`
                          : undefined
                      }
                    />
                  ))}
                </ul>
              )}
            </Card>

            <Card className="p-4 sm:p-5">
              <SectionHead
                title={dict.advisor.suggestionsTitle}
                subtitle={dict.advisor.suggestionsSubtitle}
                icon={Lightbulb}
              />
              {brief.suggestions.length === 0 ? (
                <p className="mt-4 rounded-xl border border-dashed border-line-strong bg-page/40 p-4 text-sm text-muted">
                  {dict.advisor.noSuggestions}
                </p>
              ) : (
                <ul className="mt-4 space-y-2.5">
                  {brief.suggestions.map((item) => (
                    <InsightRow
                      key={item.id}
                      text={insightText(item)}
                      evidence={item.evidence.map(evidenceText)}
                      severity={item.severity}
                      period={
                        item.period
                          ? `${dateLabel(item.period.from)} – ${dateLabel(item.period.to)}`
                          : undefined
                      }
                      suggestion
                    />
                  ))}
                </ul>
              )}
              <Link
                href={`/${locale}/assistant`}
                className={buttonVariants({ variant: "secondary", size: "sm", className: "mt-4 w-full" })}
              >
                <Sparkles className="h-4 w-4" aria-hidden />
                {dict.advisor.askAdvisor}
              </Link>
            </Card>
          </section>

          <section className="grid gap-4 xl:grid-cols-2">
            <Card className="p-4 sm:p-5">
              <SectionHead title={dict.advisor.monthlyTitle} subtitle={dict.advisor.monthlySubtitle} icon={TrendingUp} />
              <div className="mt-3">
                <CashflowChart
                  data={monthly}
                  currency={currency}
                  locale={locale}
                  incomeLabel={dict.advisor.kpiIncome}
                  expenseLabel={dict.advisor.kpiExpenses}
                  emptyLabel={dict.advisor.emptyBody}
                  monthLabel={dict.advisor.period}
                />
              </div>
            </Card>
            <Card className="p-4 sm:p-5">
              <SectionHead title={dict.advisor.weeklyTitle} subtitle={dict.advisor.weeklySubtitle} icon={Gauge} />
              <div className="mt-3">
                <DailyChart
                  data={weekly}
                  currency={currency}
                  locale={locale}
                  label={dict.advisor.weeklyTitle}
                  monthLabel={dict.advisor.period}
                  incomeLabel={dict.advisor.kpiIncome}
                  expenseLabel={dict.advisor.kpiExpenses}
                  emptyLabel={dict.advisor.emptyBody}
                  xTick="date"
                />
              </div>
            </Card>
          </section>

          <section className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
            <Card className="p-4 sm:p-5">
              <SectionHead title={dict.advisor.categoryTitle} subtitle={dict.advisor.categorySubtitle} icon={Target} />
              {intelligence.expenseCategories.length === 0 ? (
                <p className="mt-4 text-sm text-muted">{dict.advisor.noCategories}</p>
              ) : (
                <ul className="mt-4 space-y-3">
                  {intelligence.expenseCategories.map((category) => {
                    const share = Math.round(category.share_bp / 100);
                    return (
                      <li key={category.id}>
                        <div className="flex items-baseline justify-between gap-3 text-sm">
                          <span className="truncate font-medium text-heading">
                            {pickTranslation(category.translations, locale) ?? category.name}
                          </span>
                          <span className="shrink-0 font-semibold text-heading">{money(category.total_minor)}</span>
                        </div>
                        <div className="mt-1.5 flex items-center gap-2">
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-page-soft">
                            <div
                              className="h-full rounded-full bg-accent-strong"
                              style={{ width: `${Math.min(Math.max(share, 1), 100)}%` }}
                            />
                          </div>
                          <span className="w-10 text-right text-xs text-muted">{share}%</span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>

            <Card className="p-4 sm:p-5">
              <SectionHead title={dict.advisor.profitabilityTitle} icon={BadgeCheck} />
              <div className="mt-3 space-y-3">
                <p className="rounded-xl bg-page p-3 text-sm leading-relaxed text-muted">
                  {intelligence.profitability.grossResultAvailable && intelligence.profitability.grossResultMinor
                    ? interpolate(dict.advisor.grossAvailable, {
                        amount: money(intelligence.profitability.grossResultMinor),
                      })
                    : dict.advisor.grossMissing}
                </p>
                <p className="text-xs leading-relaxed text-muted">{dict.advisor.grossNote}</p>
                <p className="text-xs leading-relaxed text-muted">{dict.advisor.netNote}</p>
              </div>
            </Card>
          </section>

          <section className="grid gap-4 xl:grid-cols-3">
            <Card className="p-4 sm:p-5">
              <SectionHead title={dict.advisor.debtsTitle} subtitle={dict.advisor.debtsSubtitle} icon={AlertTriangle} />
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <Metric label={dict.advisor.receivables} value={money(intelligence.debts.receivableMinor)} />
                <Metric label={dict.advisor.payables} value={money(intelligence.debts.payableMinor)} />
                <Metric
                  label={dict.advisor.overdueReceivables}
                  value={money(intelligence.debts.overdueReceivableMinor)}
                  danger={toMinorUnits(intelligence.debts.overdueReceivableMinor) > 0n}
                />
                <Metric
                  label={dict.advisor.overduePayables}
                  value={money(intelligence.debts.overduePayableMinor)}
                  danger={toMinorUnits(intelligence.debts.overduePayableMinor) > 0n}
                />
              </dl>
              {intelligence.debts.aging.length > 0 ? (
                <div className="mt-4 border-t border-line pt-3">
                  <p className="text-[0.7rem] font-bold uppercase tracking-[0.08em] text-muted">
                    {dict.advisor.agingTitle}
                  </p>
                  <ul className="mt-2 space-y-1.5 text-xs">
                    {intelligence.debts.aging.map((bucket) => (
                      <li
                        key={`${bucket.direction}-${bucket.bucket}`}
                        className="flex justify-between gap-2 text-muted"
                      >
                        <span>
                          {bucket.direction === "receivable" ? dict.advisor.receivables : dict.advisor.payables} ·{" "}
                          {agingLabel[bucket.bucket] ?? bucket.bucket}
                        </span>
                        <span className="font-semibold text-heading">{money(bucket.total_minor)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="mt-4 text-xs text-muted">{dict.advisor.noDebts}</p>
              )}
            </Card>

            <Card className="p-4 sm:p-5">
              <SectionHead title={dict.advisor.budgetsTitle} subtitle={dict.advisor.budgetsSubtitle} icon={Target} />
              {intelligence.budgets.length === 0 ? (
                <p className="mt-4 text-sm text-muted">{dict.advisor.noBudgets}</p>
              ) : (
                <ul className="mt-4 space-y-3">
                  {intelligence.budgets.map((budget) => {
                    const used = Math.round(budget.used_bp / 100);
                    return (
                      <li key={budget.id}>
                        <div className="flex items-baseline justify-between gap-2 text-sm">
                          <span className="truncate font-medium text-heading">{budget.name}</span>
                          <span className={used >= 100 ? "text-danger" : "text-muted"}>
                            {dict.advisor.budgetUsed.replace("{used}", String(used))}
                          </span>
                        </div>
                        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-page-soft">
                          <div
                            className={
                              used >= 100 ? "h-full rounded-full bg-danger" : "h-full rounded-full bg-accent-strong"
                            }
                            style={{ width: `${Math.min(Math.max(used, 1), 100)}%` }}
                          />
                        </div>
                        <p className="mt-1 text-xs text-muted">
                          {money(budget.spent_minor)} / {money(budget.amount_minor)}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>

            <Card className="p-4 sm:p-5">
              <SectionHead title={dict.advisor.goalsTitle} subtitle={dict.advisor.goalsSubtitle} icon={TrendingUp} />
              {intelligence.goals.length === 0 ? (
                <p className="mt-4 text-sm text-muted">{dict.advisor.noGoals}</p>
              ) : (
                <ul className="mt-4 space-y-3">
                  {intelligence.goals.map((goal) => {
                    const progress = Math.round(goal.progress_bp / 100);
                    return (
                      <li key={goal.id}>
                        <div className="flex items-baseline justify-between gap-2 text-sm">
                          <span className="truncate font-medium text-heading">{goal.name}</span>
                          <span className="text-muted">{interpolate(dict.advisor.goalProgress, { progress })}</span>
                        </div>
                        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-page-soft">
                          <div
                            className="h-full rounded-full bg-mango-500"
                            style={{ width: `${Math.min(Math.max(progress, 1), 100)}%` }}
                          />
                        </div>
                        <p className="mt-1 text-xs text-muted">
                          {money(goal.saved_minor)} / {money(goal.target_minor)}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          </section>

          <Card className="p-4 sm:p-5">
            <SectionHead title={dict.advisor.cashTitle} subtitle={dict.advisor.cashSubtitle} icon={Wallet} />
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <Metric label={dict.advisor.openingBalance} value={money(intelligence.cashFlow.openingBalanceMinor)} />
              <Metric label={dict.advisor.netMovement} value={money(intelligence.cashFlow.netMovementMinor)} />
              <Metric label={dict.advisor.kpiCash} value={money(intelligence.cashFlow.cashBalanceMinor)} />
            </div>
          </Card>

          <p className="rounded-xl border border-line bg-page/60 p-3 text-xs leading-relaxed text-muted">
            {interpolate(dict.advisor.dataNote, {
              transactions: intelligence.coverage.transactionCount,
              days: intelligence.coverage.activeDays,
              date: intelligence.coverage.lastRecordedOn
                ? dateLabel(intelligence.coverage.lastRecordedOn)
                : dateLabel(intelligence.period.to),
            })}
          </p>
        </>
      )}
    </div>
  );
}

function Header({ locale, dict }: { locale: string; dict: Awaited<ReturnType<typeof getDictionary>> }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight text-heading">
          <BrainCircuit className="h-6 w-6 text-accent-strong" aria-hidden />
          {dict.advisor.title}
        </h1>
        <p className="mt-1 text-sm text-muted">{dict.advisor.subtitle}</p>
      </div>
      <div className="flex gap-2">
        <Badge tone="jade">{dict.nav.insights}</Badge>
        <Link href={`/${locale}/settings#ai-advisor`} className={buttonVariants({ variant: "ghost", size: "sm" })}>
          {dict.advisor.manageSettings}
        </Link>
      </div>
    </header>
  );
}

function SectionHead({
  title,
  subtitle,
  icon: Icon,
}: {
  title: string;
  subtitle?: string;
  icon: typeof CheckCircle2;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-strong">
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      <div>
        <h2 className="text-sm font-bold text-heading">{title}</h2>
        {subtitle ? <p className="mt-0.5 text-xs text-muted">{subtitle}</p> : null}
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  icon: Icon,
  tone,
  hint,
}: {
  label: string;
  value: string;
  icon: typeof CheckCircle2;
  tone: "positive" | "warning" | "danger" | "neutral";
  hint?: string;
}) {
  const toneClass =
    tone === "positive"
      ? "bg-accent-soft text-accent-strong"
      : tone === "warning"
        ? "bg-mango-100 text-mango-600"
        : tone === "danger"
          ? "bg-danger-soft text-danger"
          : "bg-page-soft text-muted";
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[0.7rem] font-bold uppercase tracking-[0.08em] text-muted">{label}</p>
          <p className="mt-1.5 truncate text-xl font-extrabold tracking-tight text-heading">{value}</p>
        </div>
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${toneClass}`}>
          <Icon className="h-4 w-4" aria-hidden />
        </span>
      </div>
      {hint ? <p className="mt-2 text-[0.7rem] leading-relaxed text-muted">{hint}</p> : null}
    </Card>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="flex items-center justify-between gap-3 px-4 py-3">
      <span className="text-xs font-semibold text-muted">{label}</span>
      <span className="text-sm font-bold text-heading">{value}</span>
    </Card>
  );
}

function Metric({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div>
      <dt className="text-[0.7rem] font-semibold text-muted">{label}</dt>
      <dd className={danger ? "mt-0.5 text-sm font-bold text-danger" : "mt-0.5 text-sm font-bold text-heading"}>
        {value}
      </dd>
    </div>
  );
}

function InsightRow({
  text,
  evidence,
  severity,
  period,
  suggestion,
}: {
  text: string;
  evidence: string[];
  severity: AdvisorInsight["severity"];
  period?: string;
  suggestion?: boolean;
}) {
  const iconClass =
    severity === "positive"
      ? "bg-accent-soft text-accent-strong"
      : severity === "critical"
        ? "bg-danger-soft text-danger"
        : severity === "warning"
          ? "bg-mango-100 text-mango-600"
          : "bg-page-soft text-muted";
  const Icon = suggestion ? Lightbulb : severity === "critical" || severity === "warning" ? AlertTriangle : CheckCircle2;
  return (
    <li className="rounded-xl border border-line bg-page/40 p-3">
      <div className="flex items-start gap-2.5">
        <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${iconClass}`}>
          <Icon className="h-3.5 w-3.5" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-sm leading-relaxed text-heading">{text}</p>
          {period ? <p className="mt-1 text-[0.7rem] text-muted">{period}</p> : null}
          {evidence.length > 0 ? (
            <ul className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5">
              {evidence.map((item) => (
                <li key={item} className="text-[0.7rem] font-medium text-muted">
                  {item}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </li>
  );
}
