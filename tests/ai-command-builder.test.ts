import { describe, expect, it } from "vitest";
import {
  buildDebtDraft,
  buildDebtPaymentDraft,
  buildTransactionsDraft,
  type AiReferenceData,
} from "@/lib/ai/command-builder";
import type { AccountRow, CategoryRow, ContactRow, DebtRow, WorkspaceRow } from "@/types/database";

const now = "2026-11-26T10:00:00.000Z";

const workspace = {
  id: "ws-1",
  name: "Nkeng Fresh Foods",
  legal_name: null,
  slug: "nkeng",
  owner_id: "user-1",
  currency: "XAF",
  timezone: "Africa/Douala",
  locale: "en",
  country_code: "CM",
  city: "Limbe",
  phone: null,
  business_type: null,
  industry: null,
  business_size: null,
  fiscal_year_start_month: 1,
  logo_url: null,
  logo_path: null,
  plan: "growth",
  settings: {},
  created_at: now,
  updated_at: now,
} satisfies WorkspaceRow;

const category = (id: string, name: string, kind: "income" | "expense", translations: Record<string, string> = {}): CategoryRow => ({
  id,
  workspace_id: workspace.id,
  name,
  kind,
  color: "#000000",
  icon: null,
  translations,
  is_system: true,
  is_archived: false,
  created_at: now,
  updated_at: now,
});

const categories = [
  category("cat-sales", "Sales", "income", { fr: "Ventes", pcm: "Sale" }),
  category("cat-other-income", "Other income", "income"),
  category("cat-transport", "Transport", "expense", { fr: "Transport", pcm: "Transport" }),
  category("cat-food", "Food", "expense", { fr: "Nourriture", pcm: "Food" }),
  category("cat-water", "Water", "expense", { fr: "Eau", pcm: "Water" }),
  category("cat-utilities", "Utilities", "expense", { fr: "Électricité et eau" }),
  category("cat-other-expense", "Other expenses", "expense"),
];

const account = (id: string, name: string, subtype: "cash" | "bank" | "mobile_money"): AccountRow => ({
  id,
  workspace_id: workspace.id,
  name,
  type: "asset",
  subtype,
  institution: null,
  masked_number: null,
  opening_balance_minor: 0,
  currency: "XAF",
  is_system: true,
  is_archived: false,
  created_at: now,
  updated_at: now,
});

const accounts = [account("acct-cash", "Cash", "cash"), account("acct-momo", "Mobile money", "mobile_money"), account("acct-bank", "Bank", "bank")];

const contact = (id: string, name: string, kind: "customer" | "supplier" | "both"): ContactRow => ({
  id,
  workspace_id: workspace.id,
  kind,
  name,
  phone: null,
  email: null,
  address: null,
  tax_id: null,
  notes: null,
  is_archived: false,
  created_by: null,
  created_at: now,
  updated_at: now,
});

const contacts = [contact("contact-john", "John Nkeng", "customer"), contact("contact-supplier", "Mbonde Supplies", "supplier")];

const debt = (id: string, contactId: string, description: string, principal: number, paid: number): DebtRow => ({
  id,
  workspace_id: workspace.id,
  direction: "receivable",
  contact_id: contactId,
  description,
  principal_minor: principal,
  paid_minor: paid,
  currency: "XAF",
  opened_on: "2026-11-20",
  due_on: null,
  status: paid > 0 ? "partially_paid" : "open",
  invoice_id: null,
  transaction_id: null,
  notes: null,
  closed_at: null,
  created_by: null,
  created_at: now,
  updated_at: now,
});

function reference(overrides: Partial<AiReferenceData> = {}): AiReferenceData {
  return {
    workspace,
    today: "2026-11-26",
    categories,
    accounts,
    contacts,
    debts: [debt("debt-1", "contact-john", "Thursday stock", 10000, 3000)],
    settings: { autoPost: false, autoPostMaxMinor: 5000n },
    ...overrides,
  };
}

