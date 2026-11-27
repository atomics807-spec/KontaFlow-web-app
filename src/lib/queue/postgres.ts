import "server-only";

import { randomUUID } from "node:crypto";
import { createAdminClient, hasServiceRole } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger";
import { increment, observe } from "@/lib/observability/metrics";
import type { JobRow, OutboxEventRow } from "@/types/database";
import type { DrainResult, EnqueueJobInput, JobHandler } from "./types";
import { retryDelaySeconds } from "./backoff";

const DEFAULT_LEASE_SECONDS = 90;
const HANDLER_TIMEOUT_MS = 45_000;

export function queueAvailable(): boolean {
  return hasServiceRole();
}

export function workerId(prefix = "worker"): string {
  return `${prefix}:${process.env.VERCEL_REGION ?? process.env.CF_PAGES_BRANCH ?? "node"}:${randomUUID().slice(0, 8)}`;
}

export async function enqueueJob(input: EnqueueJobInput): Promise<string | null> {
  if (!hasServiceRole()) {
    logger.warn("queue.not_configured", { type: input.type });
    return null;
  }
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("enqueue_job", {
    p_job_type: input.type,
    p_payload: (input.payload ?? {}) as never,
    p_workspace_id: input.workspaceId ?? null,
    p_actor_id: input.actorId ?? null,
    p_priority: input.priority ?? 100,
    p_run_at: (input.runAt ?? new Date()).toISOString(),
    p_max_attempts: input.maxAttempts ?? 5,
    p_idempotency_key: input.idempotencyKey ?? null,
  });
  if (error) {
    logger.error("queue.enqueue_failed", { type: input.type, code: error.code });
    return null;
  }
  return data ?? null;
}

export async function getJob(jobId: string): Promise<JobRow | null> {
  if (!hasServiceRole()) return null;
  const admin = createAdminClient();
  const { data, error } = await admin.from("job_queue").select("*").eq("id", jobId).maybeSingle();
  if (error) {
    logger.warn("queue.read_failed", { jobId, code: error.code });
    return null;
  }
  return (data as JobRow | null) ?? null;
}

async function runWithTimeout(job: JobRow, handler: JobHandler) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      handler(job),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("job_timeout")), HANDLER_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function drainJobs(options: {
  worker: string;
  limit?: number;
  types?: string[] | null;
  handlers: Record<string, JobHandler>;
  concurrency?: number;
}): Promise<DrainResult> {
  const result: DrainResult = {
    claimed: 0,
    completed: 0,
    failed: 0,
    deadLettered: 0,
    outboxDelivered: 0,
    outboxFailed: 0,
  };
  if (!hasServiceRole()) return result;
  const admin = createAdminClient();

  await admin.rpc("reap_stale_jobs", { p_limit: 50 }).then(({ error }) => {
    if (error) logger.warn("queue.reap_failed", { code: error.code });
  });

  const { data: jobs, error } = await admin.rpc("claim_jobs", {
    p_worker_id: options.worker,
    p_limit: options.limit ?? 10,
    p_job_types: options.types ?? null,
    p_lease_seconds: DEFAULT_LEASE_SECONDS,
  });
  if (error) {
    logger.error("queue.claim_failed", { code: error.code });
    return result;
  }

  const pending = (jobs ?? []) as JobRow[];
  result.claimed = pending.length;
  if (pending.length > 0) increment("queue_claimed_total", pending.length);

  const runOne = async (job: JobRow) => {
    const handler = options.handlers[job.job_type];
    if (!handler) {
      const status = await failJob(job.id, options.worker, "no_handler", 60);
      if (status === "dead_lettered") result.deadLettered += 1;
      else result.failed += 1;
      return;
    }
    try {
      const startedAt = Date.now();
      const output = await runWithTimeout(job, handler);
      await completeJob(job.id, options.worker, output?.result, output?.resultRef);
      result.completed += 1;
      increment("queue_completed_total");
      observe("queue_job_duration_ms", Date.now() - startedAt);
    } catch (error) {
      const message = error instanceof Error ? error.message : "handler_failed";
      const status = await failJob(job.id, options.worker, message, retryDelaySeconds(job.attempts));
      if (status === "dead_lettered") {
        result.deadLettered += 1;
        increment("queue_dead_lettered_total");
      } else {
        result.failed += 1;
        increment("queue_retry_total");
      }
      logger.warn("queue.job_failed", {
        jobId: job.id,
        type: job.job_type,
        attempt: job.attempts,
        status,
        error: message,
      });
    }
  };

  const concurrency = Math.min(Math.max(options.concurrency ?? 1, 1), pending.length || 1);
  let cursor = 0;
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (cursor < pending.length) {
        const job = pending[cursor];
        cursor += 1;
        if (job) await runOne(job);
      }
    }),
  );

  return result;
}

