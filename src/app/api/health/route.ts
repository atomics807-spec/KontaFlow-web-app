import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getServerEnv } from "@/lib/env";
import { deploymentInfo } from "@/lib/platform/deployment";
import { safeEqual } from "@/lib/security/safe-equal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

async function databaseReady(): Promise<boolean> {
  try {
    const admin = createAdminClient();
    const { error } = await admin
      .from("subscription_plans")
      .select("id", { head: true, count: "exact" })
      .limit(1);
    return !error;
  } catch {
    return false;
  }
}

export async function GET(request: Request) {
  const startedAt = Date.now();
  let token: string | undefined;
  let info: ReturnType<typeof deploymentInfo> | null = null;
  let configReady = true;
  try {
    token = getServerEnv().HEALTHCHECK_TOKEN;
    info = deploymentInfo();
  } catch {
    // Configuration errors are reported without echoing secret values.
    configReady = false;
  }

  let authorized = false;
  if (token) {
    const authorization = request.headers.get("authorization") ?? "";
    const headerToken = request.headers.get("x-healthcheck-token") ?? "";
    if (!safeEqual(authorization, `Bearer ${token}`) && !safeEqual(headerToken, token)) {
      return new Response("Unauthorized", { status: 401, headers: { "cache-control": "no-store" } });
    }
    authorized = true;
  }

  const database = await databaseReady();
  const ready = database && configReady;
  let operational: unknown = null;
  if (authorized) {
    try {
      const { data } = await createAdminClient().rpc("get_operational_stats");
      operational = data ?? null;
    } catch {
      operational = null;
    }
  }
  const body = {
    status: ready ? "ok" : "degraded",
    service: "kontaflow",
    timestamp: new Date().toISOString(),
    checks: {
      config: configReady ? "ok" : "invalid",
      database: database ? "ok" : "unavailable",
    },
    ...(authorized && info
      ? {
          environment: info.environment,
          target: info.target,
          version: info.version,
          latencyMs: Date.now() - startedAt,
          operational,
        }
      : {}),
  };

  return NextResponse.json(body, {
    status: ready ? 200 : 503,
    headers: { "cache-control": "no-store, max-age=0", vary: "Authorization" },
  });
}