describe("AI transaction interpretation", () => {
  it("builds three reviewable expenses from one informal message", () => {
    const result = buildTransactionsDraft(
      [
        { kind: "expense", amount: "500", description: "Transport", category: "Transport", payment_method: null, occurred_on: null, contact: null, account: null, counter_account: null },
        { kind: "expense", amount: "1000", description: "Food", category: "Food", payment_method: null, occurred_on: null, contact: null, account: null, counter_account: null },
        { kind: "expense", amount: "200", description: "Water", category: "Water", payment_method: null, occurred_on: null, contact: null, account: null, counter_account: null },
      ],
      reference(),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.draft.preview.actions).toHaveLength(3);
    expect(result.draft.preview.actions.map((action) => action.type === "transaction" ? action.categoryName : null)).toEqual([
      "Transport",
      "Food",
      "Water",
    ]);
    expect(result.draft.preview.actions.map((action) => action.amountMinor)).toEqual(["500", "1000", "200"]);
    expect(result.draft.preview.actions.every((action) => action.type === "transaction" && action.occurredOn === "2026-11-26")).toBe(true);
  });

  it("only marks a clear, explicitly funded, small entry as auto-post eligible", () => {
    const base = {
      kind: "expense" as const,
      amount: "500",
      description: "Transport",
      category: "Transport",
      payment_method: null,
      occurred_on: null,
      contact: null,
      counter_account: null,
    };
    const withoutAccount = buildTransactionsDraft([{ ...base, account: null }], reference());
    const withAccount = buildTransactionsDraft([{ ...base, account: "Cash" }], reference({ settings: { autoPost: true, autoPostMaxMinor: 5000n } }));
    const overLimit = buildTransactionsDraft([{ ...base, amount: "6000", account: "Cash" }], reference({ settings: { autoPost: true, autoPostMaxMinor: 5000n } }));

    expect(withoutAccount.ok && withoutAccount.draft.preview.autoPostEligible).toBe(false);
    expect(withAccount.ok && withAccount.draft.preview.autoPostEligible).toBe(true);
    expect(overLimit.ok && overLimit.draft.preview.autoPostEligible).toBe(false);
  });

  it("matches a French category alias", () => {
    const result = buildTransactionsDraft(
      [{ kind: "expense", amount: "1000", description: "Déjeuner", category: "Nourriture", payment_method: null, occurred_on: null, contact: null, account: "Cash", counter_account: null }],
      reference(),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const action = result.draft.preview.actions[0];
    expect(action.type === "transaction" ? action.categoryId : null).toBe("cat-food");
  });

  it("asks for a category instead of inventing one", () => {
    const result = buildTransactionsDraft(
      [{ kind: "expense", amount: "500", description: "Parking", category: null, payment_method: null, occurred_on: null, contact: null, account: "Cash", counter_account: null }],
      reference(),
    );
    expect(result).toEqual({ ok: false, clarification: { code: "category", subject: "Parking" } });
  });

  it("asks for a valid date instead of guessing", () => {
    const result = buildTransactionsDraft(
      [{ kind: "expense", amount: "500", description: "Transport", category: "Transport", payment_method: null, occurred_on: "next week", contact: null, account: "Cash", counter_account: null }],
      reference(),
    );
    expect(result).toEqual({ ok: false, clarification: { code: "date", subject: "Transport" } });
  });

  it("asks for an unknown contact instead of dropping it", () => {
    const result = buildTransactionsDraft(
      [{ kind: "income", amount: "10000", description: "Sale", category: "Sales", payment_method: null, occurred_on: null, contact: "Unknown Customer", account: "Cash", counter_account: null }],
      reference(),
    );
    expect(result).toEqual({ ok: false, clarification: { code: "contact", subject: "Unknown Customer" } });
  });

  it("supports transfers with two different accounts", () => {
    const result = buildTransactionsDraft(
      [{ kind: "transfer", amount: "5000", description: "Move to bank", category: null, payment_method: null, occurred_on: null, contact: null, account: "Cash", counter_account: "Bank" }],
      reference(),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const action = result.draft.preview.actions[0];
    expect(action.type === "transaction" ? action.counterAccountName : null).toBe("Bank");
    expect(result.draft.preview.autoPostEligible).toBe(false);
  });

  it("does not auto-post an Other expenses catch-all", () => {
    const result = buildTransactionsDraft(
      [{ kind: "expense", amount: "500", description: "Misc", category: "Other expenses", payment_method: null, occurred_on: null, contact: null, account: "Cash", counter_account: null }],
      reference({ settings: { autoPost: true, autoPostMaxMinor: 5000n } }),
    );
    expect(result.ok && result.draft.preview.autoPostEligible).toBe(false);
  });
});

describe("AI debt interpretation", () => {
  it("prepares a receivable for a named customer", () => {
    const result = buildDebtDraft(
      { direction: "receivable", contact: "John", description: "Outstanding balance", amount: "5000", opened_on: null, due_on: null, notes: null },
      reference(),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.draft.preview.actions[0]).toMatchObject({ type: "debt", contactName: "John Nkeng", amountMinor: "5000" });
  });

  it("resolves a repayment to the one open debt", () => {
    const result = buildDebtPaymentDraft(
      { direction: "receivable", contact: "John", amount: "2000", paid_on: null, account: "Cash", payment_method: null, debt_description: null },
      reference(),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.draft.preview.actions[0]).toMatchObject({ type: "debt_payment", debtId: "debt-1", amountMinor: "2000" });
    expect(result.draft.preview.autoPostEligible).toBe(false);
  });

  it("asks when the repayment is larger than the debt", () => {
    const result = buildDebtPaymentDraft(
      { direction: "receivable", contact: "John", amount: "8000", paid_on: null, account: "Cash", payment_method: null, debt_description: null },
      reference(),
    );
    expect(result).toEqual({ ok: false, clarification: { code: "debt_amount", subject: "John Nkeng" } });
  });

  it("asks when several debts match", () => {
    const result = buildDebtPaymentDraft(
      { direction: "receivable", contact: "John", amount: "1000", paid_on: null, account: "Cash", payment_method: null, debt_description: null },
      reference({
        debts: [
          debt("debt-1", "contact-john", "Thursday stock", 10000, 0),
          debt("debt-2", "contact-john", "Friday stock", 10000, 0),
        ],
      }),
    );
    expect(result).toEqual({ ok: false, clarification: { code: "debt", subject: "John Nkeng" } });
  });
});
