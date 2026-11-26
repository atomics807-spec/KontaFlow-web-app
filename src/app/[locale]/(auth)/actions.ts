"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getDictionary } from "@/lib/i18n/server";
import { resolveLocale } from "@/lib/i18n/config";
import { getPublicEnv } from "@/lib/env";
import { emailSchema, passwordSchema } from "@/lib/validation/schemas";
import {
  fieldErrorsFrom,
  formError,
  formSuccess,
  safeNextPath,
  type FormState,
} from "@/lib/action-utils";
import { logger } from "@/lib/logger";
import { z } from "zod";

function localeFrom(formData: FormData) {
  return resolveLocale(String(formData.get("locale") ?? "en"));
}

export async function signInAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const locale = localeFrom(formData);
  const dict = await getDictionary(locale);

  const parsed = z
    .object({ email: emailSchema, password: z.string().min(1, dict.auth.password) })
    .safeParse({
      email: formData.get("email"),
      password: formData.get("password"),
    });

  if (!parsed.success) {
    return formError(dict.errors.generic, fieldErrorsFrom(parsed.error));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    logger.warn("auth.sign_in_failed", { message: error.message });
    return formError(dict.auth.invalidCredentials);
  }

  const next = safeNextPath(formData.get("next"), `/${locale}/dashboard`);
  revalidatePath("/", "layout");
  redirect(next);
}

export async function signUpAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const locale = localeFrom(formData);
  const dict = await getDictionary(locale);

  const parsed = z
    .object({
      fullName: z.string().trim().min(2, dict.auth.nameRequired).max(120),
      email: emailSchema,
      password: passwordSchema,
    })
    .safeParse({
      fullName: formData.get("fullName"),
      email: formData.get("email"),
      password: formData.get("password"),
    });

  if (!parsed.success) {
    return formError(dict.errors.generic, fieldErrorsFrom(parsed.error));
  }

  const target = safeNextPath(formData.get("next") as string | null, `/${locale}/onboarding`);
  const { NEXT_PUBLIC_APP_URL } = getPublicEnv();
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName, locale },
      emailRedirectTo: `${NEXT_PUBLIC_APP_URL}/auth/callback?next=${encodeURIComponent(target)}`,
    },
  });

  if (error) {
    logger.warn("auth.sign_up_failed", { message: error.message });
    const message = /already|registered|exists/i.test(error.message)
      ? dict.auth.haveAccount
      : dict.errors.generic;
    return formError(message);
  }

  if (data.session) {
    revalidatePath("/", "layout");
    redirect(target);
  }

  return formSuccess(dict.auth.checkEmail);
}

export async function requestPasswordResetAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const locale = localeFrom(formData);
  const dict = await getDictionary(locale);

  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) {
    return formError(dict.auth.emailInvalid, { email: [dict.auth.emailInvalid] });
  }

  const { NEXT_PUBLIC_APP_URL } = getPublicEnv();
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(parsed.data, {
    redirectTo: `${NEXT_PUBLIC_APP_URL}/auth/callback?next=/${locale}/reset-password`,
  });

  // Never reveal whether the account exists.
  return formSuccess(dict.auth.resetSent);
}

export async function updatePasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const locale = localeFrom(formData);
  const dict = await getDictionary(locale);

  const parsed = z
    .object({ password: passwordSchema, confirm: z.string() })
    .safeParse({
      password: formData.get("password"),
      confirm: formData.get("confirm"),
    });

  if (!parsed.success) {
    return formError(dict.errors.generic, fieldErrorsFrom(parsed.error));
  }
  if (parsed.data.password !== parsed.data.confirm) {
    return formError(dict.auth.passwordMismatch, { confirm: [dict.auth.passwordMismatch] });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return formError(dict.errors.sessionExpired);

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return formError(dict.errors.generic);

  return formSuccess(dict.auth.passwordUpdated);
}

export async function signOutAction(formData: FormData): Promise<void> {
  const locale = localeFrom(formData);
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect(`/${locale}/login`);
}
