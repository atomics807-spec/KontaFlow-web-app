"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Square, Volume2 } from "lucide-react";
import { useI18n } from "@/components/layout/i18n-provider";
import { speechLanguage } from "@/lib/easy/speech";
import { cn } from "@/lib/utils";

const subscribeToSupport = () => () => {};

function getSpeechSupport(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export function SpeakButton({
  text,
  label,
  className,
}: {
  text: string;
  label: string;
  className?: string;
}) {
  const { locale } = useI18n();
  const supported = useSyncExternalStore(subscribeToSupport, getSpeechSupport, () => false);
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  if (!supported) return null;

  function toggle() {
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = speechLanguage(locale);
    utterance.rate = 0.9;
    utterance.pitch = 1;
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
    setSpeaking(true);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      className={cn(
        "inline-flex min-h-12 items-center justify-center gap-2 rounded-full border-2 border-line bg-panel px-5 text-base font-bold text-heading transition hover:border-accent-line hover:bg-accent-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong",
        className,
      )}
    >
      {speaking ? <Square className="h-5 w-5" aria-hidden /> : <Volume2 className="h-5 w-5" aria-hidden />}
      {label}
    </button>
  );
}
