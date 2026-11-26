import {
  cleanupSyncedOutbox,
  getDueOutboxItems,
  getOutboxItems,
  offlineStorageAvailable,
  recoverStaleSyncing,
  type OfflineIdentity,
  type OfflineOutboxItem,
} from "./db";
import { markOutboxStatus, updateOutboxItem } from "./outbox";
import { classifySyncFailure, nextRetryDelay } from "./policy";

type SyncResponseResult = {
  clientGeneratedId: string;
  status: "synced" | "duplicate" | "failed" | "conflict";
  code?: string;
  error?: string;
  transactionId?: string;
};

export type OutboxSyncResult = {
  attempted: number;
  synced: number;
  conflict: number;
  attention: number;
  failed: number;
  remaining: number;
  offline: boolean;
};

const EMPTY_RESULT: OutboxSyncResult = {
  attempted: 0,
  synced: 0,
  conflict: 0,
  attention: 0,
  failed: 0,
  remaining: 0,
  offline: false,
};

const inFlight = new Map<string, Promise<OutboxSyncResult>>();

function syncKey(identity: OfflineIdentity): string {
  return `${identity.userId}:${identity.workspaceId}`;
}

export function syncInProgress(identity: OfflineIdentity): boolean {
  return inFlight.has(syncKey(identity));
}

export async function requestBackgroundSync(): Promise<void> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  try {
    const registration = await navigator.serviceWorker.ready;
    const syncManager = (registration as ServiceWorkerRegistration & {
      sync?: { register: (tag: string) => Promise<void> };
    }).sync;
    await syncManager?.register("kontaflow-outbox");
  } catch {
    // Background Sync is optional; the active-page sync loop remains primary.
  }
}

async function postBatch(items: OfflineOutboxItem[]): Promise<Response> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 20_000);
  try {
    return await fetch("/api/sync", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        items: items.map((item) => ({
          clientGeneratedId: item.clientGeneratedId,
          workspaceId: item.workspaceId,
          currency: item.currency,
          kind: item.kind,
          amount: item.amount,
          description: item.description,
          occurredOn: item.occurredOn,
          categoryId: item.categoryId ?? null,
          accountId: item.accountId,
          counterAccountId: item.counterAccountId ?? null,
          contactId: item.contactId ?? null,
          paymentMethod: item.paymentMethod,
          reference: item.reference ?? null,
          attachment: item.attachment ?? null,
        })),
      }),
    });
  } finally {
    window.clearTimeout(timeout);
  }
}

async function retryLater(items: OfflineOutboxItem[], code: string, message: string): Promise<void> {
  const now = Date.now();
  for (const item of items) {
    const attempts = item.attempts + 1;
    await updateOutboxItem(item.clientGeneratedId, {
      status: "failed",
      attempts,
      nextAttemptAt: now + nextRetryDelay(attempts),
      lastErrorCode: code,
      lastErrorMessage: message,
    });
  }
}

async function needsAttention(items: OfflineOutboxItem[], code: string, message: string): Promise<void> {
  for (const item of items) {
    await updateOutboxItem(item.clientGeneratedId, {
      status: "attention",
      attempts: item.attempts + 1,
      nextAttemptAt: 0,
      lastErrorCode: code,
      lastErrorMessage: message,
    });
  }
}

async function runSync(identity: OfflineIdentity): Promise<OutboxSyncResult> {
  if (!offlineStorageAvailable()) return EMPTY_RESULT;
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return { ...EMPTY_RESULT, offline: true };
  }

  await recoverStaleSyncing();
  await cleanupSyncedOutbox();
  const items = await getDueOutboxItems(identity.userId, identity.workspaceId);
  if (items.length === 0) return EMPTY_RESULT;

  await markOutboxStatus(
    items.map((item) => item.clientGeneratedId),
    "syncing",
  );

  let response: Response;
  try {
    response = await postBatch(items);
  } catch {
    await retryLater(items, "network_error", "The connection dropped before this entry was sent.");
    return {
      ...EMPTY_RESULT,
      attempted: items.length,
      failed: items.length,
      remaining: items.length,
      offline: typeof navigator !== "undefined" && navigator.onLine === false,
    };
  }

  const body = (await response.json().catch(() => null)) as
    | { results?: SyncResponseResult[]; error?: string }
    | null;

  if (!response.ok) {
    const code = body?.error ?? (response.status === 401 ? "unauthenticated" : "server_error");
    if (classifySyncFailure(code, response.status) === "attention") {
      await needsAttention(items, code, body?.error ?? "This entry needs your attention before it can sync.");
      return { ...EMPTY_RESULT, attempted: items.length, attention: items.length, remaining: items.length };
    }
    await retryLater(items, code, body?.error ?? "The server is temporarily unavailable.");
    return { ...EMPTY_RESULT, attempted: items.length, failed: items.length, remaining: items.length };
  }

  const results = new Map((body?.results ?? []).map((result) => [result.clientGeneratedId, result]));
  let synced = 0;
  let conflict = 0;
  let attention = 0;
  let failed = 0;

  for (const item of items) {
    const result = results.get(item.clientGeneratedId);
    if (!result) {
      await retryLater([item], "server_error", "The server did not confirm this entry.");
      failed += 1;
      continue;
    }

    if (result.status === "synced" || result.status === "duplicate") {
      await updateOutboxItem(item.clientGeneratedId, {
        status: "synced",
        attempts: item.attempts + 1,
        nextAttemptAt: 0,
        lastErrorCode: null,
        lastErrorMessage: null,
        serverTransactionId: result.transactionId ?? null,
        syncedAt: Date.now(),
      });
      synced += 1;
      continue;
    }

    if (result.status === "conflict") {
      await needsAttention(
        [item],
        result.code ?? "conflict",
        result.error ?? "This entry conflicts with a financial record on the server.",
      );
      conflict += 1;
      attention += 1;
      continue;
    }

    const code = result.code ?? "server_error";
    if (classifySyncFailure(code, response.status) === "attention") {
      await needsAttention([item], code, result.error ?? "This entry needs your attention.");
      attention += 1;
    } else {
      await retryLater([item], code, result.error ?? "Could not sync this entry.");
      failed += 1;
    }
  }

  // A UUID collision with a different amount/description is never treated as a
  // successful duplicate. The API returns a conflict and the local record stays
  // visible with the server response for human review.
  return {
    attempted: items.length,
    synced,
    conflict,
    attention,
    failed,
    remaining: items.length - synced,
    offline: false,
  };
}

/** Single-flight so online/visibility/timer/Background Sync cannot double-send. */
export function syncOutbox(identity: OfflineIdentity): Promise<OutboxSyncResult> {
  const key = syncKey(identity);
  const existing = inFlight.get(key);
  if (existing) return existing;
  const promise = runSync(identity).finally(() => inFlight.delete(key));
  inFlight.set(key, promise);
  return promise;
}

export async function retryAllOutbox(identity: OfflineIdentity): Promise<OutboxSyncResult> {
  if (!offlineStorageAvailable()) return EMPTY_RESULT;
  const items = (await getOutboxItems(identity.userId, identity.workspaceId, 500)).filter(
    (item) => item.status !== "synced" && item.status !== "syncing",
  );
  if (items.length === 0) return EMPTY_RESULT;
  await markOutboxStatus(
    items.map((item) => item.clientGeneratedId),
    "pending",
    { nextAttemptAt: 0, attempts: 0, lastErrorCode: null, lastErrorMessage: null },
  );
  await requestBackgroundSync();
  return syncOutbox(identity);
}
