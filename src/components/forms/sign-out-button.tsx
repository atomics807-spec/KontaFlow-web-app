"use client";

import { useRef, useState } from "react";
import { LogOut } from "lucide-react";
import { signOutAction } from "@/app/[locale]/(auth)/actions";
import { clearOfflineDataBeforeSignOut } from "@/components/offline/offline-identity-provider";
import { useI18n } from "@/components/layout/i18n-provider";
import { Button } from "@/components/ui/button";

export function SignOutButton({
  label,
  compact = false,
  className,
}: {
  label: string;
  compact?: boolean;
  className?: string;
}) {
  const { locale } = useI18n();
  const [busy, setBusy] = useState(false);
  const cleared = useRef(false);

  return (
    <form
      action={signOutAction}
      onSubmit={(event) => {
        if (cleared.current) return;
        event.preventDefault();
        const form = event.currentTarget;
        setBusy(true);
        void clearOfflineDataBeforeSignOut()
          .catch(() => undefined)
          .finally(() => {
            cleared.current = true;
            form.requestSubmit();
          });
      }}
    >
      <input type="hidden" name="locale" value={locale} />
      <Button
        type="submit"
        disabled={busy}
        variant="ghost"
        size={compact ? "icon" : "sm"}
        aria-label={label}
        title={label}
        className={className ?? (compact ? "text-jade-100 hover:bg-white/10" : undefined)}
      >
        <LogOut className="h-4 w-4" aria-hidden />
        {compact ? null : <span>{label}</span>}
      </Button>
    </form>
  );
}
