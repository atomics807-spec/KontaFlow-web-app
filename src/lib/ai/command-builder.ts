import { parseMoneyToMinor } from "@/lib/money";
import { addDays } from "@/lib/dates";
import type {
  AccountRow,
  CategoryRow,
  ContactRow,
  DebtRow,
  PaymentMethod,
  WorkspaceRow,
} from "@/types/database";
import type { AdvisorFocus } from "@/types/ai-advisor";
import type {
  AiCommandAction,
  AiCommandDraft,
  AiDebtPaymentProposal,
  AiDebtProposal,
  AiTransactionProposal,
  Clarification,
} from "./types";

export type AiSettings = {
  autoPost: boolean;
  autoPostMaxMinor: bigint;
  insightsEnabled: boolean;
  analysisWindowDays: number;
  advisorFocus: AdvisorFocus;
  advisorNote: string | null;
};

export type AiReferenceData = {
  workspace: WorkspaceRow;
  today: string;
  categories: CategoryRow[];
  accounts: AccountRow[];
  contacts: ContactRow[];
  debts: DebtRow[];
  settings: AiSettings;
};

export type BuildResult =
  | { ok: true; draft: AiCommandDraft }
  | { ok: false; clarification: Clarification };

const MAX_AMOUNT_MINOR = 1_000_000_000_000n;

function normalise(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase();
}

function clarify(code: Clarification["code"], subject: string): BuildResult {
  return { ok: false, clarification: { code, subject } };
}

function validIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function resolveDate(raw: string | null, today: string, subject: string): string | BuildResult {
  if (!raw) return today;
  if (!validIsoDate(raw)) return clarify("date", subject);
  if (raw > addDays(today, 1) || raw < addDays(today, -3650)) return clarify("date", subject);
  return raw;
}

function resolveAmount(raw: string, currency: string, subject: string): bigint | BuildResult {
  try {
    const amount = parseMoneyToMinor(raw, currency);
    if (amount <= 0n || amount > MAX_AMOUNT_MINOR) return clarify("amount", subject);
    return amount;
  } catch {
    return clarify("amount", subject);
  }
}

function matchCategory(categories: CategoryRow[], wanted: string, kind: "income" | "expense"): CategoryRow | null {
  const pool = categories.filter((category) => category.kind === kind && !category.is_archived);
  const target = normalise(wanted);
  if (!target) return null;
  return (
    pool.find((category) => normalise(category.name) === target) ??
    pool.find((category) =>
      Object.values(category.translations ?? {}).some((value) => normalise(value) === target),
    ) ??
    pool.find((category) => {
      const name = normalise(category.name);
      return name.includes(target) || target.includes(name);
    }) ??
    null
  );
}

function matchAccount(accounts: AccountRow[], wanted: string): AccountRow | null {
  const moneyAccounts = accounts.filter(
    (account) =>
      account.type === "asset" &&
      ["cash", "bank", "mobile_money"].includes(account.subtype) &&
      !account.is_archived,
  );
  const target = normalise(wanted);
  if (!target) return null;

  return (
    moneyAccounts.find((account) => normalise(account.name) === target) ??
    moneyAccounts.find((account) => {
      const name = normalise(account.name);
      return name.includes(target) || target.includes(name);
    }) ??
    moneyAccounts.find((account) => {
      if (target.includes("mobile") || target.includes("momo")) return account.subtype === "mobile_money";
      if (target.includes("bank") || target.includes("virement")) return account.subtype === "bank";
      if (target.includes("cash") || target.includes("espece") || target.includes("caisse")) {
        return account.subtype === "cash";
      }
      return false;
    }) ??
    null
  );
}

function defaultAccount(accounts: AccountRow[]): AccountRow | null {
  const moneyAccounts = accounts.filter(
    (account) =>
      account.type === "asset" &&
      ["cash", "bank", "mobile_money"].includes(account.subtype) &&
      !account.is_archived,
  );
  return moneyAccounts.find((account) => account.subtype === "cash") ?? moneyAccounts[0] ?? null;
}