async function completeJob(
  jobId: string,
  worker: string,
  result?: Record<string, unknown>,
  resultRef?: string,
): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.rpc("complete_job", {
    p_job_id: jobId,
    p_worker_id: worker,
    p_result: (result ?? null) as never,
    p_result_ref: resultRef ?? null,
  });
  if (error) logger.warn("queue.complete_failed", { jobId, code: error.code });
}

async function failJob(jobId: string, worker: string, error: string, delaySeconds: number): Promise<string> {
  const admin = createAdminClient();
  const retryAt = new Date(Date.now() + delaySeconds * 1000).toISOString();
  const { data, error: rpcError } = await admin.rpc("fail_job", {
    p_job_id: jobId,
    p_worker_id: worker,
    p_error: error,
    p_retry_at: retryAt,
  });
  if (rpcError) logger.warn("queue.fail_failed", { jobId, code: rpcError.code });
  return data ?? "failed";
}

export async function drainOutbox(options: {
  worker: string;
  limit?: number;
  handlers: Record<string, (event: OutboxEventRow) => Promise<void>>;
  concurrency?: number;
}): Promise<Pick<DrainResult, "outboxDelivered" | "outboxFailed">> {
  const result = { outboxDelivered: 0, outboxFailed: 0 };
  if (!hasServiceRole()) return result;
  const admin = createAdminClient();

  await admin.rpc("reap_stale_outbox_events", { p_limit: 50 }).then(({ error }) => {
    if (error) logger.warn("outbox.reap_failed", { code: error.code });
  });

  const { data, error } = await admin.rpc("claim_outbox_events", {
    p_worker_id: options.worker,
    p_limit: options.limit ?? 20,
    p_lease_seconds: DEFAULT_LEASE_SECONDS,
  });
  if (error) {
    logger.error("outbox.claim_failed", { code: error.code });
    return result;
  }

  const events = (data ?? []) as OutboxEventRow[];
  const runOne = async (event: OutboxEventRow) => {
    const handler = options.handlers[event.event_type];
    if (!handler) {
      await failOutbox(event.id, options.worker, "no_handler", 60);
      result.outboxFailed += 1;
      increment("outbox_failed_total");
      return;
    }
    try {
      await handler(event);
      const { error: completeError } = await admin.rpc("complete_outbox_event", {
        p_event_id: event.id,
        p_worker_id: options.worker,
      });
      if (completeError) throw new Error(completeError.message);
      result.outboxDelivered += 1;
      increment("outbox_delivered_total");
    } catch (error) {
      await failOutbox(
        event.id,
        options.worker,
        error instanceof Error ? error.message : "outbox_handler_failed",
        retryDelaySeconds(event.attempts),
      );
      result.outboxFailed += 1;
      increment("outbox_failed_total");
    }
  };

  const concurrency = Math.min(Math.max(options.concurrency ?? 1, 1), events.length || 1);
  let cursor = 0;
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (cursor < events.length) {
        const event = events[cursor];
        cursor += 1;
        if (event) await runOne(event);
      }
    }),
  );
  return result;
}

async function failOutbox(id: string, worker: string, error: string, delaySeconds: number): Promise<void> {
  const admin = createAdminClient();
  await admin.rpc("fail_outbox_event", {
    p_event_id: id,
    p_worker_id: worker,
    p_error: error,
    p_retry_at: new Date(Date.now() + delaySeconds * 1000).toISOString(),
  });
}
