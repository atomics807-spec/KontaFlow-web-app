"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/components/layout/i18n-provider";
import { useTheme } from "@/components/layout/theme-provider";
import { Tooltip } from "@/components/ui/tooltip";
import { THEME_MODES, type ThemeMode } from "@/lib/theme";

const ICONS: Record<ThemeMode, typeof Sun> = { light: Sun, dark: Moon, system: Monitor };

export function ThemeToggle({ className, tone = "light" }: { className?: string; tone?: "light" | "dark" }) {
  const { dict } = useI18n();
  const { mode, setMode } = useTheme();

  const labels: Record<ThemeMode, string> = {
    light: dict.theme.light,
    dark: dict.theme.dark,
    system: dict.theme.system,
  };

  return (
    <div
      role="group"
      aria-label={dict.theme.label}
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full border p-0.5",
        tone === "dark" ? "border-white/15 bg-white/5" : "border-line bg-panel/70",
        className,
      )}
    >
      {THEME_MODES.map((option) => {
        const Icon = ICONS[option];
        const active = mode === option;
        return (
          <Tooltip key={option} label={labels[option]}>
            <button
              type="button"
              onClick={() => setMode(option)}
              aria-pressed={active}
              aria-label={labels[option]}
              className={cn(
                "grid h-7 w-7 place-items-center rounded-full transition-colors duration-200",
                active
                  ? tone === "dark"
                    ? "bg-white/15 text-white"
                    : "bg-accent-soft text-accent"
                  : tone === "dark"
                    ? "text-jade-200/70 hover:text-white"
                    : "text-muted hover:text-heading",
              )}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden />
            </button>
          </Tooltip>
        );
      })}
    </div>
  );
}
