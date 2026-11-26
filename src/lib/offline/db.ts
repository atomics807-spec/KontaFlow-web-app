import Dexie, { type Table } from "dexie";
import type { AccountSubtype, CategoryKind, ContactKind, TransactionKind, WorkspaceRole } from "@/types/database";
import type { AiCommandView } from "@/lib/ai/types";

export const OFFLINE_DB_NAME = "kontaflow-offline";
export const OFFLINE_CHANGE_EVENT = "kontaflow:offline-change";
const LEGACY_USER = "__legacy__";

export type OfflineIdentity = {
  userId: string;
  workspaceId: string;
  workspaceName: string;
  currency: string;
  timezone: string;
  role: WorkspaceRole;
  locale: string;
};

export type OfflineSession = OfflineIdentity & { key: "active"; updatedAt: number };

export type OfflineSyncStatus = "pending" | "syncing" | "synced" | "failed" | "attention";

export type OutboxAttachment = {
  path: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
};

export type OfflineOutboxItem = {
  clientGeneratedId: string;
  userId: string;
  workspaceId: string;
  currency: string;
  kind: TransactionKind;
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
  status: OfflineSyncStatus;
  attempts: number;
  createdAt: number;
  updatedAt: number;
  nextAttemptAt: number;
  lastErrorCode?: string | null;
  lastErrorMessage?: string | null;
  serverTransactionId?: string | null;
  syncedAt?: number | null;
};

export type CachedAccount = {
  id: string;
  userId: string;
  workspaceId: string;
  name: string;
  subtype: AccountSubtype;
  cachedAt: number;
};

export type CachedCategory = {
  id: string;
  userId: string;
  workspaceId: string;
  name: string;
  kind: CategoryKind;
  color: string;
  translations: Record<string, string> | null;
  cachedAt: number;
};

export type CachedContact = {
  id: string;
  userId: string;
  workspaceId: string;
  name: string;
  kind: ContactKind;
  cachedAt: number;
};

export type CachedTransaction = {
  id: string;
  userId: string;
  workspaceId: string;
  kind: TransactionKind;
  amountMinor: string;
  currency: string;
  occurredOn: string;
  description: string;
  categoryName: string | null;
  accountName: string | null;
  status: string;
  channel: string;
  cachedAt: number;
};

export type OfflinePreference = {
  key: string;
  userId: string;
  name: string;
  value: string | number | boolean;
  updatedAt: number;
};

export type OfflineBootstrapMeta = {
  key: string;
  userId: string;
  workspaceId: string;
  refreshedAt: number;
};

export type OfflineAiStatus = "queued" | "processing" | "ready" | "attention";

export type OfflineAiCommand = {
  id: string;
  userId: string;
  workspaceId: string;
  message: string;
  locale: string;
  conversationId: string | null;
  status: OfflineAiStatus;
  reply: string | null;
  command: AiCommandView | null;
  attempts: number;
  nextAttemptAt: number;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  createdAt: number;
  updatedAt: number;
};

class KontaFlowOfflineDB extends Dexie {
  outbox!: Table<OfflineOutboxItem, string>;
  accounts!: Table<CachedAccount, string>;
  categories!: Table<CachedCategory, string>;
  contacts!: Table<CachedContact, string>;
  recentTransactions!: Table<CachedTransaction, string>;
  aiCommands!: Table<OfflineAiCommand, string>;
  preferences!: Table<OfflinePreference, string>;
  bootstrapMeta!: Table<OfflineBootstrapMeta, string>;
  session!: Table<OfflineSession, string>;

