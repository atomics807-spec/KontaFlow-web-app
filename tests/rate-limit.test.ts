import { afterEach, describe, expect, it, vi } from "vitest";
import { rateLimit, rateLimitDetailed, resetRateLimits } from "@/lib/rate-limit";

afterEach(() => {
  resetRateLimits();
  vi.useRealTimers();
});

describe("fixed-window rate limiter", () => {
  it("allows requests up to the limit and reports remaining capacity", () => {
    expect(rateLimitDetailed("key-a", 2, 60_000)).toMatchObject({ allowed: true, remaining: 1 });
    expect(rateLimitDetailed("key-a", 2, 60_000)).toMatchObject({ allowed: true, remaining: 0 });
    expect(rateLimitDetailed("key-a", 2, 60_000)).toMatchObject({ allowed: false, remaining: 0 });
  });

  it("keeps buckets independent", () => {
    expect(rateLimit("key-b", 1)).toBe(true);
    expect(rateLimit("key-b", 1)).toBe(false);
    expect(rateLimit("key-c", 1)).toBe(true);
  });

  it("resets after the window elapses", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    expect(rateLimit("key-d", 1, 1_000)).toBe(true);
    expect(rateLimit("key-d", 1, 1_000)).toBe(false);
    vi.setSystemTime(new Date("2026-01-01T00:00:02Z"));
    expect(rateLimit("key-d", 1, 1_000)).toBe(true);
  });
});
