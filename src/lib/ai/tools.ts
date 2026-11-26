import "server-only";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { channelClientId, recordChannelTransaction } from "@/lib/channels";
import { formatMoney, parseMoneyToMinor } from "@/lib/money";
import { todayInZone } from "@/lib/dates";
import { recordTransaction } from "@/services/transactions";
import { analysisBounds, getBusinessIntelligence } from "@/services/business-intelligence";
import type { AccountRow, CategoryRow, ContactRow, WorkspaceRow } from "@/types/database";
import type { AiWorkspacePreferences, BusinessIntelligence } from "@/types/ai-advisor";
import { aiDebtPaymentProposalSchema, aiDebtProposalSchema, aiTransactionsProposalSchema } from "./schemas";
import { buildAdvisorBrief } from "./advisor";
import { buildDebtDraft, buildDebtPaymentDraft, buildTransactionsDraft, type AiReferenceData, type BuildResult } from "./command-builder";
import type { AiCommandDraft, Clarification } from "./types";

export type ToolContext = {
  workspace: WorkspaceRow;
  userId: string;
  conversationId: string;
  /** Stable per inbound message; direct channels use it as the write key. */
  requestId?: string;
  /** Position of this tool call in the model turn, so multiple writes stay distinct. */
  toolCallKey?: string;
  /** WhatsApp/USSD webhooks have no user session and run on the service role. */
  serviceRole?: boolean;
};

function database(context: ToolContext) {
  return context.serviceRole ? createAdminClient() : createClient();
}

type ToolResult = { ok: true; data: unknown } | { ok: false; error: string };

