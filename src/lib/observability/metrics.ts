/**
 * Process-local metrics for structured logs and the protected /api/metrics
 * endpoint. Long-term dashboards should aggregate these counters from logs or
 * an OpenTelemetry collector; no tenant data is included in labels.
 */
type Counter = { value: number; updatedAt: number };
type Histogram = { count: number; sum: number; max: number; samples: number[] };

const counters = new Map<string, Counter>();
const histograms = new Map<string, Histogram>();
const startedAt = Date.now();
const MAX_SAMPLES = 2_000;

export function increment(name: string, value = 1): void {
  const current = counters.get(name);
  counters.set(name, { value: (current?.value ?? 0) + value, updatedAt: Date.now() });
}

export function observe(name: string, value: number): void {
  if (!Number.isFinite(value)) return;
  const current = histograms.get(name) ?? { count: 0, sum: 0, max: 0, samples: [] };
  current.count += 1;
  current.sum += value;
  current.max = Math.max(current.max, value);
  current.samples.push(value);
  if (current.samples.length > MAX_SAMPLES) current.samples.splice(0, current.samples.length - MAX_SAMPLES);
  histograms.set(name, current);
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(index, 0)]!;
}

export function metricsSnapshot() {
  return {
    startedAt: new Date(startedAt).toISOString(),
    uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
    memory: {
      rssBytes: process.memoryUsage().rss,
      heapUsedBytes: process.memoryUsage().heapUsed,
    },
    counters: Object.fromEntries([...counters].map(([name, value]) => [name, value.value])),
    histograms: Object.fromEntries(
      [...histograms].map(([name, value]) => [
        name,
        {
          count: value.count,
          avg: value.count ? value.sum / value.count : 0,
          max: value.max,
          p50: percentile(value.samples, 50),
          p95: percentile(value.samples, 95),
          p99: percentile(value.samples, 99),
        },
      ]),
    ),
  };
}
