import type {
  AdvisorBrief,
  AdvisorFocus,
  AdvisorInsight,
  AdvisorInsightCode,
  AdvisorSeverity,
  BusinessIntelligence,
} from "@/types/ai-advisor";
import { addDays } from "@/lib/dates";

const FOCUS_PRIORITY: Record<AdvisorFocus, AdvisorInsightCode[]> = {
  balanced: [
    "overdue_receivables",
    "receivables_outstanding",
    "net_result_negative",
    "budget_over",
    "revenue_decrease",
    "revenue_increase",
    "top_expense_category",
    "expense_increase_week",
    "cash_balance",
    "recurring_expense",
    "revenue_concentration",
    "cost_data_missing",
    "gross_result_recorded",
    "budget_near",
    "payables_outstanding",
    "goal_progress",
    "net_result_positive",
    "expense_decrease_week",
    "follow_up_receivables",
    "review_category",
    "review_budget",
    "diversify_revenue",
    "review_recurring",
    "record_cost_data",
    "protect_cash",
    "review_payables",
  ],
  cash_flow: ["cash_balance", "net_result_negative", "receivables_outstanding", "payables_outstanding", "protect_cash"],
  costs: ["top_expense_category", "expense_increase_week", "recurring_expense", "review_category", "review_recurring"],
  growth: ["revenue_increase", "revenue_decrease", "revenue_concentration", "diversify_revenue"],
  collections: ["overdue_receivables", "receivables_outstanding", "follow_up_receivables", "review_payables"],
};

const SEVERITY_ORDER: Record<AdvisorSeverity, number> = {
  critical: 0,
  warning: 1,
  positive: 2,
  info: 3,
};

const MIN_MEANINGFUL_MINOR = 1000n;

function amount(value: string | number | null | undefined): bigint {
  if (value === null || value === undefined || value === "") return 0n;
  return BigInt(String(value));
}

function changePercent(current: bigint, previous: bigint): number | null {
  if (previous <= 0n) return null;
  return Number(((current - previous) * 10000n) / previous) / 100;
}

function sharePercent(bp: number): number {
  return Math.round(bp) / 100;
}

function insight(
  code: AdvisorInsightCode,
  kind: "fact" | "suggestion",
  severity: AdvisorSeverity,
  params: AdvisorInsight["params"],
  evidence: AdvisorInsight["evidence"],
  period?: AdvisorInsight["period"],
): AdvisorInsight {
  return {
    id: `${kind}-${code}-${JSON.stringify(params)}`,
    code,
    kind,
    severity,
    params,
    evidence,
    period,
  };
}

function ranking(focus: AdvisorFocus, code: AdvisorInsightCode): number {
  const index = FOCUS_PRIORITY[focus].indexOf(code);
  return index === -1 ? 100 : index;
}

function sortInsights(focus: AdvisorFocus, list: AdvisorInsight[]): AdvisorInsight[] {
  return [...list].sort((a, b) => {
    const byFocus = ranking(focus, a.code) - ranking(focus, b.code);
    if (byFocus !== 0) return byFocus;
    return SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
  });
}

function categoryName(row: { name: string; translations: Record<string, string> | null }): string {
  return row.name;
}

function averageMonthlyExpense(intelligence: BusinessIntelligence): bigint {
  const months = intelligence.monthlySeries.filter(
    (month) => amount(month.income) > 0n || amount(month.expense) > 0n,
  );
  if (months.length === 0) return 0n;
  const total = months.reduce((sum, month) => sum + amount(month.expense), 0n);
  return total / BigInt(months.length);
}

