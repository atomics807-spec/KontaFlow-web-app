"use client";

import { LogOut } from "lucide-react";
import { signOutAction } from "@/app/[locale]/(auth)/actions";
import { useI18n } from "@/components/layout/i18n-provider";
import { Button } from "@/components/ui/button";

export function SignOutButton({ label, compact = false }: { label: string; compact?: boolean }) {
  const { locale } = useI18n();
  return (
    <form action={signOutAction}>
      <input type="hidden" name="locale" value={locale} />
      <Button
        type="submit"
        variant="ghost"
        size={compact ? "icon" : "sm"}
        aria-label={label}
        title={label}
        className={compact ? "text-jade-100 hover:bg-white/10" : undefined}
      >
        <LogOut className="h-4 w-4" aria-hidden />
        {compact ? null : <span>{label}</span>}
      </Button>
    </form>
  );
}
