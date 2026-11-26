"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Clock3, CloudOff, RefreshCw } from "lucide-react";
import { useI18n } from "@/components/layout/i18n-provider";
import { useOfflineIdentity } from "@/components/offline/offline-identity-provider";
import { useOutboxItems } from "@/components/offline/use-offline-outbox";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatMoney, moneyLocale, parseMoneyToMinor } from "@/lib/money";
import { removeOutboxItem, retryOutboxItem } from "@/lib/offline/outbox";
import { syncOutbox } from "@/lib/offline/sync";
import type { OfflineIdentity, OfflineOutboxItem, OfflineSyncStatus } from "@/lib/offline/db";

const STATUS_TONE: Record<OfflineSyncStatus, "mango" | "jade" | "clay" | "outline"> = {
  pending: "mango",
  syncing: "mango",
  synced: "jade",
  failed: "clay",
  attention: "clay",
};

export function OfflineOutboxPanel({
  compact = false,
  session,
}: {
  compact?: boolean;
  session?: OfflineIdentity | null;
}) {
  const { locale, dict } = useI18n();
  const router = useRouter();
  const contextIdentity = useOfflineIdentity();
  const identity = session ?? contextIdentity;
  const items = useOutboxItems(identity, compact ? 5 : 12);
  const [busy, setBusy] = useState<string | null>(null);

  if (!identity || items.length === 0) return null;

  const statusLabel = (status: OfflineSyncStatus) =>
    status === "pending"
      ? dict.pwa.statusPending
      : status === "syncing"
        ? dict.pwa.statusSyncing
        : status === "synced"
          ? dict.pwa.statusSynced
          : status === "attention"
            ? dict.pwa.statusAttention
            : dict.pwa.statusFailed;

  const retry = async (item: OfflineOutboxItem) => {
    if (busy) return;
    setBusy(item.clientGeneratedId);
    try {
      await retryOutboxItem(item.clientGeneratedId);
      const result = await syncOutbox(identity);
      if (result.synced > 0) router.refresh();
    } finally {
      setBusy(null);
    }
  };

  const discard = async (item: OfflineOutboxItem) => {
    if (busy || !window.confirm(dict.pwa.discardConfirm)) return;
    setBusy(item.clientGeneratedId);
    try {
      await removeOutboxItem(item.clientGeneratedId);
    } finally {
      setBusy(null);
    }
  };

  const amountLabel = (item: OfflineOutboxItem) => {
    try {
      return formatMoney(parseMoneyToMinor(item.amount, item.currency), item.currency, moneyLocale(locale, item.currency));
    } catch {
      return item.amount;
    }
  };

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-page/60 px-4 py-3">
        <div>
          <p className="flex items-center gap-2 text-sm font-bold text-heading">
            <CloudOff className="h-4 w-4 text-accent-strong" aria-hidden />
            {dict.pwa.localEntries}
          </p>
          <p className="mt-0.5 text-xs text-muted">{dict.pwa.localEntriesHint}</p>
        </div>
        <Badge tone="outline">{items.filter((item) => item.status !== "synced").length}</Badge>
      </div>
      <ul className="divide-y divide-line/70">
        {items.map((item) => (
          <li key={item.clientGeneratedId} className="flex flex-wrap items-start gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate text-sm font-semibold text-heading">{item.description}</p>
                <Badge tone={STATUS_TONE[item.status]}>{statusLabel(item.status)}</Badge>
                {item.attempts > 1 ? (
                  <span className="text-[0.65rem] text-muted">
                    {item.attempts} {dict.pwa.attempts}
                  </span>
                ) : null}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                <span className="font-semibold tabular-nums text-heading">{amountLabel(item)}</span>
                <span>{item.occurredOn}</span>
                <span className="inline-flex items-center gap-1">
                  {item.status === "synced" ? (
                    <CheckCircle2 className="h-3 w-3 text-accent" aria-hidden />
                  ) : item.status === "attention" || item.status === "failed" ? (
                    <AlertTriangle className="h-3 w-3 text-danger" aria-hidden />
                  ) : (
                    <Clock3 className="h-3 w-3" aria-hidden />
                  )}
                  {item.status === "attention"
                    ? (item.lastErrorMessage ?? dict.pwa.syncNeedsAttention)
                    : item.status === "failed"
                      ? (item.lastErrorMessage ?? dict.pwa.syncRetrying)
                      : null}
                </span>
              </div>
            </div>
            {item.status === "failed" || item.status === "attention" ? (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void retry(item)}
                  disabled={busy !== null}
                  className="inline-flex h-8 items-center gap-1.5 rounded-full border border-line bg-panel px-3 text-xs font-semibold text-heading transition hover:border-accent-line hover:bg-accent-soft disabled:opacity-40"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${busy === item.clientGeneratedId ? "animate-spin" : ""}`} aria-hidden />
                  {dict.common.retry}
                </button>
                {item.status === "attention" ? (
                  <button
                    type="button"
                    onClick={() => void discard(item)}
                    disabled={busy !== null}
                    className="inline-flex h-8 items-center rounded-full px-2.5 text-xs font-semibold text-danger transition hover:bg-danger-soft disabled:opacity-40"
                  >
                    {dict.pwa.discardLocal}
                  </button>
                ) : null}
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </Card>
  );
}