export function buildAdvisorBrief(
  intelligence: BusinessIntelligence,
  focus: AdvisorFocus = "balanced",
): AdvisorBrief {
  const facts: AdvisorInsight[] = [];
  const suggestions: AdvisorInsight[] = [];
  const period = intelligence.period;

  if (intelligence.coverage.transactionCount === 0) {
    return {
      period: { from: period.from, to: period.to },
      previousPeriod: intelligence.previousPeriod,
      focus,
      facts: [],
      suggestions: [],
      coverage: intelligence.coverage,
    };
  }

  const currentIncome = amount(intelligence.totals.incomeMinor);
  const currentExpense = amount(intelligence.totals.expenseMinor);
  const previousIncome = amount(intelligence.totals.previousIncomeMinor);
  const netResult = currentIncome - currentExpense;
  const weekFrom = addDays(period.to, -6);
  const previousWeekFrom = addDays(period.to, -13);

  // Weekly category movement: last 7 days vs the seven days before.
  const weekly = [...intelligence.categoryWeekComparisons]
    .map((row) => ({
      ...row,
      current: amount(row.current_minor),
      previous: amount(row.previous_minor),
    }))
    .filter((row) => row.current >= MIN_MEANINGFUL_MINOR || row.previous >= MIN_MEANINGFUL_MINOR);

  const increases = weekly
    .filter((row) => row.previous > 0 && row.current > row.previous)
    .map((row) => ({ row, change: changePercent(row.current, row.previous) }))
    .filter((entry) => entry.change !== null && entry.change >= 10)
    .sort((a, b) => {
      const deltaA = a.row.current - a.row.previous;
      const deltaB = b.row.current - b.row.previous;
      return deltaA > deltaB ? -1 : deltaA < deltaB ? 1 : 0;
    });

  const decreases = weekly
    .filter((row) => row.previous > row.current)
    .map((row) => ({ row, change: changePercent(row.current, row.previous) }))
    .filter((entry) => entry.change !== null && entry.change <= -10)
    .sort((a, b) => {
      const deltaA = a.row.previous - a.row.current;
      const deltaB = b.row.previous - b.row.current;
      return deltaA > deltaB ? -1 : deltaA < deltaB ? 1 : 0;
    });

  if (increases[0]) {
    const { row, change } = increases[0];
    const label = categoryName(row);
    facts.push(
      insight(
        "expense_increase_week",
        "fact",
        "warning",
        { category: label, changePct: change === null ? 0 : Math.round(change) },
        [
          { key: "current", amountMinor: row.current.toString(), date: period.to },
          { key: "previous", amountMinor: row.previous.toString(), date: previousWeekFrom },
        ],
        { from: weekFrom, to: period.to },
      ),
    );
  }

  if (decreases[0]) {
    const { row, change } = decreases[0];
    facts.push(
      insight(
        "expense_decrease_week",
        "fact",
        "positive",
        { category: categoryName(row), changePct: Math.round(change ?? 0) },
        [
          { key: "current", amountMinor: row.current.toString(), date: period.to },
          { key: "previous", amountMinor: row.previous.toString(), date: previousWeekFrom },
        ],
        { from: weekFrom, to: period.to },
      ),
    );
  }

  const topCategory = intelligence.expenseCategories[0];
  if (topCategory && amount(topCategory.total_minor) > 0n) {
    facts.push(
      insight(
        "top_expense_category",
        "fact",
        "info",
        { category: categoryName(topCategory), sharePct: sharePercent(topCategory.share_bp) },
        [{ key: "current", amountMinor: topCategory.total_minor }],
      ),
    );
  }

  const revenueChange = changePercent(currentIncome, previousIncome);
  if (revenueChange !== null && Math.abs(revenueChange) >= 10) {
    const code: AdvisorInsightCode = revenueChange > 0 ? "revenue_increase" : "revenue_decrease";
    facts.push(
      insight(
        code,
        "fact",
        revenueChange > 0 ? "positive" : "warning",
        { changePct: Math.abs(Math.round(revenueChange)), days: period.days },
        [
          { key: "current", amountMinor: currentIncome.toString() },
          { key: "previous", amountMinor: previousIncome.toString() },
        ],
      ),
    );
  }

  if (netResult > 0n) {
    facts.push(
      insight("net_result_positive", "fact", "positive", {}, [{ key: "net", amountMinor: netResult.toString() }]),
    );
  } else if (netResult < 0n) {
    facts.push(
      insight("net_result_negative", "fact", "warning", {}, [{ key: "net", amountMinor: netResult.toString() }]),
    );
  }

  const receivableAging = intelligence.debts.aging.filter((row) => row.direction === "receivable");
  const payableAging = intelligence.debts.aging.filter((row) => row.direction === "payable");
  const receivableCount = receivableAging.reduce((sum, row) => sum + row.debt_count, 0);
  const payableCount = payableAging.reduce((sum, row) => sum + row.debt_count, 0);
  const receivable = amount(intelligence.debts.receivableMinor);
  const payable = amount(intelligence.debts.payableMinor);
  const overdueReceivable = amount(intelligence.debts.overdueReceivableMinor);
  const overduePayable = amount(intelligence.debts.overduePayableMinor);

  if (receivable > 0n) {
    facts.push(
      insight(
        "receivables_outstanding",
        "fact",
        "warning",
        { count: receivableCount || intelligence.debts.openCount },
        [{ key: "outstanding", amountMinor: receivable.toString() }],
      ),
    );
  }
  if (overdueReceivable > 0n) {
    facts.push(
      insight("overdue_receivables", "fact", "critical", {}, [{ key: "overdue", amountMinor: overdueReceivable.toString() }]),
    );
  }
  if (payable > 0n) {
    facts.push(
      insight(
        "payables_outstanding",
        "fact",
        "info",
        { count: payableCount || intelligence.debts.openCount },
        [{ key: "outstanding", amountMinor: payable.toString() }],
      ),
    );
  }

  const topRecurring = intelligence.recurringExpenses[0];
  if (topRecurring) {
    facts.push(
      insight(
        "recurring_expense",
        "fact",
        "info",
        {
          description: topRecurring.description,
          occurrences: topRecurring.occurrences,
          cadenceDays: topRecurring.cadence_days,
        },
        [{ key: "average", amountMinor: topRecurring.average_minor, date: topRecurring.last_on }],
      ),
    );
  }

  const concentration = intelligence.revenueConcentration;
  if (currentIncome > 0n && concentration.topCustomerShareBp >= 5000) {
    facts.push(
      insight(
        "revenue_concentration",
        "fact",
        "warning",
        { sharePct: sharePercent(concentration.topCustomerShareBp) },
        [{ key: "current", amountMinor: concentration.topCustomerMinor }],
      ),
    );
  }

  const gross = intelligence.profitability;
  if (gross.grossResultAvailable && gross.grossResultMinor !== null) {
    facts.push(
      insight(
        "gross_result_recorded",
        "fact",
        "info",
        {},
        [
          { key: "net", amountMinor: gross.grossResultMinor },
          { key: "cost", amountMinor: gross.costOfGoodsMinor },
        ],
      ),
    );
  } else if (currentIncome > 0n && currentExpense > 0n) {
    facts.push(
      insight(
        "cost_data_missing",
        "fact",
        "info",
        {},
        [
          { key: "income", amountMinor: currentIncome.toString() },
          { key: "expense", amountMinor: currentExpense.toString() },
        ],
      ),
    );
  }

  const averageMonth = averageMonthlyExpense(intelligence);
  const cash = amount(intelligence.cashFlow.cashBalanceMinor);
  if (averageMonth > 0n && cash >= 0n) {
    const months = Math.round((Number(cash) / Number(averageMonth)) * 10) / 10;
    facts.push(
      insight("cash_balance", "fact", months < 1 ? "warning" : "info", { months }, [
        { key: "cash", amountMinor: cash.toString() },
        { key: "average", amountMinor: averageMonth.toString() },
      ]),
    );
    if (months < 1) {
      suggestions.push(
        insight("protect_cash", "suggestion", "warning", { months }, [
          { key: "cash", amountMinor: cash.toString() },
        ]),
      );
    }
  }

  for (const budget of intelligence.budgets) {
    if (budget.used_bp >= 10000) {
      facts.push(
        insight(
          "budget_over",
          "fact",
          "critical",
          { budget: budget.name, usedPct: sharePercent(budget.used_bp) },
          [
            { key: "spent", amountMinor: budget.spent_minor, date: budget.period_end },
            { key: "limit", amountMinor: budget.amount_minor },
          ],
        ),
      );
      suggestions.push(
        insight("review_budget", "suggestion", "warning", { budget: budget.name }, [
          { key: "spent", amountMinor: budget.spent_minor },
          { key: "limit", amountMinor: budget.amount_minor },
        ]),
      );
    } else if (budget.used_bp >= budget.alert_threshold_bp) {
      facts.push(
        insight(
          "budget_near",
          "fact",
          "warning",
          { budget: budget.name, usedPct: sharePercent(budget.used_bp) },
          [
            { key: "spent", amountMinor: budget.spent_minor, date: budget.period_end },
            { key: "limit", amountMinor: budget.amount_minor },
          ],
        ),
      );
      suggestions.push(
        insight("review_budget", "suggestion", "info", { budget: budget.name }, [
          { key: "spent", amountMinor: budget.spent_minor },
          { key: "limit", amountMinor: budget.amount_minor },
        ]),
      );
    }
  }

  const goal = intelligence.goals.find((row) => row.progress_bp < 10000);
  if (goal) {
    facts.push(
      insight(
        "goal_progress",
        "fact",
        "info",
        { goal: goal.name, progressPct: sharePercent(goal.progress_bp) },
        [
          { key: "saved", amountMinor: goal.saved_minor },
          { key: "target", amountMinor: goal.target_minor, date: goal.target_date ?? undefined },
        ],
      ),
    );
  }

  // Suggestions are tied to the facts above and never introduce new figures.
  if (overdueReceivable > 0n || receivable > 0n) {
    suggestions.push(
      insight(
        "follow_up_receivables",
        "suggestion",
        overdueReceivable > 0n ? "warning" : "info",
        { count: receivableCount || intelligence.debts.openCount },
        [{ key: "outstanding", amountMinor: receivable.toString() }],
      ),
    );
  }
  if (overduePayable > 0n) {
    suggestions.push(
      insight("review_payables", "suggestion", "warning", {}, [
        { key: "overdue", amountMinor: overduePayable.toString() },
      ]),
    );
  }
  if (increases[0]) {
    suggestions.push(
      insight(
        "review_category",
        "suggestion",
        "warning",
        { category: categoryName(increases[0].row) },
        [
          { key: "current", amountMinor: increases[0].row.current.toString() },
          { key: "previous", amountMinor: increases[0].row.previous.toString() },
        ],
      ),
    );
  }
  if (topRecurring) {
    suggestions.push(
      insight(
        "review_recurring",
        "suggestion",
        "info",
        { description: topRecurring.description },
        [{ key: "average", amountMinor: topRecurring.average_minor }],
      ),
    );
  }
  if (concentration.topCustomerShareBp >= 5000) {
    suggestions.push(
      insight(
        "diversify_revenue",
        "suggestion",
        "warning",
        { sharePct: sharePercent(concentration.topCustomerShareBp) },
        [{ key: "current", amountMinor: concentration.topCustomerMinor }],
      ),
    );
  }
  if (currentIncome > 0n && currentExpense > 0n && !gross.grossResultAvailable) {
    suggestions.push(
      insight("record_cost_data", "suggestion", "info", {}, [
        { key: "current", amountMinor: gross.costOfGoodsMinor },
      ]),
    );
  }

  return {
    period: { from: period.from, to: period.to },
    previousPeriod: intelligence.previousPeriod,
    focus,
    facts: sortInsights(focus, facts).slice(0, 14),
    suggestions: sortInsights(focus, suggestions).slice(0, 8),
    coverage: intelligence.coverage,
  };
}

