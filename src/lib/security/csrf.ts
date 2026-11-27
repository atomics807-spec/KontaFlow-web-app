import "server-only";

import { NextResponse } from "next/server";
import { getPublicEnv, getServerEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import { verifySameOrigin } from "./request-origin";

/**
 * Route Handlers do not get the Server Action origin check. Call this at the
 * top of every cookie-authenticated mutation before reading the body.
 */
export function rejectCrossOrigin(request: Request): NextResponse | null {
  let appUrl: string | null = null;
  let trustedOrigins: string | null = null;
  try {
    appUrl = getPublicEnv().NEXT_PUBLIC_APP_URL;
    trustedOrigins = getServerEnv().TRUSTED_ORIGINS ?? null;
  } catch {
    // Environment validation already fails the request elsewhere; still compare
    // against the request URL so a cross-site request is never allowed.
  }

  const result = verifySameOrigin({
    origin: request.headers.get("origin"),
    secFetchSite: request.headers.get("sec-fetch-site"),
    requestUrl: request.url,
    appUrl,
    trustedOrigins,
  });

  if (result.ok) return null;

  logger.warn("security.cross_origin_rejected", {
    reason: result.reason,
    path: new URL(request.url).pathname,
  });
  return NextResponse.json(
    { error: "cross_origin_rejected" },
    { status: 403, headers: { "cache-control": "no-store" } },
  );
}
