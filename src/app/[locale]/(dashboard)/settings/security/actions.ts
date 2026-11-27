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
import { consumeRateLimit } from "@/lib/security/durable-rate-limit";
import { logSecurityEvent } from "@/lib/security/events";
import { getWorkspaceContext } from "@/lib/supabase/auth";
import { PRIVACY_POLICY_VERSION } from "@/lib/legal";
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
  if (!(await consumeRateLimit(`password-change:${meta.ip ?? "unknown"}:${user.id}`, 5, 15 * 60))) {
    return formError(dict.identity.tooManyAttempts);
  }

  const supabase = await createClient();
  const { error: reauthError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: parsed.data.current,
  });
  if (reauthError) {
    await logSecurityEvent({
      type: "auth.password_change_reauthentication_failed",
      userId: user.id,
      severity: "warning",
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
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
  await logSecurityEvent({
    type: "auth.password_changed",
    userId: user.id,
    ip: meta.ip,
    userAgent: meta.userAgent,
  });
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
  if (!(await consumeRateLimit(`session-revoke:${user.id}`, 10, 60))) {
    return formError(dict.identity.tooManyAttempts);
  }

  await supabase.auth.signOut({ scope: "others" });
  await logSecurityEvent({ type: "auth.other_sessions_revoked", userId: user.id });
  revalidatePath("/", "layout");
  return formSuccess(dict.identity.sessionsCleared);
}

export async function signOutEverywhereAction(formData: FormData): Promise<void> {
  const locale = resolveLocale(String(formData.get("locale") ?? "en"));
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user && !(await consumeRateLimit(`session-revoke-all:${user.id}`, 5, 60))) {
    redirect(`/${locale}/settings/security`);
  }
  await supabase.auth.signOut({ scope: "global" });
  if (user) await logSecurityEvent({ type: "auth.all_sessions_revoked", userId: user.id });
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

  if (!(await consumeRateLimit(`recovery:${meta.ip ?? "unknown"}:${user.id}`, 3, 15 * 60))) {
    return formError(dict.identity.tooManyAttempts);
  }

  const { NEXT_PUBLIC_APP_URL } = getPublicEnv();
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(user.email, {
    redirectTo: `${NEXT_PUBLIC_APP_URL}/auth/callback?next=/${locale}/reset-password`,
  });
  await logSecurityEvent({
    type: "auth.recovery_email_requested",
    userId: user.id,
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  return formSuccess(dict.identity.recoverySent);
}

const deletionReasonSchema = z.string().trim().max(2000).optional();

export async function requestAccountDeletionAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const locale = resolveLocale(String(formData.get("locale") ?? "en"));
  const dict = await getDictionary(locale);
  const meta = await getRequestMeta();
  const user = await getSessionUser();
  if (!user) return formError(dict.errors.sessionExpired);

  if (!(await consumeRateLimit(`account-deletion:${user.id}`, 3, 60 * 60))) {
    return formError(dict.identity.tooManyAttempts);
  }

  const reason = deletionReasonSchema.safeParse(formData.get("reason") ?? undefined);
  if (!reason.success) return formError(dict.errors.generic);

  const context = await getWorkspaceContext();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("request_account_deletion", {
    p_reason: reason.data || null,
    p_workspace_id: context?.workspace.id ?? null,
  });
  if (error) {
    logger.warn("privacy.deletion_request_failed", { code: error.code });
    return formError(dict.errors.generic);
  }

  const result = data as { existing?: boolean } | null;
  await logSecurityEvent({
    type: result?.existing ? "privacy.deletion_request_seen" : "privacy.deletion_request_submitted",
    userId: user.id,
    workspaceId: context?.workspace.id ?? null,
    severity: "warning",
    ip: meta.ip,
    userAgent: meta.userAgent,
  });
  revalidatePath(`/${locale}/settings/security`);
  return formSuccess(
    result?.existing ? dict.identity.deletionRequestExisting : dict.identity.deletionRequested,
  );
}

export async function cancelAccountDeletionAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const locale = resolveLocale(String(formData.get("locale") ?? "en"));
  const dict = await getDictionary(locale);
  const user = await getSessionUser();
  if (!user) return formError(dict.errors.sessionExpired);

  const parsed = z.uuid().safeParse(formData.get("requestId"));
  if (!parsed.success) return formError(dict.errors.generic);
  const meta = await getRequestMeta();
  if (!(await consumeRateLimit(`account-deletion-cancel:${user.id}`, 10, 60))) {
    return formError(dict.identity.tooManyAttempts);
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_account_deletion", { p_request_id: parsed.data });
  if (error) {
    logger.warn("privacy.deletion_cancel_failed", { code: error.code });
    return formError(dict.errors.generic);
  }
  await logSecurityEvent({
    type: "privacy.deletion_cancelled",
    userId: user.id,
    ip: meta.ip,
    userAgent: meta.userAgent,
  });
  revalidatePath(`/${locale}/settings/security`);
  return formSuccess(dict.identity.deletionCancelled);
}

export async function updateMarketingConsentAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const locale = resolveLocale(String(formData.get("locale") ?? "en"));
  const dict = await getDictionary(locale);
  const meta = await getRequestMeta();
  const user = await getSessionUser();
  if (!user) return formError(dict.errors.sessionExpired);

  const optIn = formData.get("marketing") === "on";
  if (!(await consumeRateLimit(`marketing-consent:${user.id}`, 20, 60))) {
    return formError(dict.identity.tooManyAttempts);
  }
  const supabase = await createClient();
  const { data: active } = await supabase
    .from("privacy_consents")
    .select("id")
    .eq("user_id", user.id)
    .eq("consent_type", "marketing")
    .is("revoked_at", null)
    .maybeSingle();

  if (optIn && !active) {
    const { error } = await supabase.from("privacy_consents").insert({
      user_id: user.id,
      consent_type: "marketing",
      version: PRIVACY_POLICY_VERSION,
      granted: true,
      granted_at: new Date().toISOString(),
      locale,
      ip: meta.ip,
      user_agent: meta.userAgent,
      source: "settings",
      metadata: { channel: "web_settings" },
    });
    if (error) return formError(dict.errors.generic);
  } else if (!optIn && active) {
    const { error } = await supabase
      .from("privacy_consents")
      .update({ granted: false, revoked_at: new Date().toISOString() })
      .eq("id", active.id);
    if (error) return formError(dict.errors.generic);
  }

  await logSecurityEvent({
    type: optIn ? "privacy.marketing_consent_granted" : "privacy.marketing_consent_revoked",
    userId: user.id,
    ip: meta.ip,
    userAgent: meta.userAgent,
  });
  revalidatePath(`/${locale}/settings/security`);
  return formSuccess(optIn ? dict.identity.marketingEnabled : dict.identity.marketingDisabled);
}