  constructor() {
    super(OFFLINE_DB_NAME);

    this.version(1).stores({ outbox: "clientGeneratedId" });

    this.version(2)
      .stores({
        outbox:
          "clientGeneratedId, userId, workspaceId, status, createdAt, nextAttemptAt, [userId+workspaceId]",
        accounts: "id, userId, workspaceId, [userId+workspaceId]",
        categories: "id, userId, workspaceId, [userId+workspaceId]",
        contacts: "id, userId, workspaceId, [userId+workspaceId]",
        recentTransactions: "id, userId, workspaceId, [userId+workspaceId], occurredOn",
        aiCommands: "id, userId, workspaceId, status, [userId+workspaceId], createdAt",
        preferences: "key, userId, name",
        bootstrapMeta: "key, userId, workspaceId",
        session: "key",
      })
      .upgrade(async (transaction) => {
        await transaction
          .table("outbox")
          .toCollection()
          .modify((item: Record<string, unknown>) => {
            item.userId ??= LEGACY_USER;
            item.workspaceId ??= "";
            item.status ??= "pending";
            item.attempts ??= 0;
            item.createdAt ??= Date.now();
            item.updatedAt ??= item.createdAt;
            item.nextAttemptAt ??= 0;
          });
      });
  }
}

let database: KontaFlowOfflineDB | null = null;

export function offlineStorageAvailable(): boolean {
  return typeof indexedDB !== "undefined";
}

export function offlineDb(): KontaFlowOfflineDB {
  if (!offlineStorageAvailable()) throw new Error("Offline storage is unavailable on this device.");
  database ??= new KontaFlowOfflineDB();
  return database;
}

export function notifyOfflineChange(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(OFFLINE_CHANGE_EVENT));
}

export function newClientId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function saveOfflineSession(identity: OfflineIdentity): Promise<void> {
  if (!offlineStorageAvailable()) return;
  const db = offlineDb();
  await db.transaction("rw", db.session, db.outbox, async () => {
    await db.session.put({ key: "active", ...identity, updatedAt: Date.now() });
    const legacy = await db.outbox.where("userId").equals(LEGACY_USER).toArray();
    const matching = legacy.filter((item) => item.workspaceId === identity.workspaceId);
    if (matching.length > 0) {
      await db.outbox.bulkPut(
        matching.map((item) => ({ ...item, userId: identity.userId, updatedAt: Date.now() })),
      );
    }
  });
}

export async function getOfflineSession(): Promise<OfflineSession | null> {
  if (!offlineStorageAvailable()) return null;
  return (await offlineDb().session.get("active")) ?? null;
}

/**
 * A shared browser may still hold rows from a previous account. Purge every
 * user-scoped table before the current account starts using the device.
 */
export async function purgeOtherOfflineUsers(currentUserId: string): Promise<void> {
  if (!offlineStorageAvailable()) return;
  const db = offlineDb();
  await db.transaction(
    "rw",
    [
      db.outbox,
      db.accounts,
      db.categories,
      db.contacts,
      db.recentTransactions,
      db.aiCommands,
      db.preferences,
      db.bootstrapMeta,
      db.session,
    ],
    async () => {
      const tables = [
        db.outbox,
        db.accounts,
        db.categories,
        db.contacts,
        db.recentTransactions,
        db.aiCommands,
        db.preferences,
        db.bootstrapMeta,
      ];
      for (const table of tables) {
        await table.where("userId").notEqual(currentUserId).delete();
      }
      const session = await db.session.get("active");
      if (session && session.userId !== currentUserId) await db.session.delete("active");
    },
  );
  notifyOfflineChange();
}

export async function purgeOfflineUser(userId: string): Promise<void> {
  if (!offlineStorageAvailable()) return;
  const db = offlineDb();
  await db.transaction(
    "rw",
    [
      db.outbox,
      db.accounts,
      db.categories,
      db.contacts,
      db.recentTransactions,
      db.aiCommands,
      db.preferences,
      db.bootstrapMeta,
    ],
    async () => {
      const tables = [
        db.outbox,
        db.accounts,
        db.categories,
        db.contacts,
        db.recentTransactions,
        db.aiCommands,
        db.preferences,
        db.bootstrapMeta,
      ];
      for (const table of tables) {
        await table.where("userId").equals(userId).delete();
      }
    },
  );
  const session = await db.session.get("active");
  if (session?.userId === userId) await db.session.delete("active");
  notifyOfflineChange();
}

/** Used by sign-out. It removes every cached business record from this browser. */
export async function purgeAllOfflineData(): Promise<void> {
  if (!offlineStorageAvailable()) return;
  const db = offlineDb();
  await db.transaction(
    "rw",
    [
      db.outbox,
      db.accounts,
      db.categories,
      db.contacts,
      db.recentTransactions,
      db.aiCommands,
      db.preferences,
      db.bootstrapMeta,
      db.session,
    ],
    async () => {
      await Promise.all(db.tables.map((table) => table.clear()));
    },
  );
  notifyOfflineChange();
}

