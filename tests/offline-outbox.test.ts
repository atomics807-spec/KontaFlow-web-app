import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import {
  getCachedOptions,
  getDueOutboxItems,
  getOfflineSession,
  getOutboxItems,
  offlineDb,
  purgeAllOfflineData,
  purgeOtherOfflineUsers,
  recoverStaleSyncing,
  saveCachedOptions,
  saveOfflineSession,
  type OfflineIdentity,
} from "@/lib/offline/db";
import { enqueueTransaction, retryOutboxItem, updateOutboxItem } from "@/lib/offline/outbox";

const identity: OfflineIdentity = {
  userId: "11111111-1111-4111-8111-111111111111",
  workspaceId: "22222222-2222-4222-8222-222222222222",
  workspaceName: "Buea Fresh Foods",
  currency: "XAF",
  timezone: "Africa/Douala",
  role: "owner",
  locale: "en",
};

const otherIdentity: OfflineIdentity = {
  ...identity,
  userId: "33333333-3333-4333-8333-333333333333",
  workspaceId: "44444444-4444-4444-8444-444444444444",
  workspaceName: "Limbe Hardware",
};

function entry(overrides: Partial<Parameters<typeof enqueueTransaction>[1]> = {}) {
  return {
    clientGeneratedId: crypto.randomUUID(),
    workspaceId: identity.workspaceId,
    currency: identity.currency,
    kind: "expense" as const,
    amount: "1,500",
    description: "Transport to Douala",
    occurredOn: "2026-11-26",
    categoryId: "55555555-5555-4555-8555-555555555555",
    accountId: "66666666-6666-4666-8666-666666666666",
    counterAccountId: null,
    contactId: null,
    paymentMethod: "cash" as const,
    reference: null,
    attachment: null,
    ...overrides,
  };
}

beforeEach(async () => {
  await Promise.all(offlineDb().tables.map((table) => table.clear()));
});

describe("offline outbox", () => {
  it("persists a pending entry scoped to the active user and workspace", async () => {
    const item = await enqueueTransaction(identity, entry());

    expect(item.status).toBe("pending");
    expect(item.attempts).toBe(0);
    expect(item.userId).toBe(identity.userId);

    const due = await getDueOutboxItems(identity.userId, identity.workspaceId);
    expect(due.map((row) => row.clientGeneratedId)).toEqual([item.clientGeneratedId]);

    const otherWorkspace = await getOutboxItems(otherIdentity.userId, otherIdentity.workspaceId);
    expect(otherWorkspace).toHaveLength(0);
  });

  it("keeps failed entries out of the due queue until their retry time", async () => {
    const item = await enqueueTransaction(identity, entry());
    await updateOutboxItem(item.clientGeneratedId, {
      status: "failed",
      attempts: 1,
      nextAttemptAt: Date.now() + 60_000,
      lastErrorCode: "network_error",
    });

    expect(await getDueOutboxItems(identity.userId, identity.workspaceId)).toHaveLength(0);
    expect(await getDueOutboxItems(identity.userId, identity.workspaceId, Date.now() + 61_000)).toHaveLength(1);

    await retryOutboxItem(item.clientGeneratedId);
    const due = await getDueOutboxItems(identity.userId, identity.workspaceId);
    expect(due[0]?.status).toBe("pending");
    expect(due[0]?.lastErrorCode).toBeNull();
  });

  it("recovers entries left in syncing after an interrupted app session", async () => {
    const item = await enqueueTransaction(identity, entry());
    await updateOutboxItem(item.clientGeneratedId, { status: "syncing" });
    await offlineDb().outbox.update(item.clientGeneratedId, { updatedAt: Date.now() - 5 * 60_000 });

    await recoverStaleSyncing();
    const rows = await getOutboxItems(identity.userId, identity.workspaceId);
    expect(rows[0]?.status).toBe("failed");
    expect(rows[0]?.lastErrorCode).toBe("interrupted");
  });

  it("purges another account's cached data from a shared browser", async () => {
    await saveOfflineSession(otherIdentity);
    await saveCachedOptions(otherIdentity, {
      accounts: [{ id: "77777777-7777-4777-8777-777777777777", name: "Cash", subtype: "cash" }],
      categories: [],
      contacts: [],
    });
    await enqueueTransaction(otherIdentity, entry({ workspaceId: otherIdentity.workspaceId }));

    await purgeOtherOfflineUsers(identity.userId);

    expect(await getOfflineSession()).toBeNull();
    const cached = await getCachedOptions(otherIdentity.userId, otherIdentity.workspaceId);
    expect(cached.accounts).toHaveLength(0);
    expect(await getOutboxItems(otherIdentity.userId, otherIdentity.workspaceId)).toHaveLength(0);
  });

  it("clears every table when the user signs out", async () => {
    await saveOfflineSession(identity);
    await enqueueTransaction(identity, entry());
    await saveCachedOptions(identity, {
      accounts: [{ id: "77777777-7777-4777-8777-777777777777", name: "Cash", subtype: "cash" }],
      categories: [],
      contacts: [],
    });

    await purgeAllOfflineData();

    expect(await getOfflineSession()).toBeNull();
    expect(await getOutboxItems(identity.userId, identity.workspaceId)).toHaveLength(0);
    const cached = await getCachedOptions(identity.userId, identity.workspaceId);
    expect(cached.accounts).toHaveLength(0);
  });
});
