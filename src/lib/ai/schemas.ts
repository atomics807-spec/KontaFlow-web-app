import { z } from "zod";

const paymentMethod = z.enum(["cash", "mobile_money", "bank_transfer", "card", "cheque", "other"]);

export const aiTransactionProposalSchema = z.object({
  kind: z.enum(["income", "expense", "transfer"]),
  amount: z.string().trim().min(1).max(40),
  description: z.string().trim().min(1).max(500),
  category: z.string().trim().max(80).nullable(),
  payment_method: paymentMethod.nullable(),
  occurred_on: z.string().trim().max(10).nullable(),
  contact: z.string().trim().max(160).nullable(),
  account: z.string().trim().max(160).nullable(),
  counter_account: z.string().trim().max(160).nullable(),
});

export const aiTransactionsProposalSchema = z.object({
  transactions: z.array(aiTransactionProposalSchema).min(1).max(10),
});

export const aiDebtProposalSchema = z.object({
  direction: z.enum(["receivable", "payable"]),
  contact: z.string().trim().min(1).max(160),
  description: z.string().trim().min(1).max(500),
  amount: z.string().trim().min(1).max(40),
  opened_on: z.string().trim().max(10).nullable(),
  due_on: z.string().trim().max(10).nullable(),
  notes: z.string().trim().max(1000).nullable(),
});

export const aiDebtPaymentProposalSchema = z.object({
  direction: z.enum(["receivable", "payable"]),
  contact: z.string().trim().min(1).max(160),
  amount: z.string().trim().min(1).max(40),
  paid_on: z.string().trim().max(10).nullable(),
  account: z.string().trim().max(160).nullable(),
  payment_method: paymentMethod.nullable(),
  debt_description: z.string().trim().max(500).nullable(),
});

export const aiRequestSchema = z.object({
  message: z.string().trim().min(1).max(2000),
  conversationId: z.uuid().nullable().optional(),
  requestId: z.string().trim().min(8).max(120),
  locale: z.string().optional(),
  /** Offline-queued commands must never auto-post; the person confirms the preview. */
  requireConfirmation: z.boolean().optional(),
});

export const aiCommandIdSchema = z.uuid();

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const aiTransactionActionSchema = z.object({
  type: z.literal("transaction"),
  kind: z.enum(["income", "expense", "transfer"]),
  amountMinor: z.string().regex(/^\d+$/),
  currency: z.string().min(3).max(3),
  description: z.string().min(1).max(500),
  categoryId: z.uuid().nullable(),
  categoryName: z.string().max(80).nullable(),
  accountId: z.uuid(),
  accountName: z.string().min(1).max(160),
  counterAccountId: z.uuid().nullable(),
  counterAccountName: z.string().max(160).nullable(),
  contactId: z.uuid().nullable(),
  contactName: z.string().max(160).nullable(),
  occurredOn: isoDate,
  paymentMethod,
});

export const aiDebtActionSchema = z.object({
  type: z.literal("debt"),
  direction: z.enum(["receivable", "payable"]),
  contactId: z.uuid(),
  contactName: z.string().min(1).max(160),
  description: z.string().min(1).max(500),
  amountMinor: z.string().regex(/^\d+$/),
  currency: z.string().min(3).max(3),
  openedOn: isoDate,
  dueOn: isoDate.nullable(),
  notes: z.string().max(1000).nullable(),
});

export const aiDebtPaymentActionSchema = z.object({
  type: z.literal("debt_payment"),
  debtId: z.uuid(),
  debtDescription: z.string().min(1).max(500),
  contactId: z.uuid(),
  contactName: z.string().min(1).max(160),
  amountMinor: z.string().regex(/^\d+$/),
  currency: z.string().min(3).max(3),
  paidOn: isoDate,
  accountId: z.uuid().nullable(),
  accountName: z.string().max(160).nullable(),
  paymentMethod,
});

export const aiCommandPreviewSchema = z.object({
  version: z.literal(1),
  actions: z.array(
    z.discriminatedUnion("type", [
      aiTransactionActionSchema,
      aiDebtActionSchema,
      aiDebtPaymentActionSchema,
    ]),
  ),
  warnings: z.array(z.string().max(300)).default([]),
  autoPostEligible: z.boolean().default(false),
});
