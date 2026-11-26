import "server-only";

import { headers } from "next/headers";

export type RequestMeta = { ip: string | null; userAgent: string | null };

/** Best-effort client metadata. Rate limits stay process-local as a first gate. */
export async function getRequestMeta(): Promise<RequestMeta> {
  const store = await headers();
  const forwarded = store.get("x-forwarded-for");
  const candidate = store.get("cf-connecting-ip") ?? forwarded?.split(",")[0] ?? null;
  const ip = candidate?.trim().slice(0, 64) || null;
  const userAgent = store.get("user-agent")?.slice(0, 500) ?? null;
  return { ip, userAgent };
}
