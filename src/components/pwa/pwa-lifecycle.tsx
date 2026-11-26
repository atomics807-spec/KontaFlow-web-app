"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Download, RefreshCw, Share2, Smartphone, X } from "lucide-react";
import { useI18n } from "@/components/layout/i18n-provider";
import { LogoMark } from "@/components/layout/logo";
import { Button } from "@/components/ui/button";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const INSTALL_DISMISSED_KEY = "kontaflow.install-dismissed-at";
const DISMISS_DAYS = 30;

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia?.("(display-mode: standalone)").matches) return true;
  return Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
}

function recentlyDismissed(): boolean {
  const value = Number(window.localStorage.getItem(INSTALL_DISMISSED_KEY) ?? 0);
  return Date.now() - value < DISMISS_DAYS * 24 * 60 * 60 * 1000;
}

export function PwaLifecycle() {
  const { dict } = useI18n();
  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(null);
  const [showInstall, setShowInstall] = useState(false);
  const [iosHint, setIosHint] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [applyingUpdate, setApplyingUpdate] = useState(false);
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);
  const reloadRequested = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return;

    let disposed = false;
    let poll: number | undefined;

    const markWaiting = (registration: ServiceWorkerRegistration) => {
      if (registration.waiting && navigator.serviceWorker.controller) setUpdateAvailable(true);
    };

    const register = async () => {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
          updateViaCache: "none",
        });
        if (disposed) return;
        registrationRef.current = registration;
        markWaiting(registration);

        registration.addEventListener("updatefound", () => {
          const worker = registration.installing;
          worker?.addEventListener("statechange", () => {
            if (worker.state === "installed" && navigator.serviceWorker.controller) {
              setUpdateAvailable(true);
            }
          });
        });

        const check = () => {
          if (document.visibilityState === "visible") void registration.update().catch(() => undefined);
        };
        document.addEventListener("visibilitychange", check);
        poll = window.setInterval(check, 30 * 60 * 1000);
      } catch {
        // Installation/offline is an enhancement; never block the app.
      }
    };

    const onControllerChange = () => {
      if (reloadRequested.current) window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    void register();

    return () => {
      disposed = true;
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      if (poll) window.clearInterval(poll);
    };
  }, []);

  useEffect(() => {
    if (isStandalone()) return;

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as InstallPromptEvent);
      if (!recentlyDismissed()) window.setTimeout(() => setShowInstall(true), 2_500);
    };

    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const iosTimer =
      isIos && !recentlyDismissed()
        ? window.setTimeout(() => {
            setIosHint(true);
            setShowInstall(true);
          }, 3_500)
        : undefined;

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", () => {
      setShowInstall(false);
      setInstallEvent(null);
      setIosHint(false);
    });

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      if (iosTimer) window.clearTimeout(iosTimer);
    };
  }, []);

  const dismissInstall = useCallback(() => {
    window.localStorage.setItem(INSTALL_DISMISSED_KEY, String(Date.now()));
    setShowInstall(false);
    setIosHint(false);
  }, []);

  const install = useCallback(async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    await installEvent.userChoice.catch(() => undefined);
    setInstallEvent(null);
    setShowInstall(false);
  }, [installEvent]);

  const applyUpdate = useCallback(() => {
    setApplyingUpdate(true);
    reloadRequested.current = true;
    const waiting = registrationRef.current?.waiting;
    if (waiting) waiting.postMessage({ type: "SKIP_WAITING" });
    else window.location.reload();
  }, []);

  return (
    <>
      {showInstall && !updateAvailable ? (
        <div
          role="dialog"
          aria-labelledby="kontaflow-install-title"
          className="fixed inset-x-3 bottom-3 z-[70] mx-auto max-w-md rounded-2xl border border-line bg-panel p-4 shadow-[0_18px_60px_rgba(8,20,15,0.28)] sm:left-auto sm:right-4 sm:mx-0"
        >
          <div className="flex items-start gap-3">
            <LogoMark className="h-10 w-10 shrink-0" />
            <div className="min-w-0 flex-1">
              <p id="kontaflow-install-title" className="text-sm font-extrabold text-heading">
                {iosHint ? dict.pwa.installIosTitle : dict.pwa.installTitle}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-muted">
                {iosHint ? dict.pwa.installIosHint : dict.pwa.installDescription}
              </p>
              {iosHint ? (
                <p className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-page px-2.5 py-1.5 text-xs font-semibold text-heading">
                  <Share2 className="h-3.5 w-3.5" aria-hidden />
                  {dict.pwa.installIosSteps}
                </p>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                {installEvent ? (
                  <Button type="button" size="sm" onClick={() => void install()}>
                    <Download className="h-4 w-4" aria-hidden />
                    {dict.pwa.installNow}
                  </Button>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent">
                    <Smartphone className="h-3.5 w-3.5" aria-hidden />
                    {dict.pwa.install}
                  </span>
                )}
                <Button type="button" size="sm" variant="ghost" onClick={dismissInstall}>
                  {dict.pwa.notNow}
                </Button>
              </div>
            </div>
            <button
              type="button"
              onClick={dismissInstall}
              aria-label={dict.common.close}
              className="grid h-8 w-8 place-items-center rounded-full text-muted hover:bg-page hover:text-heading"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>
      ) : null}

      {updateAvailable ? (
        <div
          role="status"
          aria-live="polite"
          className="fixed inset-x-3 bottom-3 z-[75] mx-auto flex max-w-lg items-center gap-3 rounded-2xl border border-accent-line bg-panel px-4 py-3 shadow-[0_18px_60px_rgba(8,20,15,0.28)] sm:left-auto sm:right-4 sm:mx-0"
        >
          <RefreshCw className={`h-4 w-4 shrink-0 text-accent ${applyingUpdate ? "animate-spin" : ""}`} aria-hidden />
          <p className="min-w-0 flex-1 text-xs font-semibold text-heading">{dict.pwa.updateAvailable}</p>
          <Button type="button" size="sm" onClick={applyUpdate} disabled={applyingUpdate}>
            {applyingUpdate ? dict.pwa.updating : dict.pwa.updateNow}
          </Button>
        </div>
      ) : null}
    </>
  );
}
