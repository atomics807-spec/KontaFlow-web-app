import type { DashboardSummary, ReportKind, ReportResult } from "@/types/database";
import type { createAdminClient } from "@/lib/supabase/admin";
import { toMinorUnits } from "@/lib/money";
import { addDays, monthBounds } from "@/lib/dates";

export type ReportWorkspace = {
  id: string;
  name: string;
  currency: string;
  timezone: string;
};

export type ReportCategory = {
  name: string;
  translations: Record<string, string> | null;
  totalMinor: bigint;
  shareBp: number;
};

export type ReportCustomer = {
  name: string;
  totalMinor: bigint;
};

export type ReportMonthlyPoint = {
  month: string;
  incomeMinor: bigint;
  expenseMinor: bigint;
  netMinor: bigint;
};

export type ReportBudget = {
  name: string;
  categoryName: string | null;
  categoryTranslations: Record<string, string> | null;
  amountMinor: bigint;
  spentMinor: bigint;
  usedBp: number;
  periodEnd: string;
};

export type ScheduledReportData = {
  kind: ReportKind;
  from: string;
  to: string;
  reportDate: string;
  workspace: ReportWorkspace;
  incomeMinor: bigint;
  expenseMinor: bigint;
  netMinor: bigint;
  cashMinor: bigint;
  previousIncomeMinor: bigint;
  previousExpenseMinor: bigint;
  previousNetMinor: bigint;
  previousFrom: string | null;
  previousTo: string | null;
  transactionCount: number;
  expenseCategories: ReportCategory[];
  topCustomers: ReportCustomer[];
  monthlySeries: ReportMonthlyPoint[];
  dailySeries: { date: string; incomeMinor: bigint; expenseMinor: bigint }[];
  debts: {
    receivableMinor: bigint;
    payableMinor: bigint;
    overdueReceivableMinor: bigint;
    overduePayableMinor: bigint;
    openCount: number;
  };
  budgets: ReportBudget[];
  hasActivity: boolean;
};

type AdminClient = ReturnType<typeof createAdminClient>;

function previousMonthBounds(from: string): { from: string; to: string } {
  const [year, month] = from.split("-").map(Number);
  const start = new Date(Date.UTC(year, month - 2, 1));
  const bounds = monthBounds(start, "UTC");
  return { from: bounds.start, to: bounds.end };
}

function shareBp(part: bigint, total: bigint): number {
  if (total <= 0n) return 0;
  return Number((part * 10_000n) / total);
}

