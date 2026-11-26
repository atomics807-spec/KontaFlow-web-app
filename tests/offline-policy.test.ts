import { describe, expect, it } from "vitest";
import { classifySyncFailure, isRetryableHttpStatus, nextRetryDelay, RETRY_MAX_MS } from "@/lib/offline/policy";

describe("offline sync policy", () => {
  it("backs off exponentially with bounded jitter", () => {
    expect(nextRetryDelay(0, () => 0)).toBe(1_600);
    expect(nextRetryDelay(1, () => 0)).toBe(3_200);
    expect(nextRetryDelay(3, () => 0.5)).toBe(16_000);
    expect(nextRetryDelay(20, () => 1)).toBe(RETRY_MAX_MS);
  });

  it("treats validation, permission and conflict responses as human work", () => {
    expect(classifySyncFailure("validation_failed", 422)).toBe("attention");
    expect(classifySyncFailure("duplicate_conflict", 409)).toBe("attention");
    expect(classifySyncFailure(undefined, 401)).toBe("attention");
    expect(classifySyncFailure(undefined, 403)).toBe("attention");
  });

  it("retries network and temporary server failures", () => {
    expect(classifySyncFailure("network_error", 0)).toBe("retry");
    expect(classifySyncFailure("rate_limited", 429)).toBe("retry");
    expect(classifySyncFailure(undefined, 500)).toBe("retry");
    expect(isRetryableHttpStatus(503)).toBe(true);
    expect(isRetryableHttpStatus(400)).toBe(false);
  });
});
