"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getDictionary } from "@/lib/i18n/server";
import { LOCALE_COOKIE, localizePath, resolveLocale } from "@/lib/i18n/config";
import { getPublicEnv } from "@/lib/env";
import { emailSchema, passwordSchema } from "@/lib/validation/schemas";
import { signupSchema } from "@/lib/validation/auth";
import { normalizePhone } from "@/lib/validation/phone";
import { PRIVACY_POLICY_VERSION } from "@/lib/legal";
import { getRequestMeta } from "@/lib/security/request-meta";
import { rateLimit } from "@/lib/rate-limit";
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

function unconfirmedEmail(message: string): boolean {
  return /confirm|confirmed|verification/i.test(message);
}

export async function signInAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const locale = localeFrom(formData);
  const dict = await getDictionary(locale);
  const meta = await getRequestMeta();

  const parsed = z
    .object({ email: emailSchema, password: z.string().min(1, dict.auth.password) })
    .safeParse({
      email: formData.get("email"),
      password: formData.get("password"),
    });

  if (!parsed.success) {
    return formError(dict.errors.generic, fieldErrorsFrom(parsed.error));
  }

  const limitKey = `signin:${meta.ip ?? "unknown"}:${parsed.data.email}`;
  if (!rateLimit(limitKey, 5, 15 * 60_000)) {
    logger.warn("auth.sign_in_rate_limited", { ip: meta.ip, email: parsed.data.email });
    return formError(dict.identity.tooManyAttempts);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    logger.warn("auth.sign_in_failed", { message: error.message });
    if (unconfirmedEmail(error.message)) {
      redirect(
        `/${locale}/verify-email?email=${encodeURIComponent(parsed.data.email)}&next=${encodeURIComponent(
          `/${locale}/onboarding`,
        )}`,
      );
    }
    return formError(dict.auth.invalidCredentials);
  }

  const next = safeNextPath(formData.get("next"), `/${locale}/dashboard`);
  const user = data.user;
  let preferredLocale = locale;

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("verification_required, phone_verified_at, email_verified_at, locale")
      .eq("id", user.id)
      .maybeSingle();

    preferredLocale = resolveLocale(profile?.locale ?? locale);
    const destination = localizePath(next, preferredLocale);
    const cookieStore = await cookies();
    cookieStore.set(LOCALE_COOKIE, preferredLocale, {
      path: "/",
      maxAge: 31536000,
      sameSite: "lax",
      httpOnly: false,
    });

    const { data: platformAdmin } = await supabase
      .from("platform_admins")
      .select("role")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();
    if (platformAdmin) {
      revalidatePath("/", "layout");
      redirect(`/${preferredLocale}/admin`);
    }

    const { data: restrictions } = await supabase
      .from("account_restrictions")
      .select("expires_at")
      .eq("user_id", user.id)
      .is("lifted_at", null);
    const hasActiveRestriction = (restrictions ?? []).some(
      (row) => row.expires_at === null || new Date(row.expires_at).getTime() > Date.now(),
    );
    if (hasActiveRestriction) {
      revalidatePath("/", "layout");
      redirect(`/${preferredLocale}/account-restricted`);
    }

    if (profile?.verification_required) {
      if (!user.email_confirmed_at && !profile.email_verified_at) {
        redirect(
          `/${preferredLocale}/verify-email?email=${encodeURIComponent(user.email ?? "")}&next=${encodeURIComponent(destination)}`,
        );
      }
      if (!profile.phone_verified_at) {
        redirect(`/${preferredLocale}/verify-phone?next=${encodeURIComponent(destination)}`);
      }
    }

    revalidatePath("/", "layout");
    redirect(destination);
  }

  revalidatePath("/", "layout");
  redirect(next);
}

