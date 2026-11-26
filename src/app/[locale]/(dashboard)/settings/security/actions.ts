"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/supabase/auth";
import { getDictionary } from "@/lib/i18n/server";
import { resolveLocale } from "@/lib/i18n/config";
import { getPublicEnv } from "@/lib/env";
import { getRequestMeta } from "@/lib/security/request-meta";
import { passwordSchema } from "@/lib/validation/schemas";
import { rateLimit } from "@/lib/rate-limit";
import { fieldErrorsFrom, formError, formSuccess, type FormState } from "@/lib/action-utils";
import { logger } from "@/lib/logger";

export async function changePasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const locale = resolveLocale(String(formData.get("locale") ?? "en"));
  const dict = await getDictionary(locale);
  const meta = await getRequestMeta();
  const user = await getSessionUser();
  if (!user?.email) return formError(dict.errors.sessionExpired);

  const parsed = z
    .object({
      current: z.string().min(1, dict.identity.currentPassword),
      password: passwordSchema,
      confirm: z.string().min(1, dict.auth.passwordMismatch),
    })
    .safeParse({
      current: formData.get("current"),
      password: formData.get("password"),
      confirm: formData.get("confirm"),
    });

  if (!parsed.success) {
    return formError(dict.errors.generic, fieldErrorsFrom(parsed.error));
  }
  if (parsed.data.password !== parsed.data.confirm) {
    return formError(dict.auth.passwordMismatch, { confirm: [dict.auth.passwordMismatch] });
  }
  if (!rateLimit(`password-change:${meta.ip ?? "unknown"}:${user.id}`, 5, 15 * 60_000)) {
    return formError(dict.identity.tooManyAttempts);
  }

  const supabase = await createClient();
  const { error: reauthError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: parsed.data.current,
  });
  if (reauthError) {
    return formError(dict.identity.currentPasswordWrong, {
      current: [dict.identity.currentPasswordWrong],
    });
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    logger.warn("auth.password_change_failed", { message: error.message });
    return formError(dict.errors.generic);
  }

  // A password change is a good moment to invalidate tokens on other devices.
  await supabase.auth.signOut({ scope: "others" });
  revalidatePath("/", "layout");
  return formSuccess(dict.identity.passwordChanged);
}

export async function signOutOtherSessionsAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const locale = resolveLocale(String(formData.get("locale") ?? "en"));
  const dict = await getDictionary(locale);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return formError(dict.errors.sessionExpired);

  await supabase.auth.signOut({ scope: "others" });
  revalidatePath("/", "layout");
  return formSuccess(dict.identity.sessionsCleared);
}

export async function signOutEverywhereAction(formData: FormData): Promise<void> {
  const locale = resolveLocale(String(formData.get("locale") ?? "en"));
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "global" });
  revalidatePath("/", "layout");
  redirect(`/${locale}/login`);
}

export async function sendRecoveryEmailAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const locale = resolveLocale(String(formData.get("locale") ?? "en"));
  const dict = await getDictionary(locale);
  const meta = await getRequestMeta();
  const user = await getSessionUser();
  if (!user?.email) return formError(dict.errors.sessionExpired);

  if (!rateLimit(`recovery:${meta.ip ?? "unknown"}:${user.id}`, 3, 15 * 60_000)) {
    return formError(dict.identity.tooManyAttempts);
  }

  const { NEXT_PUBLIC_APP_URL } = getPublicEnv();
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(user.email, {
    redirectTo: `${NEXT_PUBLIC_APP_URL}/auth/callback?next=/${locale}/reset-password`,
  });

  return formSuccess(dict.identity.recoverySent);
}
