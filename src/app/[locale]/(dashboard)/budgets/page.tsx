import type { Metadata } from "next";
import { Archive, PiggyBank, Target, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PlanGate } from "@/components/ui/plan-gate";
import { EmptyState } from "@/components/ui/empty-state";
import { NewBudgetForm } from "@/components/forms/new-budget-form";
import { GoalProgressForm, NewGoalForm } from "@/components/forms/goal-forms";
import { archiveBudgetAction } from "@/app/[locale]/(dashboard)/finance/actions";
import { listBudgetProgress, listExpenseCategories, listGoals } from "@/services/finance";
import { requireWorkspaceContext } from "@/lib/supabase/auth";
import { getWorkspaceEntitlements } from "@/lib/entitlements/service";
import { interpolate } from "@/lib/i18n/interpolate";
import { intlLocale, pickTranslation, resolveLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/server";
import { formatMoney, moneyLocale, toMinorUnits } from "@/lib/money";
import { getCurrency } from "@/lib/currency";
import { formatDate, monthBounds, todayInZone } from "@/lib/dates";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const dict = await getDictionary(resolveLocale((await params).locale));
  return { title: dict.finance.budgets.title, robots: { index: false, follow: false } };
}

function minorToMajorInput(value: number | string, currency: string): string {
  const minor = toMinorUnits(value);
  const decimals = getCurrency(currency).decimals;
  const negative = minor < 0n;
  const absolute = negative ? -minor : minor;
  const divisor = 10n ** BigInt(decimals);
  const whole = absolute / divisor;
  const fraction = absolute % divisor;
  const fractional = decimals > 0 ? `.${fraction.toString().padStart(decimals, "0")}` : "";
  return `${negative ? "-" : ""}${whole.toString()}${fractional}`;
}

