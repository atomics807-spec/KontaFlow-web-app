"use client";

import { Volume2, VolumeX } from "lucide-react";
import { useI18n } from "@/components/layout/i18n-provider";
import { setEasyAudio, speakEasy } from "@/lib/easy/audio";
import { useEasyAudio } from "@/components/easy/use-easy-audio";
import { cn } from "@/lib/utils";

export function EasySoundToggle({ className }: { className?: string }) {
  const { locale, dict } = useI18n();
  const enabled = useEasyAudio();

  function toggle() {
    const next = !enabled;
    setEasyAudio(next);
    if (next) speakEasy(dict.easy.voiceOnSpoken, locale);
    else if (typeof window !== "undefined") window.speechSynthesis?.cancel();
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      aria-label={enabled ? dict.easy.voiceOn : dict.easy.voiceOff}
      onClick={toggle}
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full border-2 border-line bg-panel px-2.5 text-xs font-bold text-heading transition hover:bg-accent-soft sm:px-3",
        className,
      )}
    >
      {enabled ? <Volume2 className="h-4 w-4 text-accent" aria-hidden /> : <VolumeX className="h-4 w-4 text-muted" aria-hidden />}
      <span className="hidden sm:inline">{enabled ? dict.easy.voiceOn : dict.easy.voiceOff}</span>
    </button>
  );
}
