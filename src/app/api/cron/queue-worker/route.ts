import { getServerEnv } from "@/lib/env";
import { safeEqual } from "@/lib/security/safe-equal";
import { logger } from "@/lib/logger";
import { drainJobs, drainOutbox, jobHandlers, outboxHandlers, workerId } from "@/lib/queue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function run(request: Request): Promise<Response> {
  const secret = getServerEnv().CRON_SECRET;
  const authorization = request.headers.get("authorization") ?? "";
  if (!secret || !safeEqual(authorization, `Bearer ${secret}`)) {
    return new Response("Forbidden", { status: 403 });
  }

  const worker = workerId("cron");
  try {
    const [jobs, outbox] = await Promise.all([
      drainJobs({ worker, limit: 10, concurrency: 10, handlers: jobHandlers }),
      drainOutbox({ worker, limit: 50, concurrency: 10, handlers: outboxHandlers }),
    ]);
    const result = { ...jobs, ...outbox };
    logger.info("cron.queue_worker_done", { worker, ...result });
    return Response.json(result, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    logger.error("cron.queue_worker_failed", { worker, error });
    return new Response("error", { status: 500 });
  }
}

export async function GET(request: Request) {
  return run(request);
}

export async function POST(request: Request) {
  return run(request);
}
