"use client";

import { useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CloudOff, RefreshCw } from "lucide-react";
import { useI18n } from "@/components/layout/i18n-provider";
import { useOfflineIdentity } from "@/components/offline/offline-identity-provider";
import { useOutboxItems } from "@/components/offline/use-offline-outbox";
import { retryAllOutbox, syncOutbox } from "@/lib/offline/sync";

function subscribeConnection(callback: () => void): () => void {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

export function SyncStatus() {
  const { dict } = useI18n();
  const router = useRouter();
  const identity = useOfflineIdentity();
  const items = useOutboxItems(identity, 100);
  const [busy, setBusy] = useState(false);
  const online = useSyncExternalStore(
    subscribeConnection,
    () => navigator.onLine,
    () => true,
  );

  const pending = items.filter((item) => item.status === "pending" || item.status === "failed").length;
  const syncing = items.filter((item) => item.status === "syncing").length;
  const attention = items.filter((item) => item.status === "attention").length;
  const busyNow = busy || syncing > 0;

  const retry = async () => {
    if (!identity || busyNow) return;
    setBusy(true);
    try {
      const result = await retryAllOutbox(identity);
      if (result.synced > 0) router.refresh();
    } finally {
      setBusy(false);
    }
  };

  const runNow = async () => {
    if (!identity || busyNow) return;
    setBusy(true);
    try {
      const result = await syncOutbox(identity);
      if (result.synced > 0) router.refresh();
    } finally {
      setBusy(false);
    }
  };

  if (online && pending === 0 && attention === 0 && !busyNow) {
    return (
      <span className="hidden items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-1 text-[0.7rem] font-semibold text-accent sm:inline-flex">
        <span className="h-1.5 w-1.5 rounded-full bg-jade-500" aria-hidden />
        {dict.common.online}
      </span>
    );
  }

  const needsAttention = attention > 0;
  const count = pending + attention;

  return (
    <span className="inline-flex items-center gap-1" role="status" aria-live="polite">
      <span
        className={
          !online
            ? "inline-flex items-center gap-1.5 rounded-full bg-danger-soft px-2.5 py-1 text-[0.7rem] font-semibold text-danger"
            : needsAttention
              ? "inline-flex items-center gap-1.5 rounded-full bg-danger-soft px-2.5 py-1 text-[0.7rem] font-semibold text-danger"
              : "inline-flex items-center gap-1.5 rounded-full bg-warn-soft px-2.5 py-1 text-[0.7rem] font-semibold text-warn"
        }
      >
        {!online ? (
          <CloudOff className="h-3 w-3" aria-hidden />
        ) : needsAttention ? (
          <AlertTriangle className="h-3 w-3" aria-hidden />
        ) : (
          <RefreshCw className={`h-3 w-3 ${busyNow ? "animate-spin" : ""}`} aria-hidden />
        )}
        {!online
          ? `${dict.common.offline} · ${count}`
          : needsAttention
            ? `${dict.pwa.needsAttention} · ${attention}`
            : busyNow
              ? `${dict.common.syncing} · ${count}`
              : `${dict.pwa.queued} · ${count}`}
      </span>
      {online && (pending > 0 || attention > 0) ? (
        <button
          type="button"
          onClick={needsAttention ? () => void retry() : () => void runNow()}
          disabled={busyNow}
          aria-label={dict.pwa.retrySync}
          title={dict.pwa.retrySync}
          className="grid h-6 w-6 place-items-center rounded-full text-muted transition hover:bg-page hover:text-heading disabled:opacity-40"
        >
          <RefreshCw className={`h-3 w-3 ${busyNow ? "animate-spin" : ""}`} aria-hidden />
        </button>
      ) : null}
    </span>
  );
}
