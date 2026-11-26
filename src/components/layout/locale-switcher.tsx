"use client";

import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";
import { Globe } from "lucide-react";
import { LOCALE_COOKIE, LOCALES, LOCALE_META, isLocale } from "@/lib/i18n/config";
import { useI18n } from "./i18n-provider";

export function LocaleSwitcher({ compact = false }: { compact?: boolean }) {
  const { locale } = useI18n();
  const pathname = usePathname();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const change = (next: string) => {
    if (next === locale) return;
    const segments = pathname.split("/");
    if (isLocale(segments[1])) {
      segments[1] = next;
      // Persist the preference for the proxy and for emails.
      document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
      startTransition(() => router.push(segments.join("/") || `/${next}`));
    }
  };

  return (
    <label className="relative inline-flex items-center gap-1.5 text-sm font-medium text-muted">
      <Globe className="h-4 w-4" aria-hidden />
      <span className="sr-only">{useI18n().dict.common.language}</span>
      <select
        value={locale}
        disabled={pending}
        onChange={(event) => change(event.target.value)}
        className="-ml-1 cursor-pointer appearance-none rounded-full bg-transparent py-1 pl-1 pr-5 font-semibold text-inherit hover:text-heading focus:outline-none focus-visible:ring-2 focus-visible:ring-jade-500/40"
        aria-label={useI18n().dict.common.language}
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
