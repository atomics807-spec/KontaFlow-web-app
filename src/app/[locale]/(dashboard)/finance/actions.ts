"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getWorkspaceContext } from "@/lib/supabase/auth";
import { can } from "@/lib/permissions";
import { resolveLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/server";
import { isAppError } from "@/lib/errors";
import { fieldErrorsFrom, formError, formSuccess, type FormState } from "@/lib/action-utils";
import {
  accountSchema,
  budgetSchema,
  debtPaymentSchema,
  debtSchema,
  goalProgressSchema,
  goalSchema,
  invoiceSchema,
} from "@/lib/validation/schemas";
import { parseMoneyToMinor } from "@/lib/money";
import {
  archiveBudget,
  createAccount,
  createBudget,
  createDebt,
  createGoal,
  createInvoice,
  issueInvoice,
  recordDebtPayment,
  setAccountArchived,
  setGoalSaved,
  voidInvoice,
} from "@/services/finance";

function revalidateFinance(locale: string): void {
  revalidatePath(`/${locale}/dashboard`);
  revalidatePath(`/${locale}/accounts`);
  revalidatePath(`/${locale}/debts`);
  revalidatePath(`/${locale}/budgets`);
  revalidatePath(`/${locale}/invoices`);
}

export async function createAccountAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const locale = resolveLocale(String(formData.get("locale") ?? "en"));
  const dict = await getDictionary(locale);
  const context = await getWorkspaceContext();
  if (!context) return formError(dict.errors.unauthorized);
  if (!can(context.role, "accounts:manage")) return formError(dict.errors.forbidden);

  const parsed = accountSchema.safeParse({
    name: formData.get("name"),
    subtype: formData.get("subtype") ?? "cash",
    institution: formData.get("institution") ?? "",
    openingBalance: formData.get("openingBalance") ?? "",
  });
  if (!parsed.success) return formError(dict.errors.generic, fieldErrorsFrom(parsed.error));

  try {
    await createAccount(context.workspace.id, parsed.data, context.workspace.currency);
  } catch (error) {
    return formError(isAppError(error) ? error.publicMessage : dict.errors.generic);
  }
  revalidateFinance(locale);
  return formSuccess(dict.finance.accounts.created);
}

export async function archiveAccountAction(formData: FormData): Promise<void> {
  const locale = resolveLocale(String(formData.get("locale") ?? "en"));
  const context = await getWorkspaceContext();
  if (!context || !can(context.role, "accounts:manage")) return;
  const accountId = String(formData.get("accountId") ?? "");
  const archived = String(formData.get("archived") ?? "true") !== "false";
  if (!accountId) return;
  await setAccountArchived(context.workspace.id, accountId, archived);
  revalidateFinance(locale);
}

export async function createDebtAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const locale = resolveLocale(String(formData.get("locale") ?? "en"));
  const dict = await getDictionary(locale);
  const context = await getWorkspaceContext();
  if (!context) return formError(dict.errors.unauthorized);
  if (!can(context.role, "debts:manage")) return formError(dict.errors.forbidden);

  const parsed = debtSchema.safeParse({
    direction: formData.get("direction") ?? "receivable",
    contactId: formData.get("contactId"),
    description: formData.get("description"),
    principal: formData.get("principal"),
    openedOn: formData.get("openedOn"),
    dueOn: formData.get("dueOn") ?? "",
    notes: formData.get("notes") ?? "",
  });
  if (!parsed.success) return formError(dict.errors.generic, fieldErrorsFrom(parsed.error));

  try {
    await createDebt(context.workspace.id, context.user.id, context.workspace.currency, {
      direction: parsed.data.direction,
      contactId: parsed.data.contactId,
      description: parsed.data.description,
      principal: parsed.data.principal,
      openedOn: parsed.data.openedOn,
      dueOn: parsed.data.dueOn,
      notes: parsed.data.notes || undefined,
    });
  } catch (error) {
    return formError(isAppError(error) ? error.publicMessage : dict.errors.generic);
  }
  revalidateFinance(locale);
  return formSuccess(dict.finance.debts.created);
}

