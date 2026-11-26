import "server-only";

import { createClient } from "@/lib/supabase/server";
import { formatMoney, parseMoneyToMinor } from "@/lib/money";
import { todayInZone } from "@/lib/dates";
import { recordTransaction } from "@/services/transactions";
import type { AccountRow, CategoryRow, ContactRow, WorkspaceRow } from "@/types/database";

export type ToolContext = {
  workspace: WorkspaceRow;
  userId: string;
  conversationId: string;
};

type ToolResult = { ok: true; data: unknown } | { ok: false; error: string };

async function loadReferenceData(workspaceId: string) {
  const supabase = await createClient();
  const [accounts, categories, contacts] = await Promise.all([
    supabase.from("accounts").select("*").eq("workspace_id", workspaceId).eq("is_archived", false),
    supabase.from("categories").select("*").eq("workspace_id", workspaceId).eq("is_archived", false),
    supabase.from("contacts").select("*").eq("workspace_id", workspaceId).eq("is_archived", false),
  ]);
  return {
    accounts: (accounts.data ?? []) as AccountRow[],
    categories: (categories.data ?? []) as CategoryRow[],
    contacts: (contacts.data ?? []) as ContactRow[],
  };
}

function money(amountMinor: string | number, currency: string): string {
  return `${formatMoney(BigInt(String(amountMinor)), currency, "fr-CM")} ${currency}`;
}

const norm = (value: string) => value.trim().toLowerCase();

function matchCategory(
  categories: CategoryRow[],
  wanted: string | undefined,
  kind: "income" | "expense",
): CategoryRow | undefined {
  const pool = categories.filter((category) => category.kind === kind);
  if (!wanted) {
    return pool.find((category) => category.is_system) ?? pool[0];
  }
  const target = norm(wanted);
  return (
    pool.find((category) => norm(category.name) === target) ??
    pool.find((category) => Object.values(category.translations ?? {}).some((value) => norm(value) === target)) ??
    pool.find((category) => norm(category.name).includes(target) || target.includes(norm(category.name)))
  );
}

function matchContact(contacts: ContactRow[], wanted: string | undefined): ContactRow | undefined {
  if (!wanted) return undefined;
  const target = norm(wanted);
  return (
    contacts.find((contact) => norm(contact.name) === target) ??
    contacts.find((contact) => norm(contact.name).includes(target) || target.includes(norm(contact.name)))
  );
}

async function overview(context: ToolContext, args: { from?: string; to?: string }): Promise<ToolResult> {
  const supabase = await createClient();
  const tz = context.workspace.timezone;
  const from = args.from ?? `${todayInZone(tz).slice(0, 7)}-01`;
  const to = args.to ?? todayInZone(tz);

  const { data, error } = await supabase.rpc("get_dashboard_summary", {
    p_workspace_id: context.workspace.id,
    p_from: from,
    p_to: to,
  });
  if (error || !data) return { ok: false, error: "Could not read the ledger." };

  const summary = data as {
    totalIncomeMinor: string;
    totalExpenseMinor: string;
    netProfitMinor: string;
    cashBalanceMinor: string;
    topExpenseCategories: { name: string; total: string }[];
  };

  return {
    ok: true,
    data: {
      period: { from, to },
      income: money(summary.totalIncomeMinor, context.workspace.currency),
      expenses: money(summary.totalExpenseMinor, context.workspace.currency),
      netProfit: money(summary.netProfitMinor, context.workspace.currency),
      cashOnHand: money(summary.cashBalanceMinor, context.workspace.currency),
      topExpenseCategories: summary.topExpenseCategories.slice(0, 5).map((row) => ({
        name: row.name,
        total: money(row.total, context.workspace.currency),
      })),
    },
  };
}

async function transactions(
  context: ToolContext,
  args: { kind?: "income" | "expense" | "transfer" | "all"; search?: string; limit?: number },
): Promise<ToolResult> {
  const supabase = await createClient();
  let query = supabase
    .from("v_transactions")
    .select("id, kind, status, occurred_on, description, amount_minor, currency, category_name, contact_name")
    .eq("workspace_id", context.workspace.id)
    .order("occurred_on", { ascending: false })
    .limit(Math.min(Math.max(args.limit ?? 10, 1), 30));

  if (args.kind && args.kind !== "all") query = query.eq("kind", args.kind);
  if (args.search) query = query.ilike("description", `%${args.search.replace(/[%_]/g, " ")}%`);

  const { data, error } = await query;
  if (error) return { ok: false, error: "Could not read transactions." };

  return {
    ok: true,
    data: (data ?? []).map((row) => ({
      date: row.occurred_on,
      type: row.kind,
      status: row.status,
      description: row.description,
      amount: money(String(row.amount_minor), row.currency),
      category: row.category_name,
      contact: row.contact_name,
    })),
  };
}

