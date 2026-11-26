"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore } from "react";
import { isThemeMode, THEME_COOKIE, type ThemeMode } from "@/lib/theme";

type ThemeValue = {
  mode: ThemeMode;
  resolved: "light" | "dark";
  setMode: (mode: ThemeMode) => void;
};

const ThemeContext = createContext<ThemeValue | null>(null);

const THEME_EVENT = "kontaflow:theme";
const COOKIE_PATTERN = new RegExp(`(?:^|; )${THEME_COOKIE}=([^;]+)`);

function readStoredMode(): ThemeMode {
  if (typeof document === "undefined") return "system";
  const match = document.cookie.match(COOKIE_PATTERN);
  const value = match ? decodeURIComponent(match[1]) : null;
  return isThemeMode(value) ? value : "system";
}

function subscribeToTheme(callback: () => void): () => void {
  window.addEventListener(THEME_EVENT, callback);
  const query = window.matchMedia("(prefers-color-scheme: dark)");
  query.addEventListener("change", callback);
  return () => {
    window.removeEventListener(THEME_EVENT, callback);
    query.removeEventListener("change", callback);
  };
}

function subscribeToSystem(callback: () => void): () => void {
  const query = window.matchMedia("(prefers-color-scheme: dark)");
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}

/**
 * The cookie is the source of truth, read through an external store so the
 * server keeps rendering "system" (and marketing routes stay static) while the
 * client picks up the stored preference after hydration. The pre-paint script
 * in the layout prevents a flash in the meantime.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const mode = useSyncExternalStore(subscribeToTheme, readStoredMode, () => "system" as ThemeMode);
  const systemDark = useSyncExternalStore(
    subscribeToSystem,
    () => window.matchMedia("(prefers-color-scheme: dark)").matches,
    () => false,
  );

  const resolved: "light" | "dark" = mode === "system" ? (systemDark ? "dark" : "light") : mode;

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", resolved === "dark");
    root.style.colorScheme = resolved;
    root.dataset.theme = mode;
  }, [mode, resolved]);

  const setMode = useCallback((next: ThemeMode) => {
    if (!isThemeMode(next)) return;
    document.cookie = `${THEME_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    window.dispatchEvent(new Event(THEME_EVENT));
  }, []);

  const value = useMemo(() => ({ mode, resolved, setMode }), [mode, resolved, setMode]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used inside ThemeProvider");
  return context;
}