export async function recordDebtPaymentAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const locale = resolveLocale(String(formData.get("locale") ?? "en"));
  const dict = await getDictionary(locale);
  const context = await getWorkspaceContext();
  if (!context) return formError(dict.errors.unauthorized);
  if (!can(context.role, "debts:manage")) return formError(dict.errors.forbidden);

  const parsed = debtPaymentSchema.safeParse({
    debtId: formData.get("debtId"),
    amount: formData.get("amount"),
    paidOn: formData.get("paidOn"),
    accountId: formData.get("accountId") ?? "",
    paymentMethod: formData.get("paymentMethod") ?? "cash",
    reference: formData.get("reference") ?? "",
    notes: formData.get("notes") ?? "",
  });
  if (!parsed.success) return formError(dict.errors.generic, fieldErrorsFrom(parsed.error));

  try {
    await recordDebtPayment(context.workspace.id, context.user.id, context.workspace.currency, {
      debtId: parsed.data.debtId,
      amount: parsed.data.amount,
      paidOn: parsed.data.paidOn,
      accountId: parsed.data.accountId,
      paymentMethod: parsed.data.paymentMethod,
      reference: parsed.data.reference || undefined,
      notes: parsed.data.notes || undefined,
    });
  } catch (error) {
    return formError(isAppError(error) ? error.publicMessage : dict.errors.generic);
  }
  revalidateFinance(locale);
  return formSuccess(dict.finance.debts.paymentRecorded);
}

export async function createBudgetAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const locale = resolveLocale(String(formData.get("locale") ?? "en"));
  const dict = await getDictionary(locale);
  const context = await getWorkspaceContext();
  if (!context) return formError(dict.errors.unauthorized);
  if (!can(context.role, "budgets:manage")) return formError(dict.errors.forbidden);

  const parsed = budgetSchema.safeParse({
    name: formData.get("name"),
    categoryId: formData.get("categoryId") ?? "",
    periodStart: formData.get("periodStart"),
    periodEnd: formData.get("periodEnd"),
    amount: formData.get("amount"),
    alertThresholdBp: formData.get("alertThresholdBp") ?? 8000,
  });
  if (!parsed.success) return formError(dict.errors.generic, fieldErrorsFrom(parsed.error));

  try {
    await createBudget(context.workspace.id, context.user.id, context.workspace.currency, {
      name: parsed.data.name,
      categoryId: parsed.data.categoryId,
      periodStart: parsed.data.periodStart,
      periodEnd: parsed.data.periodEnd,
      amount: parsed.data.amount,
      alertThresholdBp: parsed.data.alertThresholdBp,
    });
  } catch (error) {
    return formError(isAppError(error) ? error.publicMessage : dict.errors.generic);
  }
  revalidateFinance(locale);
  return formSuccess(dict.finance.budgets.created);
}

export async function archiveBudgetAction(formData: FormData): Promise<void> {
  const locale = resolveLocale(String(formData.get("locale") ?? "en"));
  const context = await getWorkspaceContext();
  if (!context || !can(context.role, "budgets:manage")) return;
  const budgetId = String(formData.get("budgetId") ?? "");
  if (!budgetId) return;
  await archiveBudget(context.workspace.id, budgetId);
  revalidateFinance(locale);
}

export async function createGoalAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const locale = resolveLocale(String(formData.get("locale") ?? "en"));
  const dict = await getDictionary(locale);
  const context = await getWorkspaceContext();
  if (!context) return formError(dict.errors.unauthorized);
  if (!can(context.role, "budgets:manage")) return formError(dict.errors.forbidden);

  const parsed = goalSchema.safeParse({
    name: formData.get("name"),
    target: formData.get("target"),
    targetDate: formData.get("targetDate") ?? "",
    notes: formData.get("notes") ?? "",
  });
  if (!parsed.success) return formError(dict.errors.generic, fieldErrorsFrom(parsed.error));

  try {
    await createGoal(context.workspace.id, context.user.id, context.workspace.currency, {
      name: parsed.data.name,
      target: parsed.data.target,
      targetDate: parsed.data.targetDate,
      notes: parsed.data.notes || undefined,
    });
  } catch (error) {
    return formError(isAppError(error) ? error.publicMessage : dict.errors.generic);
  }
  revalidateFinance(locale);
  return formSuccess(dict.finance.goals.created);
}