export async function saveCachedOptions(
  identity: OfflineIdentity,
  data: {
    accounts: Array<{ id: string; name: string; subtype: AccountSubtype }>;
    categories: Array<{
      id: string;
      name: string;
      kind: CategoryKind;
      color: string;
      translations?: Record<string, string> | null;
    }>;
    contacts: Array<{ id: string; name: string; kind: ContactKind }>;
  },
): Promise<void> {
  if (!offlineStorageAvailable()) return;
  const db = offlineDb();
  const now = Date.now();
  await db.transaction(
    "rw",
    [db.accounts, db.categories, db.contacts, db.bootstrapMeta],
    async () => {
      await db.accounts
        .where("[userId+workspaceId]")
        .equals([identity.userId, identity.workspaceId])
        .delete();
      await db.categories
        .where("[userId+workspaceId]")
        .equals([identity.userId, identity.workspaceId])
        .delete();
      await db.contacts
        .where("[userId+workspaceId]")
        .equals([identity.userId, identity.workspaceId])
        .delete();
      await db.accounts.bulkPut(
        data.accounts.map((row) => ({
          id: row.id,
          userId: identity.userId,
          workspaceId: identity.workspaceId,
          name: row.name,
          subtype: row.subtype,
          cachedAt: now,
        })),
      );
      await db.categories.bulkPut(
        data.categories.map((row) => ({
          id: row.id,
          userId: identity.userId,
          workspaceId: identity.workspaceId,
          name: row.name,
          kind: row.kind,
          color: row.color,
          translations: row.translations ?? null,
          cachedAt: now,
        })),
      );
      await db.contacts.bulkPut(
        data.contacts.map((row) => ({
          id: row.id,
          userId: identity.userId,
          workspaceId: identity.workspaceId,
          name: row.name,
          kind: row.kind,
          cachedAt: now,
        })),
      );
      await db.bootstrapMeta.put({
        key: `${identity.userId}:${identity.workspaceId}`,
        userId: identity.userId,
        workspaceId: identity.workspaceId,
        refreshedAt: now,
      });
    },
  );
  notifyOfflineChange();
}

export async function saveCachedRecentTransactions(
  identity: OfflineIdentity,
  rows: Array<Omit<CachedTransaction, "userId" | "workspaceId" | "cachedAt">>,
): Promise<void> {
  if (!offlineStorageAvailable()) return;
  const db = offlineDb();
  const now = Date.now();
  await db.recentTransactions
    .where("[userId+workspaceId]")
    .equals([identity.userId, identity.workspaceId])
    .delete();
  await db.recentTransactions.bulkPut(
    rows.map((row) => ({
      ...row,
      userId: identity.userId,
      workspaceId: identity.workspaceId,
      cachedAt: now,
    })),
  );
  notifyOfflineChange();
}

export async function getBootstrapRefreshedAt(userId: string, workspaceId: string): Promise<number> {
  if (!offlineStorageAvailable()) return 0;
  const row = await offlineDb().bootstrapMeta.get(`${userId}:${workspaceId}`);
  return row?.refreshedAt ?? 0;
}

export async function getCachedOptions(
  userId: string,
  workspaceId: string,
): Promise<{
  accounts: CachedAccount[];
  categories: CachedCategory[];
  contacts: CachedContact[];
}> {
  if (!offlineStorageAvailable()) return { accounts: [], categories: [], contacts: [] };
  const db = offlineDb();
  const [accounts, categories, contacts] = await Promise.all([
    db.accounts.where("[userId+workspaceId]").equals([userId, workspaceId]).toArray(),
    db.categories.where("[userId+workspaceId]").equals([userId, workspaceId]).toArray(),
    db.contacts.where("[userId+workspaceId]").equals([userId, workspaceId]).toArray(),
  ]);
  return {
    accounts: accounts.sort((a, b) => a.name.localeCompare(b.name)),
    categories: categories.sort((a, b) => a.name.localeCompare(b.name)),
    contacts: contacts.sort((a, b) => a.name.localeCompare(b.name)),
  };
}

