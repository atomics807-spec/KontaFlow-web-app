import { describe, expect, it } from "vitest";
import { retryDelaySeconds } from "@/lib/queue/backoff";
import { increment, metricsSnapshot, observe } from "@/lib/observability/metrics";

describe("queue backoff", () => {
  it("grows exponentially and caps at five minutes", () => {
    expect(retryDelaySeconds(1, () => 0.5)).toBe(5);
    expect(retryDelaySeconds(2, () => 0.5)).toBe(10);
    expect(retryDelaySeconds(3, () => 0.5)).toBe(20);
    expect(retryDelaySeconds(20, () => 0.5)).toBe(300);
  });

  it("keeps jitter inside the expected band", () => {
    expect(retryDelaySeconds(3, () => 0)).toBe(14);
    expect(retryDelaySeconds(3, () => 1)).toBe(26);
  });
});

describe("process metrics", () => {
  it("records counters and latency percentiles", () => {
    increment("test_counter", 2);
    observe("test_latency", 10);
    observe("test_latency", 20);
    observe("test_latency", 30);
    const snapshot = metricsSnapshot();
    expect(snapshot.counters.test_counter).toBe(2);
    expect(snapshot.histograms.test_latency).toMatchObject({ count: 3, avg: 20, max: 30, p50: 20, p95: 30 });
  });
});
