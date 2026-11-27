import { getServerEnv } from "@/lib/env";
import { safeEqual } from "@/lib/security/safe-equal";
import { logger } from "@/lib/logger";
import { reconcilePendingPayments } from "@/services/payments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function run(request: Request): Promise<Response> {
  const secret = getServerEnv().CRON_SECRET;
  const authorization = request.headers.get("authorization") ?? "";
  if (!secret || !safeEqual(authorization, `Bearer ${secret}`)) {
    return new Response("Forbidden", { status: 403 });
  }

  try {
    const result = await reconcilePendingPayments(20);
    logger.info("cron.payment_reconciliation_done", result);
    return Response.json(result, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    logger.error("cron.payment_reconciliation_failed", { error });
    return new Response("error", { status: 500 });
  }
}

export async function GET(request: Request) {
  return run(request);
}

export async function POST(request: Request) {
  return run(request);
}
