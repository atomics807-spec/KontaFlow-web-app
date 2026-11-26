import "server-only";

import { AppError } from "@/lib/errors";
import { parseMoneyToMinor, toSafeNumber } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import { assertNoError } from "@/lib/supabase/errors";
import type {
  AccountBalanceRow,
  BudgetProgressRow,
  BudgetRow,
  ContactRow,
  DebtPaymentRow,
  DebtViewRow,
  FinancialGoalRow,
  InvoiceItemRow,
  InvoiceViewRow,
  PaymentMethod,
} from "@/types/database";

export async function listAccountBalances(workspaceId: string): Promise<AccountBalanceRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("v_account_balances")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("is_archived")
    .order("name");

  if (error) throw assertNoError(error, "Could not load accounts.");
  return data ?? [];
}

export async function listMoneyAccounts(workspaceId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("accounts")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("type", "asset")
    .in("subtype", ["cash", "bank", "mobile_money"])
    .eq("is_archived", false)
    .order("name");
  if (error) throw assertNoError(error, "Could not load accounts.");
  return data ?? [];
}

export async function createAccount(
  workspaceId: string,
  input: { name: string; subtype: "cash" | "bank" | "mobile_money"; institution?: string; openingBalance?: string },
  currency: string,
): Promise<void> {
  const supabase = await createClient();
  const opening = !input.openingBalance?.trim() ? 0n : parseMoneyToMinor(input.openingBalance, currency);
  const { error } = await supabase.from("accounts").insert({
    workspace_id: workspaceId,
    name: input.name,
    type: "asset",
    subtype: input.subtype,
    institution: input.institution?.trim() || null,
    opening_balance_minor: toSafeNumber(opening),
    currency,
    is_system: false,
  });
  if (error) throw assertNoError(error, "Could not create the account.");
}

export async function setAccountArchived(workspaceId: string, accountId: string, archived: boolean): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("accounts")
    .update({ is_archived: archived })
    .eq("workspace_id", workspaceId)
    .eq("id", accountId)
    .eq("is_system", false);
  if (error) throw assertNoError(error, "Could not update the account.");
}

export async function listFinanceContacts(workspaceId: string): Promise<ContactRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contacts")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("is_archived", false)
    .order("name");
  if (error) throw assertNoError(error, "Could not load contacts.");
  return data ?? [];
}

export async function listExpenseCategories(workspaceId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("kind", "expense")
    .eq("is_archived", false)
    .order("name");
  if (error) throw assertNoError(error, "Could not load categories.");
  return data ?? [];
}

// ---------------------------------------------------------------------------
// Debts and repayments
// ---------------------------------------------------------------------------