export async function updateGoalAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const locale = resolveLocale(String(formData.get("locale") ?? "en"));
  const dict = await getDictionary(locale);
  const context = await getWorkspaceContext();
  if (!context) return formError(dict.errors.unauthorized);
  if (!can(context.role, "budgets:manage")) return formError(dict.errors.forbidden);

  const parsed = goalProgressSchema.safeParse({
    goalId: formData.get("goalId"),
    saved: formData.get("saved"),
  });
  if (!parsed.success) return formError(dict.errors.generic, fieldErrorsFrom(parsed.error));

  try {
    const saved = parseMoneyToMinor(parsed.data.saved, context.workspace.currency);
    await setGoalSaved(context.workspace.id, parsed.data.goalId, saved);
  } catch (error) {
    return formError(isAppError(error) ? error.publicMessage : dict.errors.generic);
  }
  revalidateFinance(locale);
  return formSuccess(dict.finance.goals.updated);
}

export async function createInvoiceAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const locale = resolveLocale(String(formData.get("locale") ?? "en"));
  const dict = await getDictionary(locale);
  const context = await getWorkspaceContext();
  if (!context) return formError(dict.errors.unauthorized);
  if (!can(context.role, "invoices:manage")) return formError(dict.errors.forbidden);

  let items: unknown = [];
  try {
    items = JSON.parse(String(formData.get("items") ?? "[]"));
  } catch {
    return formError(dict.errors.generic);
  }

  const parsed = invoiceSchema.safeParse({
    customerId: formData.get("customerId"),
    issueOn: formData.get("issueOn"),
    dueOn: formData.get("dueOn"),
    notes: formData.get("notes") ?? "",
    terms: formData.get("terms") ?? "",
    issue: String(formData.get("intent") ?? "draft") === "issue",
    items,
  });
  if (!parsed.success) return formError(dict.errors.generic, fieldErrorsFrom(parsed.error));

  let invoiceId: string;
  try {
    const created = await createInvoice(context.workspace.id, context.workspace.currency, {
      customerId: parsed.data.customerId,
      issueOn: parsed.data.issueOn,
      dueOn: parsed.data.dueOn,
      notes: parsed.data.notes || undefined,
      terms: parsed.data.terms || undefined,
      issue: parsed.data.issue,
      items: parsed.data.items,
    });
    invoiceId = created.id;
  } catch (error) {
    return formError(isAppError(error) ? error.publicMessage : dict.errors.generic);
  }

  revalidateFinance(locale);
  redirect(`/${locale}/invoices/${invoiceId}`);
}

export async function issueInvoiceAction(formData: FormData): Promise<void> {
  const locale = resolveLocale(String(formData.get("locale") ?? "en"));
  const context = await getWorkspaceContext();
  if (!context || !can(context.role, "invoices:manage")) return;
  const invoiceId = String(formData.get("invoiceId") ?? "");
  if (!invoiceId) return;
  await issueInvoice(invoiceId);
  revalidateFinance(locale);
  revalidatePath(`/${locale}/invoices/${invoiceId}`);
}

export async function voidInvoiceAction(formData: FormData): Promise<void> {
  const locale = resolveLocale(String(formData.get("locale") ?? "en"));
  const context = await getWorkspaceContext();
  if (!context || !can(context.role, "invoices:manage")) return;
  const invoiceId = String(formData.get("invoiceId") ?? "");
  if (!invoiceId) return;
  await voidInvoice(context.workspace.id, invoiceId, String(formData.get("reason") ?? ""));
  revalidateFinance(locale);
  revalidatePath(`/${locale}/invoices/${invoiceId}`);
}
