import { describe, expect, it } from "vitest";
import { loadScheduledReportData } from "@/lib/reports/data";
import type { DashboardSummary, ReportResult } from "@/types/database";

const workspace = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Nkeng Fresh Foods",
  currency: "XAF",
  timezone: "Africa/Douala",
};

function summary(overrides: Partial<DashboardSummary> = {}): DashboardSummary {
  return {
    workspace: { ...workspace, plan: "growth" },
    period: { from: "2026-11-01", to: "2026-11-30" },
    totalIncomeMinor: "500000",
    totalExpenseMinor: "300000",
    netProfitMinor: "200000",
    previousIncomeMinor: "400000",
    previousExpenseMinor: "250000",
    cashBalanceMinor: "120000",
    outstandingReceivablesMinor: "50000",
    outstandingPayablesMinor: "15000",
    overdueReceivablesMinor: "20000",
    overduePayablesMinor: "0",
    openDebtCount: 3,
    aiMessagesUsed: 12,
    monthlySeries: [
      { month: "2026-10", income: "400000", expense: "250000" },
      { month: "2026-11", income: "500000", expense: "300000" },
    ],
    topExpenseCategories: [
      { name: "Transport", translations: { fr: "Transport" }, color: "#f2b64b", total: "120000" },
      { name: "Food", translations: { fr: "Nourriture" }, color: "#0b7a5a", total: "30000" },
    ],
    budgetProgress: [
      {
        id: "budget-1",
        name: "November operations",
        category_id: "cat-1",
        category_name: "Transport",
        category_translations: { fr: "Transport" },
        category_color: "#f2b64b",
        period_start: "2026-11-01",
        period_end: "2026-11-30",
        amount_minor: "100000",
        spent_minor: "120000",
        currency: "XAF",
      },
    ],
    recentTransactions: [],
    ...overrides,
  };
}

function report(overrides: Partial<ReportResult> = {}): ReportResult {
  return {
    period: { from: "2026-11-01", to: "2026-11-30" },
    revenueMinor: "500000",
    expenseMinor: "300000",
    netProfitMinor: "200000",
    transactionCount: 17,
    byCategory: [],
    dailySeries: [
      { date: "2026-11-01", income: "20000", expense: "5000" },
      { date: "2026-11-02", income: "0", expense: "7000" },
    ],
    topCustomers: [
      { name: "Mballa SARL", total: "300000" },
      { name: "Etablissements Tchoumi", total: "50000" },
    ],
    ...overrides,
  };
}

function fakeAdmin(
  previousSummary = summary({ totalIncomeMinor: "350000", totalExpenseMinor: "200000" }),
  currentSummary = summary(),
) {
  return {
    rpc: async (name: string, params: { p_from?: string }) => {
      if (name === "get_report_as_service") return { data: report(), error: null };
      if (name === "get_workspace_summary_as_service") {
        return {
          data: params.p_from === "2026-10-01" ? previousSummary : currentSummary,
          error: null,
        };
      }
      return { data: null, error: { code: "unexpected_rpc" } };
    },
  } as never;
}

describe("scheduled report calculations", () => {
  it("maps summary and report rows into exact minor-unit values", async () => {
    const data = await loadScheduledReportData(
      fakeAdmin(),
      workspace,
      "monthly",
      "2026-11-01",
      "2026-11-30",
      "2026-11-26",
    );

    expect(data.incomeMinor).toBe(500_000n);
    expect(data.expenseMinor).toBe(300_000n);
    expect(data.netMinor).toBe(200_000n);
    expect(data.cashMinor).toBe(120_000n);
    expect(data.transactionCount).toBe(17);
    expect(data.previousIncomeMinor).toBe(350_000n);
    expect(data.previousExpenseMinor).toBe(200_000n);
    expect(data.previousNetMinor).toBe(150_000n);
    expect(data.previousFrom).toBe("2026-10-01");
    expect(data.previousTo).toBe("2026-10-31");
    expect(data.hasActivity).toBe(true);
  });

  it("computes category shares and budget usage in basis points", async () => {
    const data = await loadScheduledReportData(
      fakeAdmin(),
      workspace,
      "monthly",
      "2026-11-01",
      "2026-11-30",
      "2026-11-26",
    );

    expect(data.expenseCategories[0]).toMatchObject({ name: "Transport", totalMinor: 120_000n, shareBp: 4000 });
    expect(data.expenseCategories[1]?.shareBp).toBe(1000);
    expect(data.budgets[0]).toMatchObject({ amountMinor: 100_000n, spentMinor: 120_000n, usedBp: 12000 });
  });

  it("derives monthly net from income minus expense, not from a rounded total", async () => {
    const data = await loadScheduledReportData(
      fakeAdmin(),
      workspace,
      "monthly",
      "2026-11-01",
      "2026-11-30",
      "2026-11-26",
    );
    expect(data.monthlySeries).toEqual([
      { month: "2026-10", incomeMinor: 400_000n, expenseMinor: 250_000n, netMinor: 150_000n },
      { month: "2026-11", incomeMinor: 500_000n, expenseMinor: 300_000n, netMinor: 200_000n },
    ]);
  });

  it("uses the previous day for a daily report and avoids division by zero", async () => {
    const data = await loadScheduledReportData(
      fakeAdmin(
        summary({ totalIncomeMinor: "0", totalExpenseMinor: "0" }),
        summary({ totalIncomeMinor: "0", totalExpenseMinor: "0" }),
      ),
      workspace,
      "daily",
      "2026-11-26",
      "2026-11-26",
      "2026-11-26",
    );
    expect(data.previousFrom).toBe("2026-11-25");
    expect(data.previousTo).toBe("2026-11-25");
    expect(data.hasActivity).toBe(true);
    expect(data.expenseCategories[0]?.shareBp).toBe(0);
  });

  it("fails closed when the database report is unavailable", async () => {
    const broken = {
      rpc: async (name: string) =>
        name === "get_report_as_service"
          ? { data: null, error: { code: "42501" } }
          : { data: summary(), error: null },
    } as never;

    await expect(
      loadScheduledReportData(broken, workspace, "weekly", "2026-11-20", "2026-11-26", "2026-11-26"),
    ).rejects.toThrow(/report_unavailable/);
  });
});
