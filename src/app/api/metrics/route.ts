import { getServerEnv } from "@/lib/env";
import { safeEqual } from "@/lib/security/safe-equal";
import { metricsSnapshot } from "@/lib/observability/metrics";
import { createAdminClient, hasServiceRole } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function authorized(request: Request): boolean {
  const env = getServerEnv();
  const bearer = request.headers.get("authorization") ?? "";
  const headerToken = request.headers.get("x-healthcheck-token") ?? "";
  const tokens = [env.HEALTHCHECK_TOKEN, env.CRON_SECRET].filter((token): token is string => Boolean(token));
  return tokens.some(
    (token) => safeEqual(bearer, `Bearer ${token}`) || safeEqual(headerToken, token),
  );
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return new Response("Unauthorized", { status: 401, headers: { "cache-control": "no-store" } });
  }

  let operational = null;
  if (hasServiceRole()) {
    try {
      const { data, error } = await createAdminClient().rpc("get_operational_stats");
      if (!error) operational = data;
    } catch (error) {
      logger.warn("metrics.operational_failed", { error });
    }
  }

  return Response.json(
    { ...metricsSnapshot(), operational },
    { headers: { "cache-control": "no-store" } },
  );
}