function matchContact(contacts: ContactRow[], wanted: string | null): ContactRow | null {
  if (!wanted?.trim()) return null;
  const target = normalise(wanted);
  const active = contacts.filter((contact) => !contact.is_archived);
  return (
    active.find((contact) => normalise(contact.name) === target) ??
    active.find((contact) => {
      const name = normalise(contact.name);
      return name.includes(target) || target.includes(name);
    }) ??
    null
  );
}

function paymentForAccount(account: AccountRow, requested: PaymentMethod | null): PaymentMethod {
  if (requested) return requested;
  if (account.subtype === "mobile_money") return "mobile_money";
  if (account.subtype === "bank") return "bank_transfer";
  return "cash";
}

function isOtherCategory(category: CategoryRow | null): boolean {
  if (!category) return false;
  const name = normalise(category.name);
  return name === "other expenses" || name === "other income" || name === "autres charges";
}

export function buildTransactionDraft(
  proposal: AiTransactionProposal,
  reference: AiReferenceData,
): BuildResult {
  const description = proposal.description.trim();
  const amount = resolveAmount(proposal.amount, reference.workspace.currency, description || proposal.amount);
  if (typeof amount !== "bigint") return amount;

  if (!description) return clarify("description", proposal.amount);
  const occurredOn = resolveDate(proposal.occurred_on, reference.today, description);
  if (typeof occurredOn !== "string") return occurredOn;

  const category =
    proposal.kind === "transfer"
      ? null
      : matchCategory(reference.categories, proposal.category ?? "", proposal.kind);
  if (proposal.kind !== "transfer" && !category) return clarify("category", description);

  const account = proposal.account
    ? matchAccount(reference.accounts, proposal.account)
    : defaultAccount(reference.accounts);
  if (!account) return clarify("account", description);

  const counterAccount =
    proposal.kind === "transfer"
      ? proposal.counter_account
        ? matchAccount(reference.accounts, proposal.counter_account)
        : null
      : null;
  if (proposal.kind === "transfer" && !counterAccount) return clarify("account", description);
  if (counterAccount && counterAccount.id === account.id) return clarify("account", description);

  const contact = matchContact(reference.contacts, proposal.contact);
  if (proposal.contact?.trim() && !contact) return clarify("contact", proposal.contact);

  const action: AiCommandAction = {
    type: "transaction",
    kind: proposal.kind,
    amountMinor: amount.toString(),
    currency: reference.workspace.currency,
    description,
    categoryId: category?.id ?? null,
    categoryName: category?.name ?? null,
    accountId: account.id,
    accountName: account.name,
    counterAccountId: counterAccount?.id ?? null,
    counterAccountName: counterAccount?.name ?? null,
    contactId: contact?.id ?? null,
    contactName: contact?.name ?? null,
    occurredOn,
    paymentMethod: paymentForAccount(account, proposal.payment_method),
  };

  const explicitAccount = Boolean(proposal.account?.trim());
  const lowRisk =
    (proposal.kind === "income" || proposal.kind === "expense") &&
    explicitAccount &&
    occurredOn === reference.today &&
    !isOtherCategory(category);

  return {
    ok: true,
    draft: {
      preview: {
        version: 1,
        actions: [action],
        warnings: [],
        autoPostEligible: lowRisk && amount <= reference.settings.autoPostMaxMinor,
      },
      interpretation: { version: 1, source: "openai", proposal },
    },
  };
}