export async function listDebts(
  workspaceId: string,
  filters: { direction?: "receivable" | "payable" | "all"; status?: "open" | "partially_paid" | "settled" | "written_off" | "all"; search?: string } = {},
): Promise<DebtViewRow[]> {
  const supabase = await createClient();
  let query = supabase.from("v_debts").select("*").eq("workspace_id", workspaceId);
  if (filters.direction && filters.direction !== "all") query = query.eq("direction", filters.direction);
  if (filters.status && filters.status !== "all") query = query.eq("status", filters.status);
  if (filters.search) {
    const term = filters.search.replace(/[%,()]/g, " ").trim();
    if (term) query = query.or(`description.ilike.%${term}%,contact_name.ilike.%${term}%,invoice_number.ilike.%${term}%`);
  }
  query = query
    .order("is_overdue", { ascending: false })
    .order("due_on", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(200);

  const { data, error } = await query;
  if (error) throw assertNoError(error, "Could not load debts.");
  return data ?? [];
}

export async function listDebtPayments(workspaceId: string, debtIds: string[]): Promise<DebtPaymentRow[]> {
  if (debtIds.length === 0) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("debt_payments")
    .select("*")
    .eq("workspace_id", workspaceId)
    .in("debt_id", debtIds)
    .order("paid_on", { ascending: false });
  if (error) throw assertNoError(error, "Could not load repayments.");
  return data ?? [];
}

export async function createDebt(
  workspaceId: string,
  userId: string,
  currency: string,
  input: {
    direction: "receivable" | "payable";
    contactId: string;
    description: string;
    principal: string;
    openedOn: string;
    dueOn?: string;
    notes?: string;
  },
): Promise<void> {
  const supabase = await createClient();
  const principal = parseMoneyToMinor(input.principal, currency);
  const { error } = await supabase.from("debts").insert({
    workspace_id: workspaceId,
    direction: input.direction,
    contact_id: input.contactId,
    description: input.description,
    principal_minor: toSafeNumber(principal),
    currency,
    opened_on: input.openedOn,
    due_on: input.dueOn?.trim() || null,
    notes: input.notes?.trim() || null,
    created_by: userId,
  });
  if (error) throw assertNoError(error, "Could not save the debt.");
}

export async function recordDebtPayment(
  workspaceId: string,
  _userId: string,
  currency: string,
  input: {
    debtId: string;
    amount: string;
    paidOn: string;
    accountId?: string;
    paymentMethod: PaymentMethod;
    reference?: string;
    notes?: string;
  },
): Promise<void> {
  const supabase = await createClient();
  const amount = parseMoneyToMinor(input.amount, currency);
  if (amount <= 0n) throw new AppError("validation_failed", "Enter an amount greater than zero.");

  const { error } = await supabase.rpc("record_debt_payment", {
    p_payload: {
      workspace_id: workspaceId,
      debt_id: input.debtId,
      amount_minor: amount.toString(),
      paid_on: input.paidOn,
      account_id: input.accountId || null,
      payment_method: input.paymentMethod,
      reference: input.reference?.trim() || null,
      notes: input.notes?.trim() || null,
    },
  });
  if (error) throw assertNoError(error, "Could not record the repayment.");
}

export async function voidDebtPayment(workspaceId: string, paymentId: string, userId: string, reason?: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("debt_payments")
    .update({ voided_at: new Date().toISOString(), voided_by: userId, void_reason: reason?.trim() || null })
    .eq("workspace_id", workspaceId)
    .eq("id", paymentId)
    .is("voided_at", null);
  if (error) throw assertNoError(error, "Could not void the repayment.");
}

// ---------------------------------------------------------------------------
// Budgets and goals
// ---------------------------------------------------------------------------

export async function listBudgetProgress(workspaceId: string): Promise<BudgetProgressRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("v_budget_progress")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("period_end", { ascending: false });
  if (error) throw assertNoError(error, "Could not load budgets.");
  return data ?? [];
}

export async function createBudget(
  workspaceId: string,
  userId: string,
  currency: string,
  input: {
    name: string;
    categoryId?: string;
    periodStart: string;
    periodEnd: string;
    amount: string;
    alertThresholdBp: number;
  },
): Promise<void> {
  const supabase = await createClient();
  const amount = parseMoneyToMinor(input.amount, currency);
  const { error } = await supabase.from("budgets").insert({
    workspace_id: workspaceId,
    name: input.name,
    category_id: input.categoryId || null,
    period_start: input.periodStart,
    period_end: input.periodEnd,
    amount_minor: toSafeNumber(amount),
    currency,
    alert_threshold_bp: input.alertThresholdBp,
    created_by: userId,
  });
  if (error) throw assertNoError(error, "Could not create the budget.");
}

export async function archiveBudget(workspaceId: string, budgetId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("budgets")
    .update({ archived_at: new Date().toISOString() })
    .eq("workspace_id", workspaceId)
    .eq("id", budgetId);
  if (error) throw assertNoError(error, "Could not archive the budget.");
}

export async function listGoals(workspaceId: string): Promise<FinancialGoalRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("financial_goals")
    .select("*")
    .eq("workspace_id", workspaceId)
    .is("archived_at", null)
    .order("created_at", { ascending: false });
  if (error) throw assertNoError(error, "Could not load goals.");
  return data ?? [];
}

export async function createGoal(
  workspaceId: string,
  userId: string,
  currency: string,
  input: { name: string; target: string; targetDate?: string; notes?: string },
): Promise<void> {
  const supabase = await createClient();
  const target = parseMoneyToMinor(input.target, currency);
  const { error } = await supabase.from("financial_goals").insert({
    workspace_id: workspaceId,
    name: input.name,
    target_minor: toSafeNumber(target),
    currency,
    target_date: input.targetDate?.trim() || null,
    notes: input.notes?.trim() || null,
    created_by: userId,
  });
  if (error) throw assertNoError(error, "Could not create the goal.");
}

