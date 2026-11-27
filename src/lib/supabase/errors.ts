import { AppError } from "../errors";
import { logger } from "../logger";

type DatabaseError = {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
};

/**
 * Raised database messages we consider safe to show to a signed-in user.
 * Anything else becomes a generic message; the full error is logged instead so
 * SQL details never reach the browser.
 */
const SAFE_MESSAGES: Array<[RegExp, string]> = [
  [/Amount must be greater than zero/i, "Enter an amount greater than zero."],
  [/amount_minor must be a positive integer/i, "Enter a valid amount."],
  [/A description between 1 and 500 characters is required/i, "Describe the transaction."],
  [/Category does not match the transaction type/i, "Choose a category that matches this transaction."],
  [/Transaction date cannot be in the future/i, "The date cannot be in the future."],
  [/Transaction date is too far in the past/i, "The date is too far in the past."],
  [/Business name must be between 1 and 120 characters/i, "Enter a business name."],
  [/Unsupported currency/i, "Choose a supported currency."],
  [/A workspace must keep at least one active owner/i, "A workspace must keep at least one owner."],
  [/Only an owner can grant the owner role/i, "Only an owner can grant the owner role."],
  [/Invitation has expired/i, "This invitation has expired."],
  [/This invitation belongs to a different email address/i, "This invitation belongs to a different email address."],
  [/Select a valid cash, bank or mobile money account/i, "Choose a valid account."],
  [/Monthly transaction limit reached for this plan/i, "You have reached this month's transaction limit. Upgrade your plan to keep recording."],
  [/Plan member limit reached for this workspace/i, "You have reached this plan's member limit. Upgrade to invite more people."],
  [/Your trial or subscription is read-only/i, "Your trial or subscription has ended. Your books are read-only until you choose a plan."],
  [/This plan does not include manual bookkeeping/i, "This plan does not include manual bookkeeping."],
  [/Payment amount is below the plan price/i, "The payment amount does not match the selected plan."],
  [/Payment currency does not match the plan currency/i, "The payment currency does not match the selected plan."],
];

export function mapSupabaseError(error: unknown, fallback: string): AppError {
  if (error instanceof AppError) return error;

  const dbError = (error ?? {}) as DatabaseError;
  const message = dbError.message ?? "";

  for (const [pattern, safe] of SAFE_MESSAGES) {
    if (pattern.test(message)) {
      return new AppError("validation_failed", safe, { cause: error });
    }
  }

  switch (dbError.code) {
    case "42501":
      return new AppError("forbidden", "You do not have permission to do that.", { cause: error });
    case "P0002":
      return new AppError("not_found", "We could not find that record.", { cause: error });
    case "23505":
      return new AppError("conflict", "That record already exists.", { cause: error });
    case "23514":
    case "22P02":
    case "22007":
    case "22003":
      return new AppError("validation_failed", fallback, { cause: error });
    case "PGRST116":
      return new AppError("not_found", "We could not find that record.", { cause: error });
    default:
      logger.error("supabase.error", { code: dbError.code, message, details: dbError.details });
      return new AppError("internal_error", fallback, { cause: error });
  }
}

export function assertNoError(error: unknown, fallback: string): void {
  if (error) throw mapSupabaseError(error, fallback);
}
