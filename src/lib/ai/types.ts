import type {
  AiCommandStatus,
  DebtDirection,
  PaymentMethod,
  TransactionKind,
} from "@/types/database";

export type AiTransactionProposal = {
  kind: TransactionKind;
  amount: string;
  description: string;
  category: string | null;
  payment_method: PaymentMethod | null;
  occurred_on: string | null;
  contact: string | null;
  account: string | null;
  counter_account: string | null;
};

export type AiDebtProposal = {
  direction: DebtDirection;
  contact: string;
  description: string;
  amount: string;
  opened_on: string | null;
  due_on: string | null;
  notes: string | null;
};

export type AiDebtPaymentProposal = {
  direction: DebtDirection;
  contact: string;
  amount: string;
  paid_on: string | null;
  account: string | null;
  payment_method: PaymentMethod | null;
  debt_description: string | null;
};

export type AiTransactionAction = {
  type: "transaction";
  kind: TransactionKind;
  amountMinor: string;
  currency: string;
  description: string;
  categoryId: string | null;
  categoryName: string | null;
  accountId: string;
  accountName: string;
  counterAccountId: string | null;
  counterAccountName: string | null;
  contactId: string | null;
  contactName: string | null;
  occurredOn: string;
  paymentMethod: PaymentMethod;
};

export type AiDebtAction = {
  type: "debt";
  direction: DebtDirection;
  contactId: string;
  contactName: string;
  description: string;
  amountMinor: string;
  currency: string;
  openedOn: string;
  dueOn: string | null;
  notes: string | null;
};

export type AiDebtPaymentAction = {
  type: "debt_payment";
  debtId: string;
  debtDescription: string;
  contactId: string;
  contactName: string;
  amountMinor: string;
  currency: string;
  paidOn: string;
  accountId: string | null;
  accountName: string | null;
  paymentMethod: PaymentMethod;
};

export type AiCommandAction = AiTransactionAction | AiDebtAction | AiDebtPaymentAction;

export type AiCommandResult = {
  command_id?: string;
  transactions?: string[];
  debts?: string[];
  payments?: string[];
  reversals?: { original: string; reversal: string }[];
  already_confirmed?: boolean;
  already_reversed?: boolean;
};

export type AiCommandView = {
  id: string;
  conversationId: string | null;
  status: AiCommandStatus;
  autoPosted: boolean;
  actions: AiCommandAction[];
  warnings: string[];
  reply: string;
  createdAt: string;
  confirmedAt: string | null;
  undoExpiresAt: string | null;
  canUndo: boolean;
  result: AiCommandResult | null;
};

export type AiCommandDraft = {
  preview: {
    version: 1;
    actions: AiCommandAction[];
    warnings: string[];
    autoPostEligible: boolean;
  };
  interpretation: {
    version: 1;
    source: "openai";
    proposal: unknown;
  };
};

export type ClarificationCode =
  | "amount"
  | "description"
  | "category"
  | "date"
  | "account"
  | "contact"
  | "debt"
  | "debt_amount"
  | "unsupported";

export type Clarification = {
  code: ClarificationCode;
  subject: string;
};