async function loadReferenceData(context: ToolContext) {
  const supabase = await database(context);
  const workspaceId = context.workspace.id;
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
  const supabase = await database(context);
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
  const supabase = await database(context);
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
  const { accounts, categories, contacts } = await loadReferenceData(context);
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
    const occurredOn = args.occurred_on ?? todayInZone(context.workspace.timezone);
    const clientGeneratedId = channelClientId(
      context.serviceRole ? "wa" : "ai",
      `${context.requestId ?? `${context.conversationId}:${Date.now()}`}:${context.toolCallKey ?? "0"}`,
    );
    const created = context.serviceRole
      ? await recordChannelTransaction({
          workspaceId: context.workspace.id,
          actorId: context.userId,
          channel: "ai",
          kind: args.kind,
          amountMinor,
          description: args.description.slice(0, 500),
          occurredOn,
          categoryId: category.id,
          accountId: account.id,
          paymentMethod: paymentMethod === "cheque" || paymentMethod === "card" ? "other" : paymentMethod,
          clientGeneratedId,
        })
      : await recordTransaction(
          context.workspace.id,
          currency,
          {
            kind: args.kind,
            amount: args.amount,
            description: args.description.slice(0, 500),
            occurredOn,
            categoryId: category.id,
            accountId: account.id,
            contactId: contact?.id ?? null,
            paymentMethod,
            reference: null,
            clientGeneratedId,
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
        date: occurredOn,
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
  const supabase = await database(context);
  const { data, error } = await supabase
    .from("contacts")
    .select("name, kind, phone, email")
    .eq("workspace_id", context.workspace.id)
    .eq("is_archived", false)
    .limit(Math.min(Math.max(args.limit ?? 10, 1), 50));
  if (error) return { ok: false, error: "Could not read contacts." };
  return { ok: true, data: data ?? [] };
}

async function businessIntelligence(
  context: InteractiveToolContext,
  args: { from?: string | null; to?: string | null },
): Promise<ToolResult> {
  const preferences: AiWorkspacePreferences = {
    workspaceId: context.workspace.id,
    insightsEnabled: context.reference.settings.insightsEnabled,
    analysisWindowDays: context.reference.settings.analysisWindowDays,
    historyRetentionDays: 90,
    advisorFocus: context.reference.settings.advisorFocus,
    advisorNote: context.reference.settings.advisorNote,
  };
  if (!preferences.insightsEnabled) {
    return {
      ok: false,
      error: "Business intelligence is disabled by the workspace owner. Do not analyse or advise on financial trends.",
    };
  }

  let from = args.from ?? null;
  let to = args.to ?? null;
  if (!from || !to) {
    const bounds = analysisBounds(context.reference.today, preferences.analysisWindowDays);
    from = from ?? bounds.from;
    to = to ?? bounds.to;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return { ok: false, error: "Dates must use YYYY-MM-DD." };
  }

  let intelligence: BusinessIntelligence;
  try {
    intelligence = await getBusinessIntelligence(context.workspace.id, from, to);
  } catch (error) {
    return {
      ok: false,
      error:
        error && typeof error === "object" && "publicMessage" in error
          ? String((error as { publicMessage: string }).publicMessage)
          : "Could not read business intelligence.",
    };
  }

  const brief = buildAdvisorBrief(intelligence, preferences.advisorFocus);
  const currency = context.workspace.currency;
  const formatEvidence = (evidence: { key: string; amountMinor: string; date?: string }) =>
    `${evidence.key}: ${money(evidence.amountMinor, currency)}${evidence.date ? ` (${evidence.date})` : ""}`;

  return {
    ok: true,
    data: {
      period: brief.period,
      previousPeriod: brief.previousPeriod,
      coverage: brief.coverage,
      focus: brief.focus,
      totals: {
        income: money(intelligence.totals.incomeMinor, currency),
        expenses: money(intelligence.totals.expenseMinor, currency),
        netRecordedResult: money(intelligence.totals.netResultMinor, currency),
        previousIncome: money(intelligence.totals.previousIncomeMinor, currency),
        previousExpenses: money(intelligence.totals.previousExpenseMinor, currency),
      },
      profitability: {
        grossResultAvailable: intelligence.profitability.grossResultAvailable,
        grossResult: intelligence.profitability.grossResultMinor
          ? money(intelligence.profitability.grossResultMinor, currency)
          : null,
        stockCostsRecorded: money(intelligence.profitability.costOfGoodsMinor, currency),
        note: "Net recorded result is income minus expenses, not an audited profit figure.",
      },
      cash: {
        cashOnHand: money(intelligence.cashFlow.cashBalanceMinor, currency),
        netMovement: money(intelligence.cashFlow.netMovementMinor, currency),
      },
      debts: {
        owedToBusiness: money(intelligence.debts.receivableMinor, currency),
        overdueFromCustomers: money(intelligence.debts.overdueReceivableMinor, currency),
        owedToSuppliers: money(intelligence.debts.payableMinor, currency),
        overdueToSuppliers: money(intelligence.debts.overduePayableMinor, currency),
      },
      facts: brief.facts.map((item) => ({
        code: item.code,
        params: item.params,
        evidence: item.evidence.map(formatEvidence),
        period: item.period ?? brief.period,
      })),
      suggestions: brief.suggestions.map((item) => ({
        code: item.code,
        params: item.params,
        evidence: item.evidence.map(formatEvidence),
        period: item.period ?? brief.period,
      })),
      instruction:
        "Use facts as recorded. Present suggestions as options. Include the period and figures behind important claims.",
    },
  };
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

// ---------------------------------------------------------------------------
// Interactive bookkeeping: read tools stay read-only; write intents become
// reviewable drafts. The model never gets a SQL or unrestricted database tool.
// ---------------------------------------------------------------------------

export type InteractiveToolContext = ToolContext & {
  requestId: string;
  locale: string;
  reference: AiReferenceData;
  draft: AiCommandDraft | null;
  clarification: Clarification | null;
};

const nullableString = (description: string) => ({
  type: ["string", "null"] as const,
  description,
});

const PROPOSAL_TOOL_DEFINITIONS = [
  {
    type: "function" as const,
    function: {
      name: "propose_transactions",
      description:
        "Prepare one or more income, expense or transfer entries for review. Never call this with a missing or guessed amount, date, category or contact.",
      strict: true,
      parameters: {
        type: "object",
        properties: {
          transactions: {
            type: "array",
            minItems: 1,
            maxItems: 10,
            items: {
              type: "object",
              properties: {
                kind: { type: "string", enum: ["income", "expense", "transfer"] },
                amount: { type: "string", description: "Major units, digits and optional decimal point." },
                description: { type: "string", description: "Short description of what the money was for." },
                category: nullableString("Exact category name from the supplied list, or null."),
                payment_method: {
                  type: ["string", "null"],
                  enum: ["cash", "mobile_money", "bank_transfer", "card", "cheque", "other", null],
                },
                occurred_on: nullableString("YYYY-MM-DD, or null for today."),
                contact: nullableString("Customer or supplier name, or null."),
                account: nullableString("Cash, mobile money or bank account name, or null."),
                counter_account: nullableString("Destination account for a transfer, or null."),
              },
              required: [
                "kind",
                "amount",
                "description",
                "category",
                "payment_method",
                "occurred_on",
                "contact",
                "account",
                "counter_account",
              ],
              additionalProperties: false,
            },
          },
        },
        required: ["transactions"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "propose_debt",
      description:
        "Prepare a new receivable or payable for review. Use only when the contact, direction and amount are clear.",
      strict: true,
      parameters: {
        type: "object",
        properties: {
          direction: { type: "string", enum: ["receivable", "payable"] },
          contact: { type: "string", description: "Customer or supplier name as spoken by the user." },
          description: { type: "string", description: "What the debt is for." },
          amount: { type: "string", description: "Major units, digits only." },
          opened_on: nullableString("YYYY-MM-DD, or null for today."),
          due_on: nullableString("YYYY-MM-DD, or null."),
          notes: nullableString("Optional note."),
        },
        required: ["direction", "contact", "description", "amount", "opened_on", "due_on", "notes"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "propose_debt_payment",
      description:
        "Prepare a repayment against one existing open debt for review. Use only when the contact and direction are clear.",
      strict: true,
      parameters: {
        type: "object",
        properties: {
          direction: { type: "string", enum: ["receivable", "payable"] },
          contact: { type: "string", description: "Customer or supplier name." },
          amount: { type: "string", description: "Major units, digits only." },
          paid_on: nullableString("YYYY-MM-DD, or null for today."),
          account: nullableString("Cash, mobile money or bank account name, or null."),
          payment_method: {
            type: ["string", "null"],
            enum: ["cash", "mobile_money", "bank_transfer", "card", "cheque", "other", null],
          },
          debt_description: nullableString("Words from the debt description to disambiguate, or null."),
        },
        required: ["direction", "contact", "amount", "paid_on", "account", "payment_method", "debt_description"],
        additionalProperties: false,
      },
    },
  },
];

const ANALYSIS_TOOL_DEFINITIONS = [
  {
    type: "function" as const,
    function: {
      name: "analyze_business",
      description:
        "Read-only, tenant-scoped analysis of recorded income, expenses, cash flow, categories, weekly changes, debts, budgets, recurring costs and revenue concentration. Always call this before giving financial advice, trend, cash-flow, debt or profitability answers. Use null dates for the owner's configured analysis window.",
      strict: true,
      parameters: {
        type: "object",
        properties: {
          from: nullableString("YYYY-MM-DD start date, or null for the configured window."),
          to: nullableString("YYYY-MM-DD end date, or null for today."),
        },
        required: ["from", "to"],
        additionalProperties: false,
      },
    },
  },
];

export const INTERACTIVE_TOOL_DEFINITIONS = [
  ...TOOL_DEFINITIONS.filter((tool) =>
    ["get_overview", "list_transactions", "list_contacts"].includes(tool.function.name),
  ),
  ...ANALYSIS_TOOL_DEFINITIONS,
  ...PROPOSAL_TOOL_DEFINITIONS,
];

function setProposal(
  context: InteractiveToolContext,
  build: BuildResult,
): ToolResult {
  if (!build.ok) {
    context.clarification = build.clarification;
    return { ok: false, error: "More information is needed before this can be drafted." };
  }
  if (context.draft) {
    return { ok: false, error: "A draft already exists for this message." };
  }
  context.draft = build.draft;
  return {
    ok: true,
    data: {
      prepared: build.draft.preview.actions.length,
      actions: build.draft.preview.actions.map((action) => {
        if (action.type === "transaction") {
          return {
            type: action.type,
            kind: action.kind,
            amount_minor: action.amountMinor,
            currency: action.currency,
            category: action.categoryName,
            date: action.occurredOn,
            account: action.accountName,
          };
        }
        if (action.type === "debt") {
          return {
            type: action.type,
            direction: action.direction,
            contact: action.contactName,
            amount_minor: action.amountMinor,
            currency: action.currency,
          };
        }
        return {
          type: action.type,
          contact: action.contactName,
          amount_minor: action.amountMinor,
          currency: action.currency,
        };
      }),
      next_step: "Reply to the user asking them to review and confirm. Do not say it is recorded.",
    },
  };
}

export async function executeInteractiveTool(
  name: string,
  args: Record<string, unknown>,
  context: InteractiveToolContext,
): Promise<ToolResult> {
  switch (name) {
    case "analyze_business":
      return businessIntelligence(context, args as { from?: string | null; to?: string | null });
    case "propose_transactions": {
      const parsed = aiTransactionsProposalSchema.safeParse(args);
      if (!parsed.success) {
        context.clarification = { code: "unsupported", subject: "transaction" };
        return { ok: false, error: "The transaction details are incomplete." };
      }
      return setProposal(context, buildTransactionsDraft(parsed.data.transactions, context.reference));
    }
    case "propose_debt": {
      const parsed = aiDebtProposalSchema.safeParse(args);
      if (!parsed.success) {
        context.clarification = { code: "unsupported", subject: "debt" };
        return { ok: false, error: "The debt details are incomplete." };
      }
      return setProposal(context, buildDebtDraft(parsed.data, context.reference));
    }
    case "propose_debt_payment": {
      const parsed = aiDebtPaymentProposalSchema.safeParse(args);
      if (!parsed.success) {
        context.clarification = { code: "unsupported", subject: "repayment" };
        return { ok: false, error: "The repayment details are incomplete." };
      }
      return setProposal(context, buildDebtPaymentDraft(parsed.data, context.reference));
    }
    default:
      return executeTool(name, args, context);
  }
}
