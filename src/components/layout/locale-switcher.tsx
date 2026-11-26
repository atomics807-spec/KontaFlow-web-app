"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Globe } from "lucide-react";
import { LOCALE_COOKIE, LOCALES, LOCALE_META, localizePath, resolveLocale } from "@/lib/i18n/config";
import { persistLocalePreference } from "@/app/[locale]/locale-actions";
import { useI18n } from "./i18n-provider";

export function LocaleSwitcher({ compact = false }: { compact?: boolean }) {
  const { locale, t } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const change = (next: string) => {
    if (next === locale) return;
    const target = localizePath(window.location.pathname, resolveLocale(next));
    const suffix = `${window.location.search}${window.location.hash}`;
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    startTransition(() => {
      router.replace(`${target}${suffix}`);
      void persistLocalePreference(next).catch(() => {});
    });
  };

  return (
    <label className="relative inline-flex items-center gap-1.5 text-sm font-medium text-muted">
      <Globe className="h-4 w-4" aria-hidden />
      <span className="sr-only">{t("common.language")}</span>
      <select
        value={locale}
        disabled={pending}
        onChange={(event) => change(event.target.value)}
        className="-ml-1 cursor-pointer appearance-none rounded-full bg-transparent py-1 pl-1 pr-5 font-semibold text-inherit hover:text-heading focus:outline-none focus-visible:ring-2 focus-visible:ring-jade-500/40"
        aria-label={t("common.language")}
      >
        {LOCALES.map((code) => (
          <option key={code} value={code}>
            {compact ? code.toUpperCase() : LOCALE_META[code].label}
          </option>
        ))}
      </select>
      <span aria-hidden className="pointer-events-none absolute right-0 text-[0.6rem]">
        ▼
      </span>
    </label>
  );
}
