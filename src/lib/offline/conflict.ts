export type ExpectedClientTransaction = {
  kind: string;
  amountMinor: string;
  description: string;
  occurredOn: string;
};

export type ExistingServerTransaction = {
  kind: string;
  amount_minor: number | string | bigint;
  description: string;
  occurred_on: string;
};

/**
 * A client UUID is an idempotency key, not permission to reuse it for another
 * amount. If the server already holds that UUID with different financial data,
 * the local copy must be surfaced as a conflict instead of being treated as a
 * successful duplicate.
 */
export function hasIdempotencyConflict(
  existing: ExistingServerTransaction,
  expected: ExpectedClientTransaction,
): boolean {
  const existingAmount =
    typeof existing.amount_minor === "bigint"
      ? existing.amount_minor.toString()
      : String(existing.amount_minor).trim();

  return (
    existing.kind !== expected.kind ||
    existingAmount !== expected.amountMinor.trim() ||
    existing.description.trim() !== expected.description.trim() ||
    existing.occurred_on.slice(0, 10) !== expected.occurredOn.slice(0, 10)
  );
}
