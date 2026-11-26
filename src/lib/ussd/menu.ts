import { createHash } from "node:crypto";
import { parseMoneyToMinor } from "@/lib/money";

/** Africa's Talking truncates or rejects oversized USSD responses. */
export const USSD_MAX_RESPONSE_CHARS = 182;
export const USSD_MAX_INPUT_CHARS = 120;
export const USSD_MAX_AMOUNT_MINOR = 1_000_000_000_000n;

export type UssdStage = "menu" | "amount" | "category" | "confirm" | "language" | "done";
export type UssdKind = "income" | "expense";

export type UssdSessionState = {
  version: 1;
  stage: UssdStage;
  kind?: UssdKind;
  amountMinor?: string;
  categoryIds?: string[];
  categoryId?: string;
  accountId?: string;
  currency?: string;
  lastText?: string;
  response?: string;
  completedAt?: string;
};

export function parseUssdText(text: string): string[] {
  return text
    .split("*")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

/** The last segment is the current input; Africa's Talking sends the full path. */
export function lastUssdInput(text: string): string {
  const parts = parseUssdText(text);
  return parts[parts.length - 1] ?? "";
}

/**
 * USSD users type whole currency units. Reject separators and fractions so a
 * keypad mistake cannot silently change the amount.
 */
export function parseUssdAmount(raw: string, currency: string): bigint {
  const value = raw.trim();
  if (!/^\d{1,12}$/.test(value)) {
    throw new Error("Enter a whole amount using digits only.");
  }
  const amount = parseMoneyToMinor(value, currency);
  if (amount <= 0n) throw new Error("Amount must be more than zero.");
  if (amount > USSD_MAX_AMOUNT_MINOR) throw new Error("Amount is too large.");
  return amount;
}

export function clampUssdResponse(kind: "CON" | "END", body: string): string {
  const text = body.replace(/\r/g, "").trim();
  const available = USSD_MAX_RESPONSE_CHARS - kind.length - 1;
  const clipped =
    text.length <= available ? text : `${text.slice(0, Math.max(0, available - 3))}...`;
  return `${kind} ${clipped}`;
}

/** Stable idempotency key for one confirmed USSD path. */
export function ussdClientId(sessionId: string, text: string): string {
  const digest = createHash("sha256").update(`${sessionId}:${text}`).digest("hex");
  return `ussd-${digest.slice(0, 64)}`;
}

export function isUssdSessionExpired(expiresAt: string | Date, now = new Date()): boolean {
  const expiry = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);
  return !Number.isFinite(expiry.getTime()) || expiry.getTime() <= now.getTime();
}
