export type AdvisorFocus = "balanced" | "cash_flow" | "costs" | "growth" | "collections";

export type AiWorkspacePreferences = {
  workspaceId: string;
  insightsEnabled: boolean;
  analysisWindowDays: number;
  historyRetentionDays: number;
  advisorFocus: AdvisorFocus;
  advisorNote: string | null;
};

export type BusinessIntelligenceSeriesPoint = {
  date: string;
  income: string;
  expense: string;
  net: string;
};

export type BusinessIntelligenceWeeklyPoint = {
  week_start: string;
  week_end: string;
  income: string;
  expense: string;
  net: string;
};

export type BusinessIntelligenceMonthlyPoint = {
  month: string;
  income: string;
  expense: string;
  net: string;
};

export type BusinessIntelligenceCategory = {
  id: string;
  name: string;
  translations: Record<string, string> | null;
  color: string | null;
  total_minor: string;
  previous_minor?: string;
  share_bp: number;
  change_bp?: number | null;
};

export type BusinessIntelligenceCustomer = {
  id: string;
  name: string;
  total_minor: string;
  share_bp: number;
};

export type BusinessIntelligenceDebt = {
  direction: "receivable" | "payable";
  contact_name: string | null;
  description: string;
  outstanding_minor: string;
  due_on: string | null;
  overdue: boolean;
};

export type BusinessIntelligenceBudget = {
  id: string;
  name: string;
  category_name: string | null;
  category_translations: Record<string, string> | null;
  category_color: string | null;
  period_start: string;
  period_end: string;
  amount_minor: string;
  spent_minor: string;
  alert_threshold_bp: number;
  used_bp: number;
};

export type BusinessIntelligenceRecurring = {
  description: string;
  category_name: string | null;
  category_translations: Record<string, string> | null;
  occurrences: number;
  months_seen: number;
  average_minor: string;
  min_minor: string;
  max_minor: string;
  last_on: string;
  cadence_days: number;
};

export type BusinessIntelligenceGoal = {
  id: string;
  name: string;
  target_minor: string;
  saved_minor: string;
  currency: string;
  target_date: string | null;
  progress_bp: number;
};

export type BusinessIntelligence = {
  workspace: {
    id: string;
    name: string;
    currency: string;
    timezone: string;
    industry: string | null;
    businessSize: string | null;
  };
  period: { from: string; to: string; days: number };
  previousPeriod: { from: string; to: string };
  coverage: {
    transactionCount: number;
    activeDays: number;
    firstRecordedOn: string | null;
    lastRecordedOn: string | null;
  };
  totals: {
    incomeMinor: string;
    expenseMinor: string;
    netResultMinor: string;
    previousIncomeMinor: string;
    previousExpenseMinor: string;
    previousNetResultMinor: string;
    averageDailyExpenseMinor: string;
    averageWeeklyExpenseMinor: string;
  };
  profitability: {
    costOfGoodsRecorded: boolean;
    costOfGoodsMinor: string;
    previousCostOfGoodsMinor: string;
    grossResultAvailable: boolean;
    grossResultMinor: string | null;
    grossMarginBp: number | null;
    note: string;
  };
  cashFlow: {
    cashBalanceMinor: string;
    netMovementMinor: string;
    openingBalanceMinor: string;
  };
  dailySeries: BusinessIntelligenceSeriesPoint[];
  weeklySeries: BusinessIntelligenceWeeklyPoint[];
  monthlySeries: BusinessIntelligenceMonthlyPoint[];
  expenseCategories: BusinessIntelligenceCategory[];
  incomeCategories: BusinessIntelligenceCategory[];
  categoryWeekComparisons: Array<{
    id: string;
    name: string;
    translations: Record<string, string> | null;
    current_minor: string;
    previous_minor: string;
  }>;
  topCustomers: BusinessIntelligenceCustomer[];
  revenueConcentration: {
    attributedIncomeMinor: string;
    unattributedIncomeMinor: string;
    topCustomerMinor: string;
    topCustomerShareBp: number;
    topFiveShareBp: number;
  };
  debts: {
    receivableMinor: string;
    payableMinor: string;
    overdueReceivableMinor: string;
    overduePayableMinor: string;
    openCount: number;
    aging: Array<{
      direction: "receivable" | "payable";
      bucket: "not_due" | "days_1_30" | "days_31_60" | "days_61_plus";
      total_minor: string;
      debt_count: number;
    }>;
    topOpen: BusinessIntelligenceDebt[];
  };
  budgets: BusinessIntelligenceBudget[];
  recurringExpenses: BusinessIntelligenceRecurring[];
  goals: BusinessIntelligenceGoal[];
};

export type AdvisorInsightKind = "fact" | "suggestion";

export type AdvisorSeverity = "positive" | "info" | "warning" | "critical";

export type AdvisorInsightCode =
  | "expense_increase_week"
  | "expense_decrease_week"
  | "top_expense_category"
  | "revenue_increase"
  | "revenue_decrease"
  | "net_result_positive"
  | "net_result_negative"
  | "receivables_outstanding"
  | "overdue_receivables"
  | "payables_outstanding"
  | "budget_over"
  | "budget_near"
  | "recurring_expense"
  | "revenue_concentration"
  | "cost_data_missing"
  | "gross_result_recorded"
  | "cash_balance"
  | "goal_progress"
  | "follow_up_receivables"
  | "review_category"
  | "review_recurring"
  | "diversify_revenue"
  | "record_cost_data"
  | "review_budget"
  | "protect_cash"
  | "review_payables";

export type AdvisorEvidenceKey =
  | "current"
  | "previous"
  | "outstanding"
  | "overdue"
  | "limit"
  | "spent"
  | "cash"
  | "average"
  | "target"
  | "saved"
  | "net"
  | "income"
  | "expense"
  | "cost";

export type AdvisorEvidence = {
  key: AdvisorEvidenceKey;
  amountMinor: string;
  date?: string;
};

export type AdvisorInsight = {
  id: string;
  code: AdvisorInsightCode;
  kind: AdvisorInsightKind;
  severity: AdvisorSeverity;
  params: Record<string, string | number>;
  period?: { from: string; to: string };
  evidence: AdvisorEvidence[];
};

export type AdvisorBrief = {
  period: { from: string; to: string };
  previousPeriod: { from: string; to: string };
  focus: AdvisorFocus;
  facts: AdvisorInsight[];
  suggestions: AdvisorInsight[];
  coverage: BusinessIntelligence["coverage"];
};
