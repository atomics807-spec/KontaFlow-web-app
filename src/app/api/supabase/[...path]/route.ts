import { NextResponse } from "next/server";
import { rejectCrossOrigin } from "@/lib/security/csrf";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Context = { params: Promise<{ path: string[] }> };

const REQUEST_HEADERS_TO_DROP = new Set(["host", "connection", "content-length", "accept-encoding"]);
const RESPONSE_HEADERS_TO_DROP = new Set([
  "connection",
  "content-encoding",
  "content-length",
  "transfer-encoding",
]);

/**
 * Same-origin gateway for a local Supabase stack. Production deployments point
 * NEXT_PUBLIC_SUPABASE_URL directly at the hosted project, so this route is
 * only reachable when SUPABASE_INTERNAL_URL is configured.
 */
async function forward(request: Request, context: Context): Promise<Response> {
  if (!["GET", "HEAD", "OPTIONS"].includes(request.method)) {
    const blocked = rejectCrossOrigin(request);
    if (blocked) return blocked;
  }

  const internal = process.env.SUPABASE_INTERNAL_URL?.trim();
  if (!internal) return NextResponse.json({ error: "not_configured" }, { status: 404 });

  const { path } = await context.params;
  if (!path?.length || path.some((segment) => !segment || segment === "." || segment === "..")) {
    return NextResponse.json({ error: "invalid_path" }, { status: 400 });
  }

  const target = new URL(`${internal.replace(/\/$/, "")}/${path.map(encodeURIComponent).join("/")}`);
  target.search = new URL(request.url).search;

  const headers = new Headers(request.headers);
  for (const header of REQUEST_HEADERS_TO_DROP) headers.delete(header);

  const init: RequestInit = { method: request.method, headers, redirect: "manual" };
  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = await request.arrayBuffer();
  }

  let upstream: Response;
  try {
    upstream = await fetch(target, init);
  } catch {
    return NextResponse.json({ error: "supabase_unreachable" }, { status: 502 });
  }

  const responseHeaders = new Headers(upstream.headers);
  for (const header of RESPONSE_HEADERS_TO_DROP) responseHeaders.delete(header);
  const cookies = upstream.headers.getSetCookie?.() ?? [];
  if (cookies.length > 0) {
    responseHeaders.delete("set-cookie");
    for (const cookie of cookies) responseHeaders.append("set-cookie", cookie);
  }

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}

export const GET = forward;
export const HEAD = forward;
export const POST = forward;
export const PUT = forward;
export const PATCH = forward;
export const DELETE = forward;
export const OPTIONS = forward;
