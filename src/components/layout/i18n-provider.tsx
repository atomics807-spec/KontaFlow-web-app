"use client";

import { createContext, useContext, useMemo } from "react";
import { TolgeeProvider, useTranslate } from "@tolgee/react";
import { interpolate } from "@/lib/i18n/interpolate";
import type { Locale } from "@/lib/i18n/config";
import { en, type Dictionary } from "@/lib/i18n/dictionaries/en";
import { tolgee } from "@/lib/i18n/tolgee-client";

type I18nValue = {
  locale: Locale;
  dict: Dictionary;
  t: (key: string, params?: Record<string, string | number>) => string;
  format: (template: string, values: Record<string, string | number>) => string;
};

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({
  locale,
  dict,
  children,
}: {
  locale: Locale;
  dict: Dictionary;
  children: React.ReactNode;
}) {
  // Include English so Tolgee has its fallback language for SSR and for keys
  // that are added to the remote project before the local dictionary.
  const staticData = useMemo(() => ({ en, [locale]: dict }), [locale, dict]);

  return (
    <TolgeeProvider
      tolgee={tolgee}
      ssr={{ language: locale, staticData }}
      fallback={null}
    >
      <I18nBridge locale={locale} dict={dict}>
        {children}
      </I18nBridge>
    </TolgeeProvider>
  );
}

function I18nBridge({
  locale,
  dict,
  children,
}: {
  locale: Locale;
  dict: Dictionary;
  children: React.ReactNode;
}) {
  const { t } = useTranslate();
  const value = useMemo<I18nValue>(
    () => ({
      locale,
      dict,
      t,
      format: (template, values) => interpolate(template, values, { locale }),
    }),
    [locale, dict, t],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const value = useContext(I18nContext);
  if (!value) throw new Error("useI18n must be used inside <I18nProvider>");
  return value;
}

export function fill(
  template: string,
  values: Record<string, string | number>,
  locale: string = "en",
): string {
  return interpolate(template, values, { locale });
}
