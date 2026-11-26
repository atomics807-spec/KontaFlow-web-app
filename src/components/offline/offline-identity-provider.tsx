"use client";

import { createContext, useContext, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  cleanupSyncedOutbox,
  offlineStorageAvailable,
  purgeAllOfflineData,
  purgeOtherOfflineUsers,
  saveOfflineSession,
  type OfflineIdentity,
} from "@/lib/offline/db";
import { refreshOfflineBootstrap } from "@/lib/offline/bootstrap";
import { requestBackgroundSync, syncOutbox } from "@/lib/offline/sync";
import { processAiQueue } from "@/lib/offline/ai";

const OfflineIdentityContext = createContext<OfflineIdentity | null>(null);

export function useOfflineIdentity(): OfflineIdentity | null {
  return useContext(OfflineIdentityContext);
}

/** Keeps the browser cache tied to exactly one authenticated account. */
export function OfflineUserGuard({ userId }: { userId: string }) {
  useEffect(() => {
    if (!offlineStorageAvailable()) return;
    void purgeOtherOfflineUsers(userId).catch(() => undefined);
  }, [userId]);
  return null;
}

export function OfflineIdentityProvider({
  identity,
  children,
}: {
  identity: OfflineIdentity;
  children: React.ReactNode;
}) {
  const router = useRouter();

  useEffect(() => {
    if (!offlineStorageAvailable()) return;
    let cancelled = false;

    const runSync = async () => {
      if (typeof navigator !== "undefined" && !navigator.onLine) return;
      const result = await syncOutbox(identity).catch(() => null);
      await processAiQueue(identity).catch(() => undefined);
      await refreshOfflineBootstrap(identity).catch(() => undefined);
      if (result && result.synced > 0) router.refresh();
    };

    const start = async () => {
      await purgeOtherOfflineUsers(identity.userId);
      await saveOfflineSession(identity);
      await cleanupSyncedOutbox();
      if (cancelled) return;
      await refreshOfflineBootstrap(identity);
      if (cancelled) return;
      await runSync();
    };

    void start();

    const onOnline = () => void runSync();
    const onVisible = () => {
      if (document.visibilityState === "visible") void runSync();
    };
    const onServiceWorker = (event: MessageEvent) => {
      if (event.data?.type === "KONTAFLOW_SYNC") void runSync();
    };

    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisible);
    navigator.serviceWorker?.addEventListener("message", onServiceWorker);
    const interval = window.setInterval(() => void runSync(), 30_000);
    void requestBackgroundSync();

    return () => {
      cancelled = true;
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisible);
      navigator.serviceWorker?.removeEventListener("message", onServiceWorker);
      window.clearInterval(interval);
    };
  }, [identity, router]);

  return <OfflineIdentityContext.Provider value={identity}>{children}</OfflineIdentityContext.Provider>;
}

export async function clearOfflineDataBeforeSignOut(): Promise<void> {
  if (!offlineStorageAvailable()) return;
  await purgeAllOfflineData();
}
