import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { createAdminClient, hasServiceRole } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger";

type Entry = { value: unknown; expiresAt: number };

const L1_TTL_MS = 3_000;
const L1_MAX = 1_000;
const l1 = new Map<string, Entry>();

function l1Get<T>(key: string): T | undefined {
  const entry = l1.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt <= Date.now()) {
    l1.delete(key);
    return undefined;
  }
  return entry.value as T;
}

function l1Set(key: string, value: unknown, ttlMs: number): void {
  if (l1.size >= L1_MAX) {
    const now = Date.now();
    for (const [candidate, entry] of l1) {
      if (entry.expiresAt <= now) l1.delete(candidate);
    }
    if (l1.size >= L1_MAX) l1.delete(l1.keys().next().value as string);
  }
  l1.set(key, { value, expiresAt: Date.now() + ttlMs });
}

export function tenantCacheKey(workspaceId: string, scope: string, ...parts: string[]): string {
  const digest = createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 24);
  return `cache:${workspaceId}:${scope}:${digest}`.slice(0, 240);
}

export function publicCacheKey(scope: string, ...parts: string[]): string {
  const digest = createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 24);
  return `cache:public:${scope}:${digest}`.slice(0, 240);
}

async function distributedGet<T>(key: string): Promise<T | undefined> {
  if (!hasServiceRole()) return undefined;
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.from("app_cache").select("value, expires_at").eq("cache_key", key).maybeSingle();
    if (error || !data) return undefined;
    if (new Date(data.expires_at).getTime() <= Date.now()) {
      await admin.from("app_cache").delete().eq("cache_key", key);
      return undefined;
    }
    return data.value as T;
  } catch (error) {
    logger.warn("cache.read_failed", { error });
    return undefined;
  }
}

async function distributedSet(
  key: string,
  workspaceId: string | null,
  value: unknown,
  ttlSeconds: number,
): Promise<void> {
  if (!hasServiceRole()) return;
  try {
    const admin = createAdminClient();
    const { error } = await admin.from("app_cache").upsert(
      {
        cache_key: key,
        workspace_id: workspaceId,
        value: value as never,
        expires_at: new Date(Date.now() + ttlSeconds * 1000).toISOString(),
      },
      { onConflict: "cache_key" },
    );
    if (error) logger.warn("cache.write_failed", { code: error.code });
  } catch (error) {
    logger.warn("cache.write_failed", { error });
  }
}

async function acquireLock(key: string, owner: string): Promise<boolean> {
  if (!hasServiceRole()) return true;
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("acquire_cache_lock", {
      p_key: key,
      p_owner: owner,
      p_ttl_seconds: 15,
    });
    return !error && data === true;
  } catch {
    return true;
  }
}

async function releaseLock(key: string, owner: string): Promise<void> {
  if (!hasServiceRole()) return;
  try {
    const admin = createAdminClient();
    await admin.rpc("release_cache_lock", { p_key: key, p_owner: owner });
  } catch {
    // The TTL expires the lock even if this best-effort release fails.
  }
}

async function waitForPeer<T>(key: string): Promise<T | undefined> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    const value = (await distributedGet<T>(key)) ?? l1Get<T>(key);
    if (value !== undefined) return value;
  }
  return undefined;
}

/**
 * Shared tenant cache with a short per-instance L1 and a Postgres L2. The fill
 * lock prevents a cold key from stampeding the database across instances.
 */
export async function withTenantCache<T>(
  key: string,
  workspaceId: string | null,
  ttlSeconds: number,
  loader: () => Promise<T>,
): Promise<T> {
  const local = l1Get<T>(key);
  if (local !== undefined) return local;

  const shared = await distributedGet<T>(key);
  if (shared !== undefined) {
    l1Set(key, shared, L1_TTL_MS);
    return shared;
  }

  const owner = `fill:${randomUUID()}`;
  if (!(await acquireLock(key, owner))) {
    const peer = await waitForPeer<T>(key);
    if (peer !== undefined) {
      l1Set(key, peer, L1_TTL_MS);
      return peer;
    }
  }

  try {
    const value = await loader();
    l1Set(key, value, L1_TTL_MS);
    await distributedSet(key, workspaceId, value, ttlSeconds);
    return value;
  } finally {
    await releaseLock(key, owner);
  }
}

export async function invalidateTenantCache(workspaceId: string): Promise<void> {
  for (const key of l1.keys()) {
    if (key.startsWith(`cache:${workspaceId}:`)) l1.delete(key);
  }
  if (!hasServiceRole()) return;
  try {
    const admin = createAdminClient();
    const { error } = await admin.from("app_cache").delete().eq("workspace_id", workspaceId);
    if (error) logger.warn("cache.invalidate_failed", { code: error.code });
  } catch (error) {
    logger.warn("cache.invalidate_failed", { error });
  }
}