export function buildTransactionsDraft(
  transactions: AiTransactionProposal[],
  reference: AiReferenceData,
): BuildResult {
  const actions: AiCommandAction[] = [];
  let autoPostEligible = transactions.length > 0;
  let totalMinor = 0n;

  for (const proposal of transactions) {
    const built = buildTransactionDraft(proposal, reference);
    if (!built.ok) return built;
    const action = built.draft.preview.actions[0];
    if (!action) return clarify("unsupported", proposal.description);
    actions.push(action);
    autoPostEligible =
      autoPostEligible &&
      built.draft.preview.autoPostEligible &&
      action.type === "transaction" &&
      (action.kind === "income" || action.kind === "expense");
    totalMinor += BigInt(action.amountMinor);
  }

  return {
    ok: true,
    draft: {
      preview: {
        version: 1,
        actions,
        warnings: [],
        autoPostEligible: autoPostEligible && totalMinor <= reference.settings.autoPostMaxMinor,
      },
      interpretation: { version: 1, source: "openai", proposal: { transactions } },
    },
  };
}

export function buildDebtDraft(proposal: AiDebtProposal, reference: AiReferenceData): BuildResult {
  const description = proposal.description.trim();
  if (!description) return clarify("description", proposal.contact);

  const contact = matchContact(reference.contacts, proposal.contact);
  if (!contact) return clarify("contact", proposal.contact);

  const amount = resolveAmount(proposal.amount, reference.workspace.currency, description);
  if (typeof amount !== "bigint") return amount;

  const openedOn = resolveDate(proposal.opened_on, reference.today, description);
  if (typeof openedOn !== "string") return openedOn;

  let dueOn: string | null = null;
  if (proposal.due_on) {
    const resolved = resolveDate(proposal.due_on, reference.today, description);
    if (typeof resolved !== "string") return resolved;
    if (resolved < openedOn) return clarify("date", description);
    dueOn = resolved;
  }

  return {
    ok: true,
    draft: {
      preview: {
        version: 1,
        actions: [
          {
            type: "debt",
            direction: proposal.direction,
            contactId: contact.id,
            contactName: contact.name,
            description,
            amountMinor: amount.toString(),
            currency: reference.workspace.currency,
            openedOn,
            dueOn,
            notes: proposal.notes?.trim() || null,
          },
        ],
        warnings: [],
        autoPostEligible: false,
      },
      interpretation: { version: 1, source: "openai", proposal },
    },
  };
}

export function buildDebtPaymentDraft(
  proposal: AiDebtPaymentProposal,
  reference: AiReferenceData,
): BuildResult {
  const contact = matchContact(reference.contacts, proposal.contact);
  if (!contact) return clarify("contact", proposal.contact);

  const amount = resolveAmount(proposal.amount, reference.workspace.currency, contact.name);
  if (typeof amount !== "bigint") return amount;

  const paidOn = resolveDate(proposal.paid_on, reference.today, contact.name);
  if (typeof paidOn !== "string") return paidOn;

  const matches = reference.debts.filter(
    (debt) =>
      debt.contact_id === contact.id &&
      debt.direction === proposal.direction &&
      debt.status !== "settled" &&
      debt.status !== "written_off",
  );
  const hinted = proposal.debt_description?.trim()
    ? matches.filter((debt) => normalise(debt.description).includes(normalise(proposal.debt_description as string)))
    : matches;
  if (hinted.length !== 1) return clarify("debt", contact.name);
  const debt = hinted[0];

  const remaining = BigInt(String(debt.principal_minor)) - BigInt(String(debt.paid_minor));
  if (remaining <= 0n) return clarify("debt", contact.name);
  if (amount > remaining) return clarify("debt_amount", contact.name);

  const account = proposal.account
    ? matchAccount(reference.accounts, proposal.account)
    : defaultAccount(reference.accounts);
  if (!account) return clarify("account", contact.name);

  return {
    ok: true,
    draft: {
      preview: {
        version: 1,
        actions: [
          {
            type: "debt_payment",
            debtId: debt.id,
            debtDescription: debt.description,
            contactId: contact.id,
            contactName: contact.name,
            amountMinor: amount.toString(),
            currency: reference.workspace.currency,
            paidOn,
            accountId: account.id,
            accountName: account.name,
            paymentMethod: paymentForAccount(account, proposal.payment_method),
          },
        ],
        warnings: [],
        autoPostEligible: false,
      },
      interpretation: { version: 1, source: "openai", proposal },
    },
  };
}
