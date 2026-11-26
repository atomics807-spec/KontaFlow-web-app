import { z } from "zod";
import { parseMoneyToMinor } from "@/lib/money";
import { SUPPORTED_CURRENCIES } from "@/lib/currency";

export const emailSchema = z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address."));

export const passwordSchema = z
  .string()
  .min(10, "Use at least 10 characters.")
  .max(72, "Use 72 characters or fewer.")
  .regex(/[a-z]/, "Include a lowercase letter.")
  .regex(/[A-Z]/, "Include an uppercase letter.")
  .regex(/[0-9]/, "Include a number.");

const uuid = z.uuid("Select a valid option.");

const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use the YYYY-MM-DD format.")
  .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)), "Enter a valid date.");

export const amountInputSchema = z
  .string()
  .trim()
  .min(1, "Enter an amount.")
  .max(20, "Amount is too long.");

export type TransactionInput = {
  kind: "income" | "expense" | "transfer";
  amount: string;
  description: string;
  occurredOn: string;
  categoryId?: string | null;
  accountId: string;
  counterAccountId?: string | null;
  contactId?: string | null;
  paymentMethod: "cash" | "mobile_money" | "bank_transfer" | "card" | "cheque" | "other";
  reference?: string | null;
  clientGeneratedId?: string | null;
};

export const transactionSchema = z
  .object({
    kind: z.enum(["income", "expense", "transfer"]),
    amount: amountInputSchema,
    description: z
      .string()
      .trim()
      .min(2, "Describe what this was for.")
      .max(500, "Keep the description under 500 characters."),
    occurredOn: dateString,
    categoryId: uuid.optional().nullable(),
    accountId: uuid,
    counterAccountId: uuid.optional().nullable(),
    contactId: uuid.optional().nullable(),
    paymentMethod: z.enum(["cash", "mobile_money", "bank_transfer", "card", "cheque", "other"]).default("cash"),
    reference: z.string().trim().max(120).optional().nullable(),
    clientGeneratedId: z.string().trim().max(120).optional().nullable(),
  })
  .superRefine((value, ctx) => {
    if (value.kind !== "transfer" && !value.categoryId) {
      ctx.addIssue({
        code: "custom",
        path: ["categoryId"],
        message: "Choose a category.",
      });
    }
    if (value.kind === "transfer" && !value.counterAccountId) {
      ctx.addIssue({
        code: "custom",
        path: ["counterAccountId"],
        message: "Choose the destination account.",
      });
    }
  });

/** Converts validated form input into the RPC payload (minor units + snake_case). */
export function toTransactionPayload(
  input: TransactionInput,
  workspaceId: string,
  currency: string,
  extra?: { channel?: string; attachmentPath?: string | null },
) {
  return {
    workspace_id: workspaceId,
    kind: input.kind,
    amount_minor: parseMoneyToMinor(input.amount, currency).toString(),
    description: input.description,
    occurred_on: input.occurredOn,
    category_id: input.kind === "transfer" ? null : input.categoryId ?? null,
    account_id: input.accountId,
    counter_account_id: input.kind === "transfer" ? input.counterAccountId ?? null : null,
    contact_id: input.contactId ?? null,
    payment_method: input.paymentMethod,
    reference: input.reference ?? null,
    client_generated_id: input.clientGeneratedId ?? null,
    channel: extra?.channel ?? "web",
    attachment_path: extra?.attachmentPath ?? null,
    currency,
  };
}

export const workspaceSchema = z.object({
  name: z.string().trim().min(2, "Enter the business name.").max(120, "Keep it under 120 characters."),
  legalName: z.string().trim().max(160).optional().or(z.literal("")),
  currency: z.enum(SUPPORTED_CURRENCIES),
  country: z.string().trim().length(2, "Use a two-letter country code."),
  timezone: z.string().trim().min(3).max(64).default("Africa/Douala"),
  locale: z.enum(["en", "fr", "wes"]).default("en"),
});

export const workspaceSettingsSchema = z.object({
  name: z.string().trim().min(2, "Enter the business name.").max(120),
  legalName: z.string().trim().max(160).optional().or(z.literal("")),
  currency: z.enum(SUPPORTED_CURRENCIES),
  timezone: z.string().trim().min(3).max(64),
  country: z.string().trim().length(2),
});

export const contactSchema = z.object({
  name: z.string().trim().min(2, "Enter a name.").max(160),
  kind: z.enum(["customer", "supplier", "both"]),
  phone: z
    .string()
    .trim()
    .max(24)
    .optional()
    .or(z.literal("")),
  email: z.string().trim().max(160).optional().or(z.literal("")),
  address: z.string().trim().max(240).optional().or(z.literal("")),
  taxId: z.string().trim().max(60).optional().or(z.literal("")),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
});

export const invitationSchema = z.object({
  email: emailSchema,
  role: z.enum(["admin", "accountant", "manager", "staff"]),
});

export const memberRoleSchema = z.object({
  memberId: uuid,
  role: z.enum(["owner", "admin", "accountant", "manager", "staff"]),
});
