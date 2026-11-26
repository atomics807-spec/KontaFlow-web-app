"use client";

import { useEffect, useState } from "react";
import {
  OFFLINE_CHANGE_EVENT,
  getAiCommands,
  getOutboxItems,
  offlineStorageAvailable,
  type OfflineAiCommand,
  type OfflineIdentity,
  type OfflineOutboxItem,
} from "@/lib/offline/db";

export function useOutboxItems(identity: OfflineIdentity | null, limit = 50): OfflineOutboxItem[] {
  const [items, setItems] = useState<OfflineOutboxItem[]>([]);

  useEffect(() => {
    if (!identity || !offlineStorageAvailable()) return;
    let active = true;
    const load = () => {
      void getOutboxItems(identity.userId, identity.workspaceId, limit)
        .then((rows) => {
          if (active) setItems(rows);
        })
        .catch(() => undefined);
    };
    load();
    window.addEventListener(OFFLINE_CHANGE_EVENT, load);
    const interval = window.setInterval(load, 15_000);
    return () => {
      active = false;
      window.removeEventListener(OFFLINE_CHANGE_EVENT, load);
      window.clearInterval(interval);
    };
  }, [identity, limit]);

  return identity ? items : [];
}

export function useOfflineAiCommands(identity: OfflineIdentity | null): OfflineAiCommand[] {
  const [commands, setCommands] = useState<OfflineAiCommand[]>([]);

  useEffect(() => {
    if (!identity || !offlineStorageAvailable()) return;
    let active = true;
    const load = () => {
      void getAiCommands(identity.userId, identity.workspaceId)
        .then((rows) => {
          if (active) setCommands(rows);
        })
        .catch(() => undefined);
    };
    load();
    window.addEventListener(OFFLINE_CHANGE_EVENT, load);
    return () => {
      active = false;
      window.removeEventListener(OFFLINE_CHANGE_EVENT, load);
    };
  }, [identity]);

  return identity ? commands : [];
}
