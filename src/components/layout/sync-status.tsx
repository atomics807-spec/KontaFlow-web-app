"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { CloudOff, RefreshCw } from "lucide-react";
import { countItems, flushOutbox } from "@/lib/offline/outbox";
import { useI18n } from "@/components/layout/i18n-provider";

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
  const online = useSyncExternalStore(
    subscribeConnection,
    () => navigator.onLine,
    () => true,
  );
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const refreshCount = () => {
      countItems()
        .then(setPending)
        .catch(() => setPending(0));
    };

    const flush = async () => {
      setSyncing(true);
      try {
        const result = await flushOutbox();
        if (result.synced > 0) router.refresh();
      } finally {
        setSyncing(false);
        refreshCount();
      }
    };

    refreshCount();
    if (navigator.onLine) void flush();

    const onOnline = () => {
      void flush();
    };

    window.addEventListener("online", onOnline);
    const interval = window.setInterval(() => {
      if (navigator.onLine) {
        refreshCount();
        void flush();
      }
    }, 45_000);

    return () => {
      window.removeEventListener("online", onOnline);
      window.clearInterval(interval);
    };
  }, [router]);

  if (online && pending === 0 && !syncing) {
    return (
      <span className="hidden items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-1 text-[0.7rem] font-semibold text-accent sm:inline-flex">
        <span className="h-1.5 w-1.5 rounded-full bg-jade-500" aria-hidden />
        {dict.common.online}
      </span>
    );
  }

  return (
    <span
      className={
        online
          ? "inline-flex items-center gap-1.5 rounded-full bg-warn-soft px-2.5 py-1 text-[0.7rem] font-semibold text-warn"
          : "inline-flex items-center gap-1.5 rounded-full bg-danger-soft px-2.5 py-1 text-[0.7rem] font-semibold text-danger"
      }
      role="status"
      aria-live="polite"
    >
      {online ? (
        <RefreshCw className={`h-3 w-3 ${syncing ? "animate-spin" : ""}`} aria-hidden />
      ) : (
        <CloudOff className="h-3 w-3" aria-hidden />
      )}
      {online
        ? `${dict.common.syncing} · ${pending}`
        : `${dict.common.offline} · ${pending}`}
    </span>
  );
}
