import { describe, expect, it } from "vitest";
import { buildAdvisorBrief, buildAdvisorContext } from "@/lib/ai/advisor";
import type { BusinessIntelligence } from "@/types/ai-advisor";

function intelligence(overrides: Partial<BusinessIntelligence> = {}): BusinessIntelligence {
  return {
    workspace: {
      id: "workspace-1",
      name: "KontaFlow Demo",
      currency: "XAF",
      timezone: "Africa/Douala",
      industry: "Retail",
      businessSize: "small",
    },
    period: { from: "2026-08-01", to: "2026-11-26", days: 118 },
    previousPeriod: { from: "2026-04-05", to: "2026-07-31" },
    coverage: {
      transactionCount: 17,
      activeDays: 9,
      firstRecordedOn: "2026-08-02",
      lastRecordedOn: "2026-11-25",
    },
    totals: {
      incomeMinor: "500000",
      expenseMinor: "300000",
      netResultMinor: "200000",
      previousIncomeMinor: "400000",
      previousExpenseMinor: "250000",
      previousNetResultMinor: "150000",
      averageDailyExpenseMinor: "2542",
      averageWeeklyExpenseMinor: "17797",
    },
    profitability: {
      costOfGoodsRecorded: true,
      costOfGoodsMinor: "35000",
      previousCostOfGoodsMinor: "0",
      grossResultAvailable: true,
      grossResultMinor: "465000",
      grossMarginBp: 9300,
      note: "Gross only when stock purchases are recorded.",
    },
    cashFlow: {
      cashBalanceMinor: "120000",
      netMovementMinor: "200000",
      openingBalanceMinor: "-80000",
    },
    dailySeries: [],
    weeklySeries: [],
    monthlySeries: [
      { month: "2026-08", income: "100000", expense: "50000", net: "50000" },
      { month: "2026-09", income: "120000", expense: "60000", net: "60000" },
      { month: "2026-10", income: "140000", expense: "70000", net: "70000" },
      { month: "2026-11", income: "140000", expense: "120000", net: "20000" },
    ],
    expenseCategories: [
      {
        id: "cat-transport",
        name: "Transport",
        translations: { fr: "Transport", pcm: "Transport" },
        color: "#f2b64b",
        total_minor: "120000",
        previous_minor: "70000",
        share_bp: 4000,
        change_bp: 7143,
      },
    ],
    incomeCategories: [],
    categoryWeekComparisons: [
      {
        id: "cat-transport",
        name: "Transport",
        translations: { fr: "Transport", pcm: "Transport" },
        current_minor: "30000",
        previous_minor: "10000",
      },
    ],
    topCustomers: [
      { id: "contact-1", name: "Mballa SARL", total_minor: "300000", share_bp: 6000 },
    ],
    revenueConcentration: {
      attributedIncomeMinor: "300000",
      unattributedIncomeMinor: "200000",
      topCustomerMinor: "300000",
      topCustomerShareBp: 6000,
      topFiveShareBp: 6000,
    },
    debts: {
      receivableMinor: "50000",
      payableMinor: "15000",
      overdueReceivableMinor: "20000",
      overduePayableMinor: "0",
      openCount: 3,
      aging: [
        {
          direction: "receivable",
          bucket: "days_1_30",
          total_minor: "20000",
          debt_count: 1,
        },
        {
          direction: "receivable",
          bucket: "not_due",
          total_minor: "30000",
          debt_count: 1,
        },
      ],
      topOpen: [],
    },
    budgets: [
      {
        id: "budget-1",
        name: "November operations",
        category_name: "Transport",
        category_translations: { fr: "Transport" },
        category_color: "#f2b64b",
        period_start: "2026-11-01",
        period_end: "2026-11-30",
        amount_minor: "100000",
        spent_minor: "120000",
        alert_threshold_bp: 8000,
        used_bp: 12000,
      },
    ],
    recurringExpenses: [
      {
        description: "Wages",
        category_name: "Salaries",
        category_translations: { fr: "Salaires" },
        occurrences: 4,
        months_seen: 4,
        average_minor: "25000",
        min_minor: "24000",
        max_minor: "26000",
        last_on: "2026-11-25",
        cadence_days: 30,
      },
    ],
    goals: [
      {
        id: "goal-1",
        name: "New delivery bike",
        target_minor: "600000",
        saved_minor: "150000",
        currency: "XAF",
        target_date: "2027-06-30",
        progress_bp: 2500,
      },
    ],
    ...overrides,
  };
}