export async function getCachedRecentTransactions(
  userId: string,
  workspaceId: string,
): Promise<CachedTransaction[]> {
  if (!offlineStorageAvailable()) return [];
  return offlineDb()
    .recentTransactions.where("[userId+workspaceId]")
    .equals([userId, workspaceId])
    .reverse()
    .sortBy("occurredOn");
}

export async function getOutboxItems(
  userId: string,
  workspaceId: string,
  limit = 50,
): Promise<OfflineOutboxItem[]> {
  if (!offlineStorageAvailable()) return [];
  const items = await offlineDb()
    .outbox.where("[userId+workspaceId]")
    .equals([userId, workspaceId])
    .toArray();
  return items.sort((a, b) => b.createdAt - a.createdAt).slice(0, limit);
}

export async function getDueOutboxItems(
  userId: string,
  workspaceId: string,
  now = Date.now(),
): Promise<OfflineOutboxItem[]> {
  if (!offlineStorageAvailable()) return [];
  const items = await offlineDb()
    .outbox.where("[userId+workspaceId]")
    .equals([userId, workspaceId])
    .toArray();
  return items
    .filter(
      (item) =>
        (item.status === "pending" || item.status === "failed") &&
        item.nextAttemptAt <= now,
    )
    .sort((a, b) => a.createdAt - b.createdAt)
    .slice(0, 100);
}

export async function countPendingOutbox(userId: string, workspaceId: string): Promise<number> {
  if (!offlineStorageAvailable()) return 0;
  const items = await getOutboxItems(userId, workspaceId, 500);
  return items.filter((item) => item.status !== "synced").length;
}

export async function recoverStaleSyncing(maxAgeMs = 2 * 60 * 1000): Promise<void> {
  if (!offlineStorageAvailable()) return;
  const cutoff = Date.now() - maxAgeMs;
  await offlineDb()
    .outbox.filter((item) => item.status === "syncing" && item.updatedAt < cutoff)
    .modify({
      status: "failed",
      nextAttemptAt: 0,
      lastErrorCode: "interrupted",
      lastErrorMessage: "The app closed before this entry finished syncing.",
      updatedAt: Date.now(),
    });
}

export async function cleanupSyncedOutbox(maxAgeMs = 7 * 24 * 60 * 60 * 1000): Promise<void> {
  if (!offlineStorageAvailable()) return;
  const cutoff = Date.now() - maxAgeMs;
  await offlineDb()
    .outbox.filter((item) => item.status === "synced" && (item.syncedAt ?? item.updatedAt) < cutoff)
    .delete();
}

export async function getPreference<T extends string | number | boolean>(
  userId: string,
  name: string,
  fallback: T,
): Promise<T> {
  if (!offlineStorageAvailable()) return fallback;
  const row = await offlineDb().preferences.get(`${userId}:${name}`);
  return (row?.value as T | undefined) ?? fallback;
}

export async function setPreference(
  userId: string,
  name: string,
  value: string | number | boolean,
): Promise<void> {
  if (!offlineStorageAvailable()) return;
  await offlineDb().preferences.put({
    key: `${userId}:${name}`,
    userId,
    name,
    value,
    updatedAt: Date.now(),
  });
}

export async function getAiCommands(
  userId: string,
  workspaceId: string,
  limit = 20,
): Promise<OfflineAiCommand[]> {
  if (!offlineStorageAvailable()) return [];
  const items = await offlineDb()
    .aiCommands.where("[userId+workspaceId]")
    .equals([userId, workspaceId])
    .toArray();
  return items.sort((a, b) => b.createdAt - a.createdAt).slice(0, limit);
}

export async function saveAiCommand(command: OfflineAiCommand): Promise<void> {
  if (!offlineStorageAvailable()) return;
  await offlineDb().aiCommands.put(command);
  notifyOfflineChange();
}

export async function deleteAiCommand(id: string): Promise<void> {
  if (!offlineStorageAvailable()) return;
  await offlineDb().aiCommands.delete(id);
  notifyOfflineChange();
}
