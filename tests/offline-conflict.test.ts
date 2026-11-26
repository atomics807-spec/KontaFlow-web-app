import { describe, expect, it } from "vitest";
import { hasIdempotencyConflict, type ExistingServerTransaction } from "@/lib/offline/conflict";

const server: ExistingServerTransaction = {
  kind: "expense",
  amount_minor: 1500,
  description: "Transport to Douala",
  occurred_on: "2026-11-26T09:30:00+01:00",
};

const expected = {
  kind: "expense",
  amountMinor: "1500",
  description: "Transport to Douala",
  occurredOn: "2026-11-26",
};

describe("idempotency conflict detection", () => {
  it("accepts the same UUID only when the financial data matches", () => {
    expect(hasIdempotencyConflict(server, expected)).toBe(false);
  });

  it("rejects a reused UUID with a different amount", () => {
    expect(hasIdempotencyConflict(server, { ...expected, amountMinor: "1501" })).toBe(true);
  });

  it("rejects a reused UUID with a different kind, description or date", () => {
    expect(hasIdempotencyConflict(server, { ...expected, kind: "income" })).toBe(true);
    expect(hasIdempotencyConflict(server, { ...expected, description: "Transport to Yaoundé" })).toBe(true);
    expect(hasIdempotencyConflict(server, { ...expected, occurredOn: "2026-11-25" })).toBe(true);
  });
});