export default async function BudgetsPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = resolveLocale((await params).locale);
  const dict = await getDictionary(locale);
  const context = await requireWorkspaceContext(locale);
  const entitlements = await getWorkspaceEntitlements(context.workspace.id, context.user.id);
  if (!entitlements.features.budget_management.included) {
    return (
      <div className="space-y-5">
        <header>
          <h1 className="text-2xl font-extrabold tracking-tight text-heading">{dict.finance.budgets.title}</h1>
          <p className="mt-1 text-sm text-muted">{dict.finance.budgets.subtitle}</p>
        </header>
        <PlanGate
          title={dict.plans.lockedTitle}
          body={interpolate(dict.plans.lockedBody, {
            plan: entitlements.features.budget_management.requiredPlan ?? dict.plans.growth,
          })}
          cta={dict.plans.upgrade}
          href={`/${locale}/billing`}
        />
      </div>
    );
  }
  const currency = context.workspace.currency;
  const timezone = context.workspace.timezone;
  const today = todayInZone(timezone);
  const bounds = monthBounds(new Date(), timezone);
  const canManage = context.can("budgets:manage");

  const [budgets, goals, categories] = await Promise.all([
    listBudgetProgress(context.workspace.id),
    listGoals(context.workspace.id),
    listExpenseCategories(context.workspace.id),
  ]);

  const money = (value: bigint | number | string) =>
    formatMoney(toMinorUnits(value), currency, moneyLocale(locale, currency));

  const totalBudget = budgets.reduce((sum, budget) => sum + toMinorUnits(budget.amount_minor), 0n);
  const totalSpent = budgets.reduce((sum, budget) => sum + toMinorUnits(budget.spent_minor), 0n);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-heading">{dict.finance.budgets.title}</h1>
          <p className="mt-1 text-sm text-muted">{dict.finance.budgets.subtitle}</p>
        </div>
        {canManage ? (
          <div className="flex flex-wrap gap-2">
            <NewGoalForm currency={currency} />
            <NewBudgetForm categories={categories} defaultStart={bounds.start} defaultEnd={bounds.end} currency={currency} />
          </div>
        ) : null}
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        <Card className="p-5">
          <div className="flex items-center gap-2 text-muted">
            <Target className="h-4 w-4" aria-hidden />
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.1em]">{dict.finance.budgets.amount}</p>
          </div>
          <p className="kpi-value mt-2 text-2xl font-semibold text-heading">{money(totalBudget)}</p>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-2 text-warn">
            <Wallet className="h-4 w-4" aria-hidden />
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.1em]">{dict.finance.budgets.spent}</p>
          </div>
          <p className="kpi-value mt-2 text-2xl font-semibold text-heading">{money(totalSpent)}</p>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-2 text-accent">
            <PiggyBank className="h-4 w-4" aria-hidden />
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.1em]">{dict.finance.goals.title}</p>
          </div>
          <p className="kpi-value mt-2 text-2xl font-semibold text-heading">{goals.length}</p>
        </Card>
      </section>

      <section aria-labelledby="budgets-title" className="space-y-3">
        <div className="flex items-end justify-between gap-2">
          <div>
            <h2 id="budgets-title" className="text-lg font-extrabold text-heading">
              {dict.finance.budgets.title}
            </h2>
            <p className="mt-0.5 text-sm text-muted">{dict.finance.budgets.subtitle}</p>
          </div>
          <Badge tone="outline">{formatDate(today, intlLocale(locale), timezone)}</Badge>
        </div>

        {budgets.length === 0 ? (
          <Card className="p-6">
            <EmptyState icon={Target} title={dict.finance.budgets.empty} description={dict.finance.budgets.emptyHint} />
          </Card>
        ) : (
          <ul className="grid gap-3 lg:grid-cols-2">
            {budgets.map((budget) => {
              const amount = toMinorUnits(budget.amount_minor);
              const spent = toMinorUnits(budget.spent_minor);
              const remaining = amount - spent;
              const percent = amount > 0n ? Math.min(100, Number((spent * 100n) / amount)) : 0;
              const over = remaining < 0n;
              const categoryName = pickTranslation(budget.category_translations, locale) ?? budget.category_name;

              return (
                <li key={budget.id} className="surface p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-heading">{budget.name}</p>
                      <p className="mt-0.5 text-xs text-muted">
                        {categoryName ?? dict.finance.budgets.allExpenses} ·{" "}
                        {formatDate(budget.period_start, intlLocale(locale), timezone)} —{" "}
                        {formatDate(budget.period_end, intlLocale(locale), timezone)}
                      </p>
                    </div>
                    <Badge tone={over ? "clay" : percent >= 100 ? "mango" : "outline"} className="shrink-0 text-[0.6rem]">
                      {over ? dict.finance.budgets.remainingNegative : `${percent}%`}
                    </Badge>
                  </div>

                  <div className="mt-4 flex items-end justify-between gap-2">
                    <div>
                      <p className="text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-muted">
                        {dict.finance.budgets.spent}
                      </p>
                      <p className="kpi-value text-lg font-semibold text-heading">{money(spent)}</p>
                    </div>
                    <p className="text-xs text-muted">
                      {dict.finance.budgets.amount}: <span className="kpi-value font-semibold text-heading">{money(amount)}</span>
                    </p>
                  </div>

                  <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-page-soft">
                    <div
                      className={over ? "h-full rounded-full bg-danger" : "h-full rounded-full bg-accent"}
                      style={{ width: `${Math.max(percent, 2)}%` }}
                    />
                  </div>
                  <p className={over ? "mt-1 text-xs font-semibold text-danger" : "mt-1 text-xs text-muted"}>
                    {dict.finance.budgets.remaining}: {money(remaining)}
                  </p>

                  {canManage ? (
                    <form action={archiveBudgetAction} className="mt-3 flex justify-end">
                      <input type="hidden" name="locale" value={locale} />
                      <input type="hidden" name="budgetId" value={budget.id} />
                      <button type="submit" className="inline-flex items-center gap-1 text-xs font-semibold text-muted hover:text-danger">
                        <Archive className="h-3.5 w-3.5" aria-hidden />
                        {dict.finance.budgets.archive}
                      </button>
                    </form>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="goals-title" className="space-y-3">
        <div>
          <h2 id="goals-title" className="text-lg font-extrabold text-heading">
            {dict.finance.goals.title}
          </h2>
          <p className="mt-0.5 text-sm text-muted">{dict.finance.goals.subtitle}</p>
        </div>

        {goals.length === 0 ? (
          <Card className="p-6">
            <EmptyState icon={PiggyBank} title={dict.finance.goals.empty} description={dict.finance.goals.emptyHint} />
          </Card>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {goals.map((goal) => {
              const target = toMinorUnits(goal.target_minor);
              const saved = toMinorUnits(goal.saved_minor);
              const percent = target > 0n ? Math.min(100, Number((saved * 100n) / target)) : 0;
              return (
                <li key={goal.id} className="surface p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-heading">{goal.name}</p>
                      <p className="mt-0.5 text-xs text-muted">
                        {dict.finance.goals.target}: {money(target)}
                        {goal.target_date ? ` · ${formatDate(goal.target_date, intlLocale(locale), timezone)}` : ""}
                      </p>
                    </div>
                    <Badge tone={goal.status === "achieved" ? "jade" : "outline"} className="shrink-0 text-[0.6rem]">
                      {goal.status === "achieved" ? dict.finance.goals.achieved : dict.finance.goals.active}
                    </Badge>
                  </div>

                  <div className="mt-3 flex items-end justify-between gap-2">
                    <p className="kpi-value text-lg font-semibold text-heading">{money(saved)}</p>
                    <p className="text-xs text-muted">{percent}%</p>
                  </div>
                  <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-page-soft">
                    <div className="h-full rounded-full bg-accent" style={{ width: `${Math.max(percent, 2)}%` }} />
                  </div>

                  {canManage ? (
                    <GoalProgressForm goalId={goal.id} saved={minorToMajorInput(goal.saved_minor, goal.currency)} />
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
