import { describe, expect, it } from "vitest";
import {
  aiCommandPreviewSchema,
  aiDebtPaymentProposalSchema,
  aiDebtProposalSchema,
  aiRequestSchema,
  aiTransactionProposalSchema,
  aiTransactionsProposalSchema,
} from "@/lib/ai/schemas";

const transaction = {
  kind: "expense",
  amount: "500",
  description: "Transport",
  category: "Transport",
  payment_method: "cash",
  occurred_on: "2026-11-26",
  contact: null,
  account: "Cash",
  counter_account: null,
};

describe("AI request schema", () => {
  it("accepts a bounded natural-language command", () => {
    const parsed = aiRequestSchema.safeParse({
      message: "Spent 500 on transport",
      requestId: "request-123",
      conversationId: "11111111-1111-4111-8111-111111111111",
      requireConfirmation: true,
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects empty, oversized and malformed requests", () => {
    expect(aiRequestSchema.safeParse({ message: " ", requestId: "request-123" }).success).toBe(false);
    expect(aiRequestSchema.safeParse({ message: "x".repeat(2001), requestId: "request-123" }).success).toBe(false);
    expect(aiRequestSchema.safeParse({ message: "hello", requestId: "short" }).success).toBe(false);
    expect(
      aiRequestSchema.safeParse({
        message: "hello",
        requestId: "request-123",
        conversationId: "not-a-uuid",
      }).success,
    ).toBe(false);
  });
});

describe("AI proposal schemas", () => {
  it("accepts one to ten transaction proposals", () => {
    expect(aiTransactionProposalSchema.safeParse(transaction).success).toBe(true);
    expect(aiTransactionsProposalSchema.safeParse({ transactions: [transaction] }).success).toBe(true);
    expect(aiTransactionsProposalSchema.safeParse({ transactions: [] }).success).toBe(false);
    expect(
      aiTransactionsProposalSchema.safeParse({
        transactions: Array.from({ length: 11 }, () => transaction),
      }).success,
    ).toBe(false);
  });

  it("rejects unsupported kinds, payment methods and missing descriptions", () => {
    expect(aiTransactionProposalSchema.safeParse({ ...transaction, kind: "refund" }).success).toBe(false);
    expect(aiTransactionProposalSchema.safeParse({ ...transaction, payment_method: "crypto" }).success).toBe(false);
    expect(aiTransactionProposalSchema.safeParse({ ...transaction, description: "" }).success).toBe(false);
  });

  it("validates debt and repayment proposals", () => {
    expect(
      aiDebtProposalSchema.safeParse({
        direction: "receivable",
        contact: "John",
        description: "Credit sale",
        amount: "10000",
        opened_on: "2026-11-26",
        due_on: null,
        notes: null,
      }).success,
    ).toBe(true);
    expect(
      aiDebtPaymentProposalSchema.safeParse({
        direction: "payable",
        contact: "Supplier",
        amount: "2500",
        paid_on: "2026-11-26",
        account: "Cash",
        payment_method: "cash",
        debt_description: "Stock",
      }).success,
    ).toBe(true);
    expect(
      aiDebtPaymentProposalSchema.safeParse({
        direction: "sideways",
        contact: "Supplier",
        amount: "2500",
      }).success,
    ).toBe(false);
  });
});

describe("AI command preview schema", () => {
  it("requires a versioned, discriminated action list", () => {
    const parsed = aiCommandPreviewSchema.safeParse({
      version: 1,
      actions: [
        {
          type: "transaction",
          kind: "expense",
          amountMinor: "500",
          currency: "XAF",
          description: "Transport",
          categoryId: null,
          categoryName: "Transport",
          accountId: "11111111-1111-4111-8111-111111111111",
          accountName: "Cash",
          counterAccountId: null,
          counterAccountName: null,
          contactId: null,
          contactName: null,
          occurredOn: "2026-11-26",
          paymentMethod: "cash",
        },
      ],
    });
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.warnings).toEqual([]);
    expect(parsed.success && parsed.data.autoPostEligible).toBe(false);
  });

  it("rejects unknown actions, negative minor units and bad dates", () => {
    const base = {
      version: 1,
      actions: [
        {
          type: "transaction",
          kind: "expense",
          amountMinor: "-1",
          currency: "XAF",
          description: "Transport",
          categoryId: null,
          categoryName: "Transport",
          accountId: "11111111-1111-4111-8111-111111111111",
          accountName: "Cash",
          counterAccountId: null,
          counterAccountName: null,
          contactId: null,
          contactName: null,
          occurredOn: "26/11/2026",
          paymentMethod: "cash",
        },
      ],
    };
    expect(aiCommandPreviewSchema.safeParse(base).success).toBe(false);
    expect(
      aiCommandPreviewSchema.safeParse({ version: 2, actions: [] }).success,
    ).toBe(false);
  });
});