export function buildAdvisorContext(brief: AdvisorBrief, currency: string, timezone: string): string {
  const factLines = brief.facts.map((item) => {
    const figures = item.evidence
      .map((evidence) => `${evidence.key}=${evidence.amountMinor} ${currency}${evidence.date ? ` on ${evidence.date}` : ""}`)
      .join("; ");
    return `- ${item.code}: ${JSON.stringify(item.params)} (${figures})`;
  });
  const suggestionLines = brief.suggestions.map((item) => {
    const figures = item.evidence
      .map((evidence) => `${evidence.key}=${evidence.amountMinor} ${currency}`)
      .join("; ");
    return `- ${item.code}: ${JSON.stringify(item.params)} (${figures})`;
  });

  return `Business intelligence context for ${brief.period.from} to ${brief.period.to} (timezone ${timezone}).
Previous comparison period: ${brief.previousPeriod.from} to ${brief.previousPeriod.to}.
Recorded facts (computed from this workspace only):
${factLines.length ? factLines.join("\n") : "- no material findings"}
Possible advisory suggestions:
${suggestionLines.length ? suggestionLines.join("\n") : "- none"}

Only use these facts when giving advice. Treat suggestions as options, not instructions. Do not claim profitability, business health or future revenue beyond what the facts support.`;
}
