"use client";

import { FormatSimple, Tolgee } from "@tolgee/react";
import { DEFAULT_LOCALE, LOCALES } from "./config";

/**
 * Client Tolgee instance. Server dictionaries are injected through the
 * provider's `ssr.staticData`, so the first render is translated without a
 * network request and no server-side Tolgee credential reaches the browser.
 */
export const tolgee = Tolgee()
  .use(FormatSimple())
  .init({
    defaultLanguage: DEFAULT_LOCALE,
    fallbackLanguage: DEFAULT_LOCALE,
    availableLanguages: [...LOCALES],
  });
