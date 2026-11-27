import {
  getBootstrapRefreshedAt,
  purgeOtherOfflineUsers,
  saveCachedOptions,
  saveCachedRecentTransactions,
  saveOfflineSession,
  type CachedTransaction,
  type OfflineIdentity,
  type OfflineSession,
} from "./db";
import type { AccountSubtype, CategoryKind, ContactKind } from "@/types/database";

const REFRESH_AFTER_MS = 12 * 60 * 60 * 1000;

type BootstrapResponse = {
  workspaceId: string;
  identity: OfflineIdentity;
  accounts: Array<{ id: string; name: string; subtype: AccountSubtype }>;
  categories: Array<{
    id: string;
    name: string;
    kind: CategoryKind;
    color: string;
    translations: Record<string, string> | null;
  }>;
  contacts: Array<{ id: string; name: string; kind: ContactKind }>;
  transactions: Array<Omit<CachedTransaction, "userId" | "workspaceId" | "cachedAt">>;
};

let inflight: Promise<boolean> | null = null;

/**
 * The offline page lives outside the dashboard shell, so it has no identity
 * prop. When it is opened online by an authenticated user, fetch the same
 * bootstrap payload and persist the session before the connection drops.
 */
export async function bootstrapOffline(locale: string): Promise<OfflineSession | null> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return null;

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(`/api/offline/bootstrap?locale=${encodeURIComponent(locale)}`, {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const body = (await response.json().catch(() => null)) as BootstrapResponse | null;
    if (!body?.identity || body.identity.workspaceId !== body.workspaceId) return null;

    await purgeOtherOfflineUsers(body.identity.userId).catch(() => undefined);
    await saveOfflineSession(body.identity);
    await saveCachedOptions(body.identity, body);
    await saveCachedRecentTransactions(body.identity, body.transactions);
    return { key: "active", ...body.identity, updatedAt: Date.now() };
  } catch {
    return null;
  } finally {
    window.clearTimeout(timeout);
  }
}

/**
 * One small authenticated request hydrates the offline cache. It is skipped if
 * the workspace cache is fresh, so normal navigation does not make extra API
 * requests.
 */
export async function refreshOfflineBootstrap(
  identity: OfflineIdentity,
  force = false,
): Promise<boolean> {
  if (inflight) return inflight;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return false;

  const refreshedAt = await getBootstrapRefreshedAt(identity.userId, identity.workspaceId);
  if (!force && refreshedAt > 0 && Date.now() - refreshedAt < REFRESH_AFTER_MS) return true;

  inflight = (async () => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15_000);
    try {
      const response = await fetch(`/api/offline/bootstrap?locale=${encodeURIComponent(identity.locale)}`, {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
        signal: controller.signal,
      });
      if (!response.ok) return false;
      const body = (await response.json().catch(() => null)) as BootstrapResponse | null;
      if (!body || body.workspaceId !== identity.workspaceId) return false;
      await saveCachedOptions(identity, body);
      await saveCachedRecentTransactions(identity, body.transactions);
      return true;
    } catch {
      return false;
    } finally {
      window.clearTimeout(timeout);
      inflight = null;
    }
  })();

  return inflight;
}