function mapSummary(
  summary: DashboardSummary,
  report: ReportResult,
  params: {
    kind: ReportKind;
    from: string;
    to: string;
    reportDate: string;
    workspace: ReportWorkspace;
    previous: { income: bigint; expense: bigint; from: string | null; to: string | null };
  },
): ScheduledReportData {
  const incomeMinor = toMinorUnits(summary.totalIncomeMinor);
  const expenseMinor = toMinorUnits(summary.totalExpenseMinor);
  const netMinor = toMinorUnits(summary.netProfitMinor);
  const previousIncomeMinor = params.previous.income;
  const previousExpenseMinor = params.previous.expense;

  return {
    kind: params.kind,
    from: params.from,
    to: params.to,
    reportDate: params.reportDate,
    workspace: params.workspace,
    incomeMinor,
    expenseMinor,
    netMinor,
    cashMinor: toMinorUnits(summary.cashBalanceMinor),
    previousIncomeMinor,
    previousExpenseMinor,
    previousNetMinor: previousIncomeMinor - previousExpenseMinor,
    previousFrom: params.previous.from,
    previousTo: params.previous.to,
    transactionCount: Number(report.transactionCount ?? 0),
    expenseCategories: (summary.topExpenseCategories ?? []).map((category) => {
      const totalMinor = toMinorUnits(category.total);
      return {
        name: category.name,
        translations: category.translations ?? null,
        totalMinor,
        shareBp: shareBp(totalMinor, expenseMinor),
      };
    }),
    topCustomers: (report.topCustomers ?? []).map((customer) => ({
      name: customer.name,
      totalMinor: toMinorUnits(customer.total),
    })),
    monthlySeries: (summary.monthlySeries ?? []).map((point) => ({
      month: point.month,
      incomeMinor: toMinorUnits(point.income),
      expenseMinor: toMinorUnits(point.expense),
      netMinor: toMinorUnits(point.income) - toMinorUnits(point.expense),
    })),
    dailySeries: (report.dailySeries ?? []).map((point) => ({
      date: point.date,
      incomeMinor: toMinorUnits(point.income),
      expenseMinor: toMinorUnits(point.expense),
    })),
    debts: {
      receivableMinor: toMinorUnits(summary.outstandingReceivablesMinor),
      payableMinor: toMinorUnits(summary.outstandingPayablesMinor),
      overdueReceivableMinor: toMinorUnits(summary.overdueReceivablesMinor),
      overduePayableMinor: toMinorUnits(summary.overduePayablesMinor),
      openCount: Number(summary.openDebtCount ?? 0),
    },
    budgets: (summary.budgetProgress ?? []).map((budget) => {
      const amountMinor = toMinorUnits(budget.amount_minor);
      const spentMinor = toMinorUnits(budget.spent_minor);
      return {
        name: budget.name,
        categoryName: budget.category_name ?? null,
        categoryTranslations: budget.category_translations ?? null,
        amountMinor,
        spentMinor,
        usedBp: amountMinor > 0n ? Number((spentMinor * 10_000n) / amountMinor) : 0,
        periodEnd: budget.period_end,
      };
    }),
    hasActivity: incomeMinor > 0n || expenseMinor > 0n || Number(report.transactionCount ?? 0) > 0,
  };
}

export async function loadScheduledReportData(
  admin: AdminClient,
  workspace: ReportWorkspace,
  kind: ReportKind,
  from: string,
  to: string,
  reportDate: string,
): Promise<ScheduledReportData> {
  const [summaryResult, reportResult] = await Promise.all([
    admin.rpc("get_workspace_summary_as_service", {
      p_workspace_id: workspace.id,
      p_from: from,
      p_to: to,
    }),
    admin.rpc("get_report_as_service", {
      p_workspace_id: workspace.id,
      p_from: from,
      p_to: to,
    }),
  ]);

  if (summaryResult.error || !summaryResult.data) {
    throw new Error(`summary_unavailable:${summaryResult.error?.code ?? "unknown"}`);
  }
  if (reportResult.error || !reportResult.data) {
    throw new Error(`report_unavailable:${reportResult.error?.code ?? "unknown"}`);
  }

  const summary = summaryResult.data as DashboardSummary;
  const report = reportResult.data as ReportResult;

  let previous = {
    income: toMinorUnits(summary.previousIncomeMinor),
    expense: toMinorUnits(summary.previousExpenseMinor),
    from: null as string | null,
    to: null as string | null,
  };

  if (kind === "monthly") {
    const bounds = previousMonthBounds(from);
    const previousResult = await admin.rpc("get_workspace_summary_as_service", {
      p_workspace_id: workspace.id,
      p_from: bounds.from,
      p_to: bounds.to,
    });
    if (!previousResult.error && previousResult.data) {
      const previousSummary = previousResult.data as DashboardSummary;
      previous = {
        income: toMinorUnits(previousSummary.totalIncomeMinor),
        expense: toMinorUnits(previousSummary.totalExpenseMinor),
        from: bounds.from,
        to: bounds.to,
      };
    }
  } else if (kind === "weekly") {
    previous = {
      income: previous.income,
      expense: previous.expense,
      from: addDays(from, -7),
      to: addDays(to, -7),
    };
  } else {
    previous = {
      income: previous.income,
      expense: previous.expense,
      from: addDays(from, -1),
      to: addDays(to, -1),
    };
  }

  return mapSummary(summary, report, {
    kind,
    from,
    to,
    reportDate,
    workspace,
    previous,
  });
}
