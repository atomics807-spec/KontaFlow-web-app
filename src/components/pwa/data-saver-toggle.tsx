"use client";

import { Gauge } from "lucide-react";
import { useI18n } from "@/components/layout/i18n-provider";
import { useDataSaver } from "@/components/pwa/data-saver-provider";
import { cn } from "@/lib/utils";

export function DataSaverToggle({ tone = "light" }: { tone?: "light" | "dark" }) {
  const { dict } = useI18n();
  const { lowData, toggleLowData } = useDataSaver();

  return (
    <button
      type="button"
      onClick={toggleLowData}
      aria-pressed={lowData}
      title={lowData ? dict.pwa.lowDataOn : dict.pwa.lowDataOff}
      className={cn(
        "inline-flex h-9 items-center gap-1.5 rounded-full border px-2.5 text-[0.7rem] font-semibold transition",
        tone === "dark"
          ? "border-white/10 bg-white/5 text-jade-100 hover:bg-white/10"
          : "border-line bg-panel text-muted hover:border-accent-line hover:text-heading",
        lowData && "border-accent-line bg-accent-soft text-accent",
      )}
    >
      <Gauge className="h-3.5 w-3.5" aria-hidden />
      <span className="hidden sm:inline">{lowData ? dict.pwa.lowDataOn : dict.pwa.lowDataOff}</span>
    </button>
  );
}
