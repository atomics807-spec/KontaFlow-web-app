"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ChevronRight, HandCoins, ShoppingBasket, Wallet, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SpeakButton } from "@/components/easy/speak-button";
import { useI18n } from "@/components/layout/i18n-provider";
import { speakEasy } from "@/lib/easy/audio";
import { useEasyAudio } from "@/components/easy/use-easy-audio";

const GUIDE_KEY = "kontaflow.easy.guide.v1";
const GUIDE_EVENT = "kontaflow:easy-guide-change";

function guideDone(): boolean {
  try {
    return window.localStorage.getItem(GUIDE_KEY) === "1";
  } catch {
    return true;
  }
}

function subscribeGuide(listener: () => void): () => void {
  window.addEventListener("storage", listener);
  window.addEventListener(GUIDE_EVENT, listener);
  return () => {
    window.removeEventListener("storage", listener);
    window.removeEventListener(GUIDE_EVENT, listener);
  };
}

export function EasyGuide({ forceOpen = false }: { forceOpen?: boolean }) {
  const { locale, dict } = useI18n();
  const audioEnabled = useEasyAudio();
  const done = useSyncExternalStore(subscribeGuide, guideDone, () => true);
  const [dismissed, setDismissed] = useState(false);
  const [index, setIndex] = useState(0);
  const nextRef = useRef<HTMLButtonElement>(null);
  const open = !dismissed && (forceOpen || !done);

  const slides = [
    {
      icon: Wallet,
      title: dict.easy.guide1Title,
      body: dict.easy.guide1Body,
      tone: "bg-jade-50 text-accent",
    },
    {
      icon: ShoppingBasket,
      title: dict.easy.guide2Title,
      body: dict.easy.guide2Body,
      tone: "bg-mango-100 text-heading",
    },
    {
      icon: HandCoins,
      title: dict.easy.guide3Title,
      body: dict.easy.guide3Body,
      tone: "bg-clay-soft text-danger",
    },
  ] as const;
  const slide = slides[index] ?? slides[0]!;

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    nextRef.current?.focus();
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      try {
        window.localStorage.setItem(GUIDE_KEY, "1");
      } catch {
        // The guide can still be closed when storage is unavailable.
      }
      setDismissed(true);
      window.dispatchEvent(new Event(GUIDE_EVENT));
      if (forceOpen) window.history.replaceState({}, "", window.location.pathname);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, forceOpen]);

  function close() {
    try {
      window.localStorage.setItem(GUIDE_KEY, "1");
    } catch {
      // The guide can still be closed when storage is unavailable.
    }
    setDismissed(true);
    window.dispatchEvent(new Event(GUIDE_EVENT));
    if (forceOpen) window.history.replaceState({}, "", window.location.pathname);
  }

  function next() {
    if (index >= slides.length - 1) {
      close();
      return;
    }
    const upcoming = slides[index + 1];
    setIndex(index + 1);
    if (audioEnabled && upcoming) speakEasy(`${upcoming.title}. ${upcoming.body}`, locale);
  }

  if (!open) return null;
  const Icon = slide.icon;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="easy-guide-title"
      aria-describedby="easy-guide-body"
      className="fixed inset-0 z-50 flex items-center justify-center bg-forest/75 p-4 backdrop-blur-sm"
    >
      <div className="w-full max-w-md rounded-3xl border-4 border-white/30 bg-page p-5 shadow-2xl sm:p-7">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-1.5" aria-label={dict.easy.progressLabel}>
            {slides.map((item, itemIndex) => (
              <span
                key={item.title}
                aria-current={itemIndex === index ? "step" : undefined}
                className={`h-2.5 rounded-full transition-all ${
                  itemIndex === index ? "w-8 bg-forest" : "w-2.5 bg-line"
                }`}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={close}
            aria-label={dict.common.close}
            className="grid h-11 w-11 place-items-center rounded-full border-2 border-line bg-panel text-heading"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <div className={`mx-auto mt-5 grid h-28 w-28 place-items-center rounded-[2rem] ${slide.tone}`}>
          <Icon className="h-16 w-16" aria-hidden />
        </div>

        <h2 id="easy-guide-title" className="mt-5 text-center text-3xl font-black leading-tight text-heading">
          {slide.title}
        </h2>
        <p id="easy-guide-body" className="mt-3 text-center text-lg font-medium leading-snug text-muted">
          {slide.body}
        </p>

        <SpeakButton text={`${slide.title}. ${slide.body}`} label={dict.easy.listen} className="mt-5 w-full" />

        <div className="mt-4 flex flex-col gap-2">
          <Button ref={nextRef} type="button" size="lg" onClick={next} className="min-h-16 text-xl">
            {index >= slides.length - 1 ? dict.easy.guideFinish : dict.easy.guideNext}
            <ChevronRight className="h-6 w-6" aria-hidden />
          </Button>
          <button type="button" onClick={close} className="min-h-11 text-sm font-bold text-muted underline">
            {dict.easy.guideSkip}
          </button>
        </div>
      </div>
    </div>
  );
}
