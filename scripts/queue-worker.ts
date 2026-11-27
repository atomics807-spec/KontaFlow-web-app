#!/usr/bin/env tsx
/**
 * Long-running queue worker for containers or a VM.
 *
 * It calls the same authenticated cron endpoint the serverless schedule uses,
 * so there is one code path and no second copy of the handler registry.
 *
 *   APP_URL=http://127.0.0.1:3000 CRON_SECRET=... npm run queue:work
 */
const baseUrl = process.env.APP_URL ?? "http://127.0.0.1:3000";
const secret = process.env.CRON_SECRET;
const intervalMs = Math.max(1_000, Number(process.env.QUEUE_POLL_MS ?? 2_000));

if (!secret) {
  console.error("CRON_SECRET is required");
  process.exit(1);
}

let stopping = false;
process.on("SIGINT", () => {
  stopping = true;
});
process.on("SIGTERM", () => {
  stopping = true;
});

async function tick(): Promise<void> {
  const response = await fetch(`${baseUrl}/api/cron/queue-worker`, {
    method: "POST",
    headers: { authorization: `Bearer ${secret}` },
    signal: AbortSignal.timeout(55_000),
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${body.slice(0, 300)}`);
  console.log(body);
}

console.log(`queue worker polling ${baseUrl} every ${intervalMs}ms`);
while (!stopping) {
  try {
    await tick();
  } catch (error) {
    console.error("queue worker tick failed", error instanceof Error ? error.message : error);
  }
  if (!stopping) await new Promise((resolve) => setTimeout(resolve, intervalMs));
}
console.log("queue worker stopped");

export {};
