import { describe, expect, it } from "vitest";
import { isLastDayOfMonthInZone } from "@/lib/dates";
import { en } from "@/lib/i18n/dictionaries/en";
import type { ScheduledReportData } from "@/lib/reports/data";
import { buildReportObservations, buildScheduledReport } from "@/lib/reports/scheduled";

function baseData(overrides: Partial<ScheduledReportData> = {}): ScheduledReportData {
  return {
    kind: "daily",
    from: "2026-05-20",
    to: "2026-05-20",
    reportDate: "2026-05-21",
    workspace: { id: "ws-1", name: "Mboa Hardware", currency: "XAF", timezone: "Africa/Douala" },
    incomeMinor: 150_000n,
    expenseMinor: 50_000n,
    netMinor: 100_000n,
    cashMinor: 400_000n,
    previousIncomeMinor: 100_000n,
    previousExpenseMinor: 40_000n,
    previousNetMinor: 60_000n,
    previousFrom: "2026-05-19",
    previousTo: "2026-05-19",
    transactionCount: 12,
    expenseCategories: [
      {
        name: "Transport",
        translations: { fr: "Transport" },
        totalMinor: 30_000n,
        shareBp: 6_000,
      },
      {
        name: "Stock",
        translations: { fr: "Stock" },
        totalMinor: 20_000n,
        shareBp: 4_000,
      },
    ],
    topCustomers: [{ name: "Client A", totalMinor: 80_000n }],
    monthlySeries: [
      { month: "2026-03", incomeMinor: 90_000n, expenseMinor: 40_000n, netMinor: 50_000n },
      { month: "2026-04", incomeMinor: 100_000n, expenseMinor: 45_000n, netMinor: 55_000n },
      { month: "2026-05", incomeMinor: 150_000n, expenseMinor: 50_000n, netMinor: 100_000n },
    ],
    dailySeries: [
      { date: "2026-05-20", incomeMinor: 150_000n, expenseMinor: 50_000n },
    ],
    debts: {
      receivableMinor: 25_000n,
      payableMinor: 10_000n,
      overdueReceivableMinor: 5_000n,
      overduePayableMinor: 0n,
      openCount: 2,
    },
    budgets: [
      {
        name: "Transport budget",
        categoryName: "Transport",
        categoryTranslations: { fr: "Transport" },
        amountMinor: 40_000n,
        spentMinor: 36_000n,
        usedBp: 9_000,
        periodEnd: "2026-05-31",
      },
    ],
    hasActivity: true,
    ...overrides,
  };
}

describe("scheduled reports", () => {
  it("detects the last day of the month in the workspace timezone", () => {
    expect(isLastDayOfMonthInZone("Africa/Douala", new Date("2026-05-31T22:00:00Z"))).toBe(true);
    expect(isLastDayOfMonthInZone("Africa/Douala", new Date("2026-05-31T23:30:00Z"))).toBe(false);
  });

  it("builds a daily close with totals, top category and observations", () => {
    const report = buildScheduledReport(baseData(), en, "en");

    expect(report.subject).toContain("Mboa Hardware");
    expect(report.title).toContain("Daily close");
    expect(report.text).toContain("Transport");
    expect(report.text).toContain("60%");
    expect(report.text).toContain("Financial observations");
    expect(report.notificationBody.length).toBeLessThanOrEqual(900);
    expect(report.data.report_kind).toBe("daily");
    expect(report.whatsappTemplateParams).toHaveLength(5);
  });

  it("adds a previous-period comparison and daily revenue trend to weekly reports", () => {
    const report = buildScheduledReport(
      baseData({
        kind: "weekly",
        from: "2026-05-18",
        to: "2026-05-24",
        reportDate: "2026-05-24",
        dailySeries: [
          { date: "2026-05-18", incomeMinor: 10_000n, expenseMinor: 2_000n },
          { date: "2026-05-19", incomeMinor: 20_000n, expenseMinor: 3_000n },
          { date: "2026-05-20", incomeMinor: 30_000n, expenseMinor: 4_000n },
        ],
      }),
      en,
      "en",
    );

    expect(report.title).toContain("Weekly report");
    expect(report.text).toContain("Compared with the previous period");
    expect(report.text).toContain("+50%");
    expect(report.text).toContain("Revenue trend");
  });

  it("adds budget and cash-flow sections to monthly reports", () => {
    const report = buildScheduledReport(
      baseData({
        kind: "monthly",
        from: "2026-05-01",
        to: "2026-05-31",
        reportDate: "2026-05-31",
      }),
      en,
      "en",
    );

    expect(report.title).toContain("Monthly report");
    expect(report.text).toContain("Budget performance");
    expect(report.text).toContain("90%");
    expect(report.text).toContain("Cash-flow trend");
  });

  it("turns overdue balances and near-limit budgets into actions", () => {
    const observations = buildReportObservations(baseData());

    expect(observations.facts.map((item) => item.code)).toContain("overdue_receivables");
    expect(observations.facts.map((item) => item.code)).toContain("budget_near");
    expect(observations.suggestions.map((item) => item.code)).toContain("follow_up_receivables");
    expect(observations.suggestions.map((item) => item.code)).toContain("review_budget");
  });

  it("still builds a message when the period has no activity", () => {
    const report = buildScheduledReport(
      baseData({
        incomeMinor: 0n,
        expenseMinor: 0n,
        netMinor: 0n,
        previousIncomeMinor: 0n,
        previousExpenseMinor: 0n,
        previousNetMinor: 0n,
        transactionCount: 0,
        expenseCategories: [],
        hasActivity: false,
      }),
      en,
      "en",
    );

    expect(report.text).toContain("Mboa Hardware");
    expect(report.text).toContain("Outstanding balances");
  });
});
