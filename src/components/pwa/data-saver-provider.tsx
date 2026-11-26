"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore } from "react";

const STORAGE_KEY = "kontaflow.low-data";
const CHANGE_EVENT = "kontaflow:low-data";

type DataSaverContextValue = {
  lowData: boolean;
  setLowData: (enabled: boolean) => void;
  toggleLowData: () => void;
};

const DataSaverContext = createContext<DataSaverContextValue | null>(null);

type Connection = { saveData?: boolean; effectiveType?: string };

function subscribe(callback: () => void): () => void {
  window.addEventListener("storage", callback);
  window.addEventListener(CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(CHANGE_EVENT, callback);
  };
}

function getSnapshot(): boolean {
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "true") return true;
  if (stored === "false") return false;
  const connection = (navigator as Navigator & { connection?: Connection }).connection;
  if (connection?.saveData) return true;
  if (connection?.effectiveType === "slow-2g" || connection?.effectiveType === "2g") return true;
  return window.matchMedia?.("(prefers-reduced-data: reduce)").matches ?? false;
}

function getServerSnapshot(): boolean {
  return false;
}

export function DataSaverProvider({ children }: { children: React.ReactNode }) {
  const lowData = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    document.documentElement.dataset.lowData = lowData ? "true" : "false";
  }, [lowData]);

  const setLowData = useCallback((enabled: boolean) => {
    window.localStorage.setItem(STORAGE_KEY, String(enabled));
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);
  const toggleLowData = useCallback(() => setLowData(!getSnapshot()), [setLowData]);

  const value = useMemo(() => ({ lowData, setLowData, toggleLowData }), [lowData, setLowData, toggleLowData]);
  return <DataSaverContext.Provider value={value}>{children}</DataSaverContext.Provider>;
}

export function useDataSaver(): DataSaverContextValue {
  const value = useContext(DataSaverContext);
  if (value) return value;
  return { lowData: false, setLowData: () => undefined, toggleLowData: () => undefined };
}
