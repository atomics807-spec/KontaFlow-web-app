"use server";

import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { LOCALE_COOKIE, resolveLocale } from "@/lib/i18n/config";
import { logger } from "@/lib/logger";

/**
 * Persists the language choice for the browser and, when signed in, for the
 * profile so a new device can restore it after sign-in.
 */
export async function persistLocalePreference(next: string): Promise<void> {
  const locale = resolveLocale(next);
  const cookieStore = await cookies();
  cookieStore.set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: 31536000,
    sameSite: "lax",
    httpOnly: false,
  });

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from("profiles").update({ locale }).eq("id", user.id);
    if (error) logger.warn("i18n.profile_locale_failed", { code: error.code });
  } catch (error) {
    logger.warn("i18n.profile_locale_unavailable", { error });
  }
}