export async function signUpAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const locale = localeFrom(formData);
  const dict = await getDictionary(locale);
  const meta = await getRequestMeta();

  const parsed = signupSchema({
    firstNameRequired: dict.auth.firstNameRequired,
    lastNameRequired: dict.auth.lastNameRequired,
    phoneInvalid: dict.auth.phoneInvalid,
    privacyRequired: dict.auth.privacyRequired,
    passwordMismatch: dict.auth.passwordMismatch,
  }).safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    email: formData.get("email"),
    country: formData.get("country"),
    phone: formData.get("phone"),
    password: formData.get("password"),
    confirm: formData.get("confirm"),
    preferredLocale: formData.get("preferredLocale"),
    privacyAccepted: formData.get("privacy") === "on",
    marketingOptIn: formData.get("marketing") === "on",
  });

  if (!parsed.success) {
    return formError(dict.errors.generic, fieldErrorsFrom(parsed.error));
  }

  if (!rateLimit(`signup:${meta.ip ?? "unknown"}`, 5, 60 * 60_000)) {
    logger.warn("auth.sign_up_rate_limited", { ip: meta.ip });
    return formError(dict.identity.tooManyAttempts);
  }

  const phone = normalizePhone(parsed.data.phone, parsed.data.country);
  if (!phone) {
    return formError(dict.auth.phoneInvalid, { phone: [dict.auth.phoneInvalid] });
  }

  const fullName = `${parsed.data.firstName} ${parsed.data.lastName}`.trim();
  const acceptedAt = new Date().toISOString();
  const target = safeNextPath(formData.get("next") as string | null, `/${locale}/onboarding`);
  const { NEXT_PUBLIC_APP_URL } = getPublicEnv();
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: {
        first_name: parsed.data.firstName,
        last_name: parsed.data.lastName,
        full_name: fullName,
        phone,
        country: parsed.data.country,
        locale: parsed.data.preferredLocale,
        privacy_accepted: true,
        privacy_policy_version: PRIVACY_POLICY_VERSION,
        privacy_accepted_at: acceptedAt,
        marketing_opt_in: parsed.data.marketingOptIn,
        consent_ip: meta.ip,
        consent_user_agent: meta.userAgent,
      },
      emailRedirectTo: `${NEXT_PUBLIC_APP_URL}/auth/callback?next=${encodeURIComponent(
        `/${locale}/verify-phone?next=${encodeURIComponent(target)}`,
      )}`,
    },
  });

  if (error) {
    logger.warn("auth.sign_up_failed", {
      message: error.message,
      code: error.code,
      phone,
    });
    if (/phone|profiles_phone_key|database error/i.test(error.message) && /duplicate|database/i.test(error.message)) {
      return formError(dict.auth.phoneTaken, { phone: [dict.auth.phoneTaken] });
    }
    const message = /already|registered|exists/i.test(error.message)
      ? dict.auth.haveAccount
      : dict.errors.generic;
    return formError(message);
  }

  if (data.session && data.user) {
    // With email confirmations disabled the account is already confirmed and
    // the trigger has set email_verified_at. Phone proof is still required.
    revalidatePath("/", "layout");
    redirect(`/${locale}/verify-phone?next=${encodeURIComponent(target)}`);
  }

  redirect(
    `/${locale}/verify-email?email=${encodeURIComponent(parsed.data.email)}&sent=1&next=${encodeURIComponent(
      target,
    )}`,
  );
}

export async function resendEmailVerificationAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const locale = localeFrom(formData);
  const dict = await getDictionary(locale);
  const meta = await getRequestMeta();
  const parsed = emailSchema.safeParse(formData.get("email"));

  if (!parsed.success) {
    return formError(dict.auth.emailInvalid, { email: [dict.auth.emailInvalid] });
  }
  if (!rateLimit(`verify-email:${meta.ip ?? "unknown"}:${parsed.data}`, 3, 10 * 60_000)) {
    return formError(dict.identity.tooManyAttempts);
  }

  const { NEXT_PUBLIC_APP_URL } = getPublicEnv();
  const supabase = await createClient();
  await supabase.auth.resend({
    type: "signup",
    email: parsed.data,
    options: {
      emailRedirectTo: `${NEXT_PUBLIC_APP_URL}/auth/callback?next=${encodeURIComponent(
        `/${locale}/verify-phone`,
      )}`,
    },
  });

  // Never reveal whether an address exists or is already confirmed.
  return formSuccess(dict.identity.verifyEmailResent);
}

export async function requestPasswordResetAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const locale = localeFrom(formData);
  const dict = await getDictionary(locale);
  const meta = await getRequestMeta();

  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) {
    return formError(dict.auth.emailInvalid, { email: [dict.auth.emailInvalid] });
  }
  if (!rateLimit(`reset:${meta.ip ?? "unknown"}:${parsed.data}`, 3, 15 * 60_000)) {
    return formError(dict.identity.tooManyAttempts);
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
  if (error) {
    logger.warn("auth.password_update_failed", { message: error.message });
    return formError(dict.errors.generic);
  }

  return formSuccess(dict.auth.passwordUpdated);
}

export async function signOutAction(formData: FormData): Promise<void> {
  const locale = localeFrom(formData);
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect(`/${locale}/login`);
}
