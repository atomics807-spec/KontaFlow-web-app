import { z } from "zod";
import { PAYMENT_PROVIDERS } from "@/lib/payments/types";

export const paymentInitiateSchema = z.object({
  planCode: z.string().trim().min(1).max(40),
  provider: z.enum(PAYMENT_PROVIDERS),
  payerMsisdn: z.string().trim().max(32).optional().nullable(),
  idempotencyKey: z.uuid().optional().nullable(),
});

export const paymentRefundSchema = z.object({
  amountMinor: z.coerce.bigint().positive(),
  reason: z.string().trim().min(3).max(500),
  kind: z.enum(["refund", "reversal"]).default("refund"),
});

export type PaymentInitiateInput = z.infer<typeof paymentInitiateSchema>;
