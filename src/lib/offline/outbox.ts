import {
  getOutboxItems,
  newClientId,
  notifyOfflineChange,
  offlineDb,
  offlineStorageAvailable,
  type OfflineIdentity,
  type OfflineOutboxItem,
  type OfflineSyncStatus,
  type OutboxAttachment,
} from "./db";

export { newClientId };
export type { OfflineOutboxItem, OutboxAttachment };

export type NewOutboxItem = Omit<
  OfflineOutboxItem,
  "userId" | "status" | "attempts" | "createdAt" | "updatedAt" | "nextAttemptAt"
>;

export async function enqueueTransaction(
  identity: OfflineIdentity,
  input: NewOutboxItem,
): Promise<OfflineOutboxItem> {
  if (!offlineStorageAvailable()) throw new Error("Offline storage is unavailable on this device.");
  const now = Date.now();
  const item: OfflineOutboxItem = {
    ...input,
    clientGeneratedId: input.clientGeneratedId || newClientId(),
    userId: identity.userId,
    workspaceId: identity.workspaceId,
    status: "pending",
    attempts: 0,
    createdAt: now,
    updatedAt: now,
    nextAttemptAt: 0,
  };
  await offlineDb().outbox.put(item);
  notifyOfflineChange();
  return item;
}

export async function updateOutboxItem(
  clientGeneratedId: string,
  patch: Partial<
    Pick<
      OfflineOutboxItem,
      | "status"
      | "attempts"
      | "nextAttemptAt"
      | "lastErrorCode"
      | "lastErrorMessage"
      | "serverTransactionId"
      | "syncedAt"
      | "updatedAt"
    >
  >,
): Promise<void> {
  if (!offlineStorageAvailable()) return;
  await offlineDb().outbox.update(clientGeneratedId, { ...patch, updatedAt: Date.now() });
  notifyOfflineChange();
}

export async function markOutboxStatus(
  ids: string[],
  status: OfflineSyncStatus,
  patch: Partial<OfflineOutboxItem> = {},
): Promise<void> {
  if (!offlineStorageAvailable() || ids.length === 0) return;
  await offlineDb()
    .outbox.where("clientGeneratedId")
    .anyOf(ids)
    .modify({ ...patch, status, updatedAt: Date.now() });
  notifyOfflineChange();
}

export async function retryOutboxItem(clientGeneratedId: string): Promise<void> {
  await updateOutboxItem(clientGeneratedId, {
    status: "pending",
    nextAttemptAt: 0,
    lastErrorCode: null,
    lastErrorMessage: null,
  });
}

export async function removeOutboxItem(clientGeneratedId: string): Promise<void> {
  if (!offlineStorageAvailable()) return;
  await offlineDb().outbox.delete(clientGeneratedId);
  notifyOfflineChange();
}

export async function getOutboxItem(clientGeneratedId: string): Promise<OfflineOutboxItem | undefined> {
  if (!offlineStorageAvailable()) return undefined;
  return offlineDb().outbox.get(clientGeneratedId);
}

export async function listOutboxItems(
  userId: string,
  workspaceId: string,
  limit = 50,
): Promise<OfflineOutboxItem[]> {
  return getOutboxItems(userId, workspaceId, limit);
}
