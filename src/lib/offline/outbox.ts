/**
 * Write-ahead outbox for transactions recorded on this device.
 *
 * Every entry is written to IndexedDB before the network is touched, so a
 * dropped connection (common on mobile money networks) never loses a sale.
 * Each entry carries a client_generated_id, which the database uses to make
 * retries idempotent.
 */
export type OutboxAttachment = {
  path: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
};

export type OutboxItem = {
  clientGeneratedId: string;
  workspaceId: string;
  currency: string;
  kind: "income" | "expense" | "transfer";
  amount: string;
  description: string;
  occurredOn: string;
  categoryId?: string | null;
  accountId: string;
  counterAccountId?: string | null;
  contactId?: string | null;
  paymentMethod: "cash" | "mobile_money" | "bank_transfer" | "card" | "cheque" | "other";
  reference?: string | null;
  attachment?: OutboxAttachment | null;
  createdAt: number;
  attempts: number;
  lastError?: string;
};

const DB_NAME = "kontaflow";
const DB_VERSION = 1;
const STORE = "outbox";

function available(): boolean {
  return typeof indexedDB !== "undefined";
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "clientGeneratedId" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const request = run(tx.objectStore(STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

export function newClientId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function queueItem(item: OutboxItem): Promise<void> {
  if (!available()) throw new Error("Offline storage is unavailable on this device.");
  await withStore("readwrite", (store) => store.put(item));
}

export async function listItems(): Promise<OutboxItem[]> {
  if (!available()) return [];
  const items = await withStore<OutboxItem[]>("readonly", (store) => store.getAll() as IDBRequest<OutboxItem[]>);
  return items.sort((a, b) => a.createdAt - b.createdAt);
}

export async function countItems(): Promise<number> {
  if (!available()) return 0;
  return withStore<number>("readonly", (store) => store.count());
}

export async function removeItem(clientGeneratedId: string): Promise<void> {
  if (!available()) return;
  await withStore("readwrite", (store) => store.delete(clientGeneratedId));
}

export type FlushResult = { synced: number; failed: number; remaining: number; errors: string[] };

/** Sends every queued item to /api/sync; idempotent on the server. */
export async function flushOutbox(): Promise<FlushResult> {
  const items = await listItems();
  if (items.length === 0) return { synced: 0, failed: 0, remaining: 0, errors: [] };
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return { synced: 0, failed: 0, remaining: items.length, errors: [] };
  }

  let response: Response;
  try {
    response = await fetch("/api/sync", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ items }),
    });
  } catch {
    return { synced: 0, failed: 0, remaining: items.length, errors: [] };
  }

  if (!response.ok) return { synced: 0, failed: 0, remaining: items.length, errors: [] };

  const body = (await response.json().catch(() => null)) as
    | { results?: { clientGeneratedId: string; status: "synced" | "duplicate" | "failed"; error?: string }[] }
    | null;

  const results = body?.results ?? [];
  let synced = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const result of results) {
    if (result.status === "synced" || result.status === "duplicate") {
      synced += 1;
      await removeItem(result.clientGeneratedId);
    } else {
      failed += 1;
      if (result.error) errors.push(result.error);
      const item = items.find((entry) => entry.clientGeneratedId === result.clientGeneratedId);
      if (item) {
        await queueItem({ ...item, attempts: item.attempts + 1, lastError: result.error });
      }
    }
  }

  return { synced, failed, remaining: await countItems(), errors };
}