async function record(
  context: ToolContext,
  args: {
    kind: "income" | "expense";
    amount: string;
    description: string;
    category?: string;
    payment_method?: string;
    occurred_on?: string;
    contact?: string;
    account?: string;
  },
): Promise<ToolResult> {
  const { accounts, categories, contacts } = await loadReferenceData(context.workspace.id);
  const currency = context.workspace.currency;

  let amountMinor: bigint;
  try {
    amountMinor = parseMoneyToMinor(args.amount, currency);
  } catch {
    return { ok: false, error: "The amount is not a valid number. Ask the user to repeat it, for example 15 000." };
  }
  if (amountMinor <= 0n) return { ok: false, error: "The amount must be greater than zero." };

  const category = matchCategory(categories, args.category, args.kind);
  if (!category) return { ok: false, error: `No ${args.kind} category is configured for this business.` };

  const moneyAccounts = accounts.filter((account) => ["cash", "bank", "mobile_money"].includes(account.subtype));
  const account =
    (args.account &&
      moneyAccounts.find((candidate) => norm(candidate.name).includes(norm(args.account as string)))) ||
    moneyAccounts.find((candidate) => candidate.subtype === "cash") ||
    moneyAccounts[0];
  if (!account) return { ok: false, error: "No cash or bank account is configured for this business." };

  const paymentMethod = ["cash", "mobile_money", "bank_transfer", "card", "cheque", "other"].includes(
    args.payment_method ?? "",
  )
    ? (args.payment_method as "cash" | "mobile_money" | "bank_transfer" | "card" | "cheque" | "other")
    : account.subtype === "mobile_money"
      ? "mobile_money"
      : "cash";

  const contact = matchContact(contacts, args.contact);

  try {
    const created = await recordTransaction(
      context.workspace.id,
      currency,
      {
        kind: args.kind,
        amount: args.amount,
        description: args.description.slice(0, 500),
        occurredOn: args.occurred_on ?? todayInZone(context.workspace.timezone),
        categoryId: category.id,
        accountId: account.id,
        contactId: contact?.id ?? null,
        paymentMethod,
        reference: null,
        clientGeneratedId: `ai-${context.conversationId}-${Date.now()}`,
      },
      { channel: "ai" },
    );

    return {
      ok: true,
      data: {
        recorded: true,
        duplicate: created.duplicate,
        type: args.kind,
        amount: money(amountMinor.toString(), currency),
        description: args.description,
        category: category.name,
        account: account.name,
        contact: contact?.name ?? null,
        date: args.occurred_on ?? todayInZone(context.workspace.timezone),
      },
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error && typeof error === "object" && "publicMessage" in error
          ? String((error as { publicMessage: string }).publicMessage)
          : "The transaction could not be recorded.",
    };
  }
}

async function contactsTool(context: ToolContext, args: { limit?: number }): Promise<ToolResult> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contacts")
    .select("name, kind, phone, email")
    .eq("workspace_id", context.workspace.id)
    .eq("is_archived", false)
    .limit(Math.min(Math.max(args.limit ?? 10, 1), 50));
  if (error) return { ok: false, error: "Could not read contacts." };
  return { ok: true, data: data ?? [] };
}

export const TOOL_DEFINITIONS = [
  {
    type: "function" as const,
    function: {
      name: "get_overview",
      description:
        "Totals for a date range from this business's ledger: income, expenses, net profit, cash on hand and top expense categories.",
      strict: true,
      parameters: {
        type: "object",
        properties: {
          from: { type: ["string", "null"], description: "Start date YYYY-MM-DD, null for first day of this month." },
          to: { type: ["string", "null"], description: "End date YYYY-MM-DD, null for today." },
        },
        required: ["from", "to"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "list_transactions",
      description: "Recent transactions, newest first, optionally filtered by type or description keyword.",
      strict: true,
      parameters: {
        type: "object",
        properties: {
          kind: { type: "string", enum: ["income", "expense", "transfer", "all"] },
          search: { type: ["string", "null"] },
          limit: { type: ["integer", "null"], description: "1 to 30, default 10." },
        },
        required: ["kind", "search", "limit"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "record_transaction",
      description:
        "Record an income or expense in the ledger. Only call after the user has stated what the money was for and how much. Amount is in major units, e.g. '15000'.",
      strict: true,
      parameters: {
        type: "object",
        properties: {
          kind: { type: "string", enum: ["income", "expense"] },
          amount: { type: "string", description: "Amount in major currency units, digits only." },
          description: { type: "string", description: "Short description of the transaction." },
          category: { type: ["string", "null"], description: "Category name as spoken by the user." },
          payment_method: {
            type: ["string", "null"],
            enum: ["cash", "mobile_money", "bank_transfer", "card", "cheque", "other", null],
          },
          occurred_on: { type: ["string", "null"], description: "YYYY-MM-DD, null for today." },
          contact: { type: ["string", "null"], description: "Customer or supplier name if mentioned." },
          account: { type: ["string", "null"], description: "Cash, mobile money or bank account name if mentioned." },
        },
        required: ["kind", "amount", "description", "category", "payment_method", "occurred_on", "contact", "account"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "list_contacts",
      description: "Customers and suppliers of this business.",
      strict: true,
      parameters: {
        type: "object",
        properties: { limit: { type: ["integer", "null"] } },
        required: ["limit"],
        additionalProperties: false,
      },
    },
  },
];

export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  context: ToolContext,
): Promise<ToolResult> {
  switch (name) {
    case "get_overview":
      return overview(context, args as { from?: string; to?: string });
    case "list_transactions":
      return transactions(
        context,
        args as { kind?: "income" | "expense" | "transfer" | "all"; search?: string; limit?: number },
      );
    case "record_transaction":
      return record(
        context,
        args as {
          kind: "income" | "expense";
          amount: string;
          description: string;
          category?: string;
          payment_method?: string;
          occurred_on?: string;
          contact?: string;
          account?: string;
        },
      );
    case "list_contacts":
      return contactsTool(context, args as { limit?: number });
    default:
      return { ok: false, error: `Unknown tool: ${name}` };
  }
}