export async function setGoalSaved(workspaceId: string, goalId: string, savedMinor: bigint): Promise<void> {
  const supabase = await createClient();
  const { data: goal, error: readError } = await supabase
    .from("financial_goals")
    .select("target_minor")
    .eq("workspace_id", workspaceId)
    .eq("id", goalId)
    .maybeSingle();
  if (readError) throw assertNoError(readError, "Could not load the goal.");
  if (!goal) throw assertNoError({ code: "P0002" }, "Could not find the goal.");

  const achieved = savedMinor >= BigInt(String(goal.target_minor));
  const { error } = await supabase
    .from("financial_goals")
    .update({
      saved_minor: toSafeNumber(savedMinor),
      status: achieved ? "achieved" : "active",
      achieved_at: achieved ? new Date().toISOString() : null,
    })
    .eq("workspace_id", workspaceId)
    .eq("id", goalId);
  if (error) throw assertNoError(error, "Could not update the goal.");
}

// ---------------------------------------------------------------------------
// Invoices
// ---------------------------------------------------------------------------

export async function hasFeature(workspaceId: string, code: string): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("has_workspace_feature", {
    p_workspace_id: workspaceId,
    p_feature_code: code,
  });
  if (error) throw assertNoError(error, "Could not check your plan.");
  return Boolean(data);
}

export async function listInvoices(workspaceId: string): Promise<InvoiceViewRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("v_invoices")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw assertNoError(error, "Could not load invoices.");
  return data ?? [];
}

export async function getInvoice(
  workspaceId: string,
  invoiceId: string,
): Promise<{ invoice: InvoiceViewRow; items: InvoiceItemRow[] } | null> {
  const supabase = await createClient();
  const [invoice, items] = await Promise.all([
    supabase.from("v_invoices").select("*").eq("workspace_id", workspaceId).eq("id", invoiceId).maybeSingle(),
    supabase
      .from("invoice_items")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("invoice_id", invoiceId)
      .order("position"),
  ]);
  if (invoice.error) throw assertNoError(invoice.error, "Could not load the invoice.");
  if (items.error) throw assertNoError(items.error, "Could not load the invoice lines.");
  if (!invoice.data) return null;
  return { invoice: invoice.data, items: items.data ?? [] };
}

export type InvoiceItemInput = {
  description: string;
  quantity: string;
  unitPrice: string;
  taxRateBp: number;
};

export async function createInvoice(
  workspaceId: string,
  currency: string,
  input: {
    customerId: string;
    issueOn: string;
    dueOn: string;
    notes?: string;
    terms?: string;
    issue: boolean;
    items: InvoiceItemInput[];
  },
): Promise<{ id: string; number: string; totalMinor: bigint; status: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_invoice", {
    p_payload: {
      workspace_id: workspaceId,
      customer_id: input.customerId,
      issue_on: input.issueOn,
      due_on: input.dueOn,
      notes: input.notes ?? null,
      terms: input.terms ?? null,
      issue: input.issue,
      currency,
      items: input.items.map((item) => ({
        description: item.description,
        quantity: item.quantity,
        unit_price_minor: parseMoneyToMinor(item.unitPrice, currency).toString(),
        tax_rate_bp: item.taxRateBp,
      })),
    },
  });
  if (error) throw assertNoError(error, "Could not create the invoice.");
  if (!data) throw assertNoError({ code: "P0002" }, "Could not create the invoice.");
  return {
    id: data.id,
    number: data.number,
    totalMinor: BigInt(data.total_minor),
    status: data.status,
  };
}

export async function issueInvoice(invoiceId: string): Promise<void> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("issue_invoice", { p_invoice_id: invoiceId });
  if (error) throw assertNoError(error, "Could not issue the invoice.");
  if (!data || data.id !== invoiceId) throw assertNoError({ code: "P0002" }, "Could not issue the invoice.");
}

export async function voidInvoice(_workspaceId: string, invoiceId: string, reason?: string): Promise<void> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("void_invoice", {
    p_invoice_id: invoiceId,
    p_reason: reason?.trim() || null,
  });
  if (error) throw assertNoError(error, "Could not void the invoice.");
  if (!data || data.id !== invoiceId) throw new AppError("internal_error", "Could not void the invoice.");
}

export type BudgetWithSpend = BudgetProgressRow & { archivedAt: string | null };

export async function getBudgetById(workspaceId: string, budgetId: string): Promise<BudgetRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("budgets")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("id", budgetId)
    .maybeSingle();
  if (error) throw assertNoError(error, "Could not load the budget.");
  return data;
}
