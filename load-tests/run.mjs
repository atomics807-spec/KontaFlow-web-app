#!/usr/bin/env node
/**
 * Dependency-free HTTP load harness.
 *
 *   node load-tests/run.mjs --path /api/health --requests 100000 --concurrency 250
 *   node load-tests/run.mjs --path /en --requests 10000 --concurrency 100 --out results/public.json
 *
 * The default profile is a read-only smoke benchmark. For an authenticated
 * dashboard run, pass a session cookie with --cookie "sb-...=...".
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { performance } from "node:perf_hooks";

function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : process.argv[index + 1];
}

const url = arg("url", process.env.LOADTEST_URL ?? "http://127.0.0.1:3000");
const path = arg("path", "/api/health");
const requests = Number(arg("requests", "1000"));
const concurrency = Math.max(1, Number(arg("concurrency", "50")));
const timeoutMs = Number(arg("timeout", "30000"));
const warmup = Number(arg("warmup", "20"));
const maxErrorRate = Number(arg("max-error-rate", "0.01"));
const maxP95 = Number(arg("max-p95", "0"));
const cookie = arg("cookie", process.env.LOADTEST_COOKIE ?? "");
const token = arg("token", process.env.LOADTEST_TOKEN ?? "");
const out = arg("out", "");
const method = (arg("method", "GET") ?? "GET").toUpperCase();
const body = arg("body", "");

if (!Number.isFinite(requests) || requests < 1) {
  console.error("--requests must be a positive number");
  process.exit(2);
}

const headers = { accept: "text/html,application/json", "user-agent": "kontaflow-load-harness/1" };
if (cookie) headers.cookie = cookie;
if (token) headers.authorization = `Bearer ${token}`;

async function once() {
  const started = performance.now();
  try {
    const response = await fetch(`${url}${path}`, {
      method,
      headers,
      body: method === "GET" || method === "HEAD" ? undefined : body,
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
    await response.arrayBuffer();
    return { ms: performance.now() - started, status: response.status, error: null };
  } catch (error) {
    return { ms: performance.now() - started, status: 0, error: String(error?.message ?? error) };
  }
}

for (let index = 0; index < warmup; index += 1) await once();

const latencies = [];
let errors = 0;
let issued = 0;
let completed = 0;
const statusCounts = new Map();
const errorSamples = [];
const startedAt = performance.now();

async function worker() {
  while (true) {
    const index = issued;
    if (index >= requests) return;
    issued += 1;
    const result = await once();
    completed += 1;
    latencies.push(result.ms);
    if (result.error || result.status < 200 || result.status >= 400) {
      errors += 1;
      if (errorSamples.length < 10) errorSamples.push(result.error ?? `HTTP ${result.status}`);
    }
    statusCounts.set(result.status, (statusCounts.get(result.status) ?? 0) + 1);
  }
}

await Promise.all(Array.from({ length: Math.min(concurrency, requests) }, () => worker()));
const elapsedMs = performance.now() - startedAt;

function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];
}

const summary = {
  target: `${method} ${url}${path}`,
  requests,
  completed,
  concurrency,
  elapsedMs: Math.round(elapsedMs),
  rps: Number((completed / (elapsedMs / 1000)).toFixed(2)),
  errorRate: Number((errors / Math.max(completed, 1)).toFixed(4)),
  latencyMs: {
    min: Math.round(Math.min(...latencies)),
    p50: Math.round(percentile(latencies, 50)),
    p95: Math.round(percentile(latencies, 95)),
    p99: Math.round(percentile(latencies, 99)),
    max: Math.round(Math.max(...latencies)),
    avg: Math.round(latencies.reduce((sum, value) => sum + value, 0) / Math.max(latencies.length, 1)),
  },
  statusCounts: Object.fromEntries([...statusCounts].sort(([a], [b]) => a - b)),
  errorSamples,
  generatedAt: new Date().toISOString(),
};

console.log(JSON.stringify(summary, null, 2));
if (out) {
  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, `${JSON.stringify(summary, null, 2)}\n`);
  console.log(`\nSaved ${out}`);
}

if (summary.errorRate > maxErrorRate) {
  console.error(`\nFAIL: error rate ${summary.errorRate} exceeds ${maxErrorRate}`);
  process.exit(1);
}
if (maxP95 > 0 && summary.latencyMs.p95 > maxP95) {
  console.error(`\nFAIL: p95 ${summary.latencyMs.p95}ms exceeds ${maxP95}ms`);
  process.exit(1);
}