describe("advisor brief", () => {
  it("builds grounded facts and suggestions from recorded data", () => {
    const brief = buildAdvisorBrief(intelligence());
    const facts = brief.facts.map((item) => item.code);
    const suggestions = brief.suggestions.map((item) => item.code);

    expect(facts).toContain("expense_increase_week");
    expect(facts).toContain("top_expense_category");
    expect(facts).toContain("revenue_increase");
    expect(facts).toContain("net_result_positive");
    expect(facts).toContain("receivables_outstanding");
    expect(facts).toContain("overdue_receivables");
    expect(facts).toContain("recurring_expense");
    expect(facts).toContain("revenue_concentration");
    expect(facts).toContain("budget_over");
    expect(facts).toContain("gross_result_recorded");
    expect(facts).toContain("cash_balance");
    expect(facts).toContain("goal_progress");

    expect(suggestions).toContain("follow_up_receivables");
    expect(suggestions).toContain("review_category");
    expect(suggestions).toContain("review_recurring");
    expect(suggestions).toContain("diversify_revenue");
    expect(suggestions).toContain("review_budget");
  });

  it("puts owner focus first without changing the underlying facts", () => {
    const balanced = buildAdvisorBrief(intelligence(), "balanced");
    const costs = buildAdvisorBrief(intelligence(), "costs");

    expect(costs.suggestions[0]?.code).toBe("review_category");
    expect(balanced.suggestions.map((item) => item.id)).toEqual(
      expect.arrayContaining(costs.suggestions.map((item) => item.id)),
    );
  });

  it("returns no advice when there are no posted transactions", () => {
    const empty = intelligence({
      coverage: {
        transactionCount: 0,
        activeDays: 0,
        firstRecordedOn: null,
        lastRecordedOn: null,
      },
    });
    const brief = buildAdvisorBrief(empty);
    expect(brief.facts).toEqual([]);
    expect(brief.suggestions).toEqual([]);
  });

  it("does not invent gross profit when cost data is missing", () => {
    const noCost = intelligence({
      profitability: {
        costOfGoodsRecorded: false,
        costOfGoodsMinor: "0",
        previousCostOfGoodsMinor: "0",
        grossResultAvailable: false,
        grossResultMinor: null,
        grossMarginBp: null,
        note: "No cost data.",
      },
    });
    const brief = buildAdvisorBrief(noCost);
    expect(brief.facts.map((item) => item.code)).toContain("cost_data_missing");
    expect(brief.facts.map((item) => item.code)).not.toContain("gross_result_recorded");
    expect(brief.suggestions.map((item) => item.code)).toContain("record_cost_data");
  });

  it("does not claim an increase when a category had no earlier spending", () => {
    const freshCategory = intelligence({
      categoryWeekComparisons: [
        {
          id: "cat-fuel",
          name: "Fuel",
          translations: { fr: "Carburant", pcm: "Fuel" },
          current_minor: "30000",
          previous_minor: "0",
        },
      ],
    });
    const brief = buildAdvisorBrief(freshCategory);
    expect(brief.facts.map((item) => item.code)).not.toContain("expense_increase_week");
    expect(brief.suggestions.map((item) => item.code)).not.toContain("review_category");
  });

  it("includes guardrails and only recorded figures in model context", () => {
    const context = buildAdvisorContext(buildAdvisorBrief(intelligence()), "XAF", "Africa/Douala");
    expect(context).toContain("2026-08-01 to 2026-11-26");
    expect(context).toContain("expense_increase_week");
    expect(context).toContain("Do not claim profitability");
  });
});
