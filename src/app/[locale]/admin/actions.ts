"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getActiveRestriction, getPlatformAdmin, getSessionUser } from "@/lib/supabase/auth";
import { getRequestMeta } from "@/lib/security/request-meta";
import { resolveLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/server";
import { rateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { fieldErrorsFrom, formError, formSuccess, type FormState } from "@/lib/action-utils";
import {
  banDurationForExpiry,
  billingSettingsSchema,
  createPlatformAdminSchema,
  expiryFromDuration,
  liftRestrictionSchema,
  planSaveSchema,
  platformAdminStatusSchema,
  restrictUserSchema,
  workspacePlanSchema,
} from "@/lib/validation/platform-admin";
import { FEATURE_IDS } from "@/types/entitlements";
import type { PlatformAdminRole } from "@/types/platform-admin";

type Guard = {
  userId: string;
  role: PlatformAdminRole;
  ip: string | null;
};

async function guard(minimum: "support" | "admin" | "super_admin"): Promise<Guard | null> {
  const user = await getSessionUser();
  if (!user) return null;
  if (await getActiveRestriction()) return null;
  const admin = await getPlatformAdmin();
  if (!admin) return null;
  const rank = { support: 10, admin: 20, super_admin: 30 } as const;
  if (rank[admin.role] < rank[minimum]) return null;
  const meta = await getRequestMeta();
  return { userId: user.id, role: admin.role, ip: meta.ip };
}

function revalidateAdmin(): void {
  revalidatePath("/admin");
  revalidatePath("/admin/users");
  revalidatePath("/admin/workspaces");
  revalidatePath("/admin/admins");
  revalidatePath("/admin/audit");
  revalidatePath("/admin/plans");
}

function failure(message: string, fieldErrors?: Record<string, string[]>): FormState {
  return formError(message, fieldErrors);
}

export async function restrictUserAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const locale = resolveLocale(String(formData.get("locale") ?? "en"));
  const dict = await getDictionary(locale);
  const context = await guard("admin");
  if (!context) return failure(dict.admin.noAccess);

  if (!rateLimit(`platform:restrict:${context.userId}`, 30, 15 * 60_000)) {
    return failure(dict.errors.rateLimited);
  }

  const parsed = restrictUserSchema.safeParse({
    userId: formData.get("userId"),
    severity: formData.get("severity"),
    reason: formData.get("reason"),
    duration: formData.get("duration"),
  });
  if (!parsed.success) return failure(dict.admin.actionFailed, fieldErrorsFrom(parsed.error));

  const expiresAt = expiryFromDuration(parsed.data.duration);
  const supabase = await createClient();
  const { data: restriction, error } = await supabase.rpc("platform_admin_restrict_user", {
    p_user_id: parsed.data.userId,
    p_severity: parsed.data.severity,
    p_reason: parsed.data.reason,
    p_expires_at: expiresAt,
    p_ip: context.ip,
  });
  if (error || !restriction) {
    logger.warn("platform_admin.restrict_failed", { code: error?.code, message: error?.message });
    return failure(dict.admin.actionFailed);
  }

  try {
    const admin = createAdminClient();
    await admin.auth.admin.updateUserById(parsed.data.userId, {
      ban_duration:
        parsed.data.severity === "suspended" ? banDurationForExpiry(expiresAt) : "none",
    });
  } catch (error) {
    logger.error("platform_admin.ban_sync_failed", { error });
    await supabase.rpc("platform_admin_lift_restriction", {
      p_restriction_id: restriction.id,
      p_reason: "Auth ban could not be applied",
      p_ip: context.ip,
    });
    return failure(dict.admin.actionFailed);
  }

  revalidateAdmin();
  return formSuccess(dict.admin.restrictionApplied);
}

export async function liftRestrictionAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const locale = resolveLocale(String(formData.get("locale") ?? "en"));
  const dict = await getDictionary(locale);
  const context = await guard("admin");
  if (!context) return failure(dict.admin.noAccess);

  const parsed = liftRestrictionSchema.safeParse({
    restrictionId: formData.get("restrictionId"),
    reason: formData.get("reason") || undefined,
  });
  if (!parsed.success) return failure(dict.admin.actionFailed, fieldErrorsFrom(parsed.error));

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("platform_admin_lift_restriction", {
    p_restriction_id: parsed.data.restrictionId,
    p_reason: parsed.data.reason ?? null,
    p_ip: context.ip,
  });
  if (error || !data) {
    logger.warn("platform_admin.lift_failed", { code: error?.code, message: error?.message });
    return failure(dict.admin.actionFailed);
  }

  try {
    const admin = createAdminClient();
    await admin.auth.admin.updateUserById(data.user_id, { ban_duration: "none" });
  } catch (error) {
    logger.error("platform_admin.unban_sync_failed", { error });
    return failure(dict.admin.actionFailed);
  }

  revalidateAdmin();
  return formSuccess(dict.admin.restrictionLifted);
}

export async function setWorkspacePlanAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const locale = resolveLocale(String(formData.get("locale") ?? "en"));
  const dict = await getDictionary(locale);
  const context = await guard("admin");
  if (!context) return failure(dict.admin.noAccess);

  const parsed = workspacePlanSchema.safeParse({
    workspaceId: formData.get("workspaceId"),
    plan: formData.get("plan"),
    note: formData.get("note") || undefined,
  });
  if (!parsed.success) return failure(dict.admin.actionFailed, fieldErrorsFrom(parsed.error));

  const supabase = await createClient();
  const { error } = await supabase.rpc("platform_admin_set_workspace_plan", {
    p_workspace_id: parsed.data.workspaceId,
    p_plan: parsed.data.plan,
    p_note: parsed.data.note ?? null,
    p_ip: context.ip,
  });
  if (error) {
    logger.warn("platform_admin.plan_failed", { code: error.code, message: error.message });
    return failure(dict.admin.actionFailed);
  }

  revalidateAdmin();
  return formSuccess(dict.admin.planUpdated);
}

export async function createPlatformAdminAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const locale = resolveLocale(String(formData.get("locale") ?? "en"));
  const dict = await getDictionary(locale);
  const context = await guard("super_admin");
  if (!context) return failure(dict.admin.cannotManageAdmins);

  if (!rateLimit(`platform:create-admin:${context.userId}`, 5, 60 * 60_000)) {
    return failure(dict.errors.rateLimited);
  }

  const parsed = createPlatformAdminSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    password: formData.get("password"),
    role: formData.get("role"),
  });
  if (!parsed.success) return failure(dict.admin.actionFailed, fieldErrorsFrom(parsed.error));

  const admin = createAdminClient();
  const { data: created, error: authError } = await admin.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: true,
    user_metadata: {
      full_name: parsed.data.fullName,
      platform_admin: true,
    },
  });
  if (authError || !created.user) {
    logger.warn("platform_admin.create_auth_failed", {
      code: authError?.code,
      message: authError?.message,
    });
    return failure(
      /already|registered|exists/i.test(authError?.message ?? "")
        ? dict.admin.emailTaken
        : dict.admin.actionFailed,
    );
  }

  const { error: rowError } = await admin.from("platform_admins").insert({
    user_id: created.user.id,
    role: parsed.data.role,
    created_by: context.userId,
  });
  if (rowError) {
    await admin.auth.admin.deleteUser(created.user.id).catch(() => undefined);
    logger.warn("platform_admin.create_row_failed", { code: rowError.code, message: rowError.message });
    return failure(dict.admin.actionFailed);
  }

  await admin.from("profiles").update({ verification_required: false }).eq("id", created.user.id);
  await admin.from("platform_admin_audit_log").insert({
    admin_user_id: context.userId,
    action: "platform_admin.created",
    target_type: "platform_admin",
    target_id: created.user.id,
    details: { email: parsed.data.email, role: parsed.data.role },
    ip: context.ip,
  });

  revalidateAdmin();
  return formSuccess(dict.admin.adminCreated);
}

export async function setPlatformAdminStatusAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const locale = resolveLocale(String(formData.get("locale") ?? "en"));
  const dict = await getDictionary(locale);
  const context = await guard("super_admin");
  if (!context) return failure(dict.admin.cannotManageAdmins);

  const parsed = platformAdminStatusSchema.safeParse({
    userId: formData.get("userId"),
    active: formData.get("active"),
  });
  if (!parsed.success) return failure(dict.admin.actionFailed, fieldErrorsFrom(parsed.error));

  const supabase = await createClient();
  const { error } = await supabase.rpc("platform_admin_set_admin_status", {
    p_user_id: parsed.data.userId,
    p_is_active: parsed.data.active,
    p_ip: context.ip,
  });
  if (error) {
    logger.warn("platform_admin.status_failed", { code: error.code, message: error.message });
    return failure(dict.admin.actionFailed);
  }

  try {
    const admin = createAdminClient();
    await admin.auth.admin.updateUserById(parsed.data.userId, {
      ban_duration: parsed.data.active ? "none" : "876000h",
    });
  } catch (error) {
    logger.error("platform_admin.status_ban_sync_failed", { error });
  }

  revalidateAdmin();
  return formSuccess(dict.admin.adminUpdated);
}

export async function savePlanAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const locale = resolveLocale(String(formData.get("locale") ?? "en"));
  const dict = await getDictionary(locale);
  const context = await guard("admin");
  if (!context) return failure(dict.admin.noAccess);

  if (!rateLimit(`platform:plan:${context.userId}`, 30, 15 * 60_000)) {
    return failure(dict.errors.rateLimited);
  }

  const parsed = planSaveSchema.safeParse({
    planCode: formData.get("planCode"),
    name: formData.get("name"),
    description: formData.get("description") ?? "",
    priceMinor: formData.get("priceMinor"),
    currency: formData.get("currency"),
    billingInterval: formData.get("billingInterval") ?? "month",
    seats: formData.get("seats"),
    workspaceLimit: formData.get("workspaceLimit"),
    aiMessageLimit: formData.get("aiMessageLimit"),
    transactionLimit: formData.get("transactionLimit"),
    integrationLimit: formData.get("integrationLimit"),
    exportLimit: formData.get("exportLimit"),
    sortOrder: formData.get("sortOrder"),
    isActive: formData.get("isActive") ?? "true",
  });
  if (!parsed.success) return failure(dict.admin.actionFailed, fieldErrorsFrom(parsed.error));

  const features = FEATURE_IDS.map((code) => {
    const included = formData.get(`feature_${code}`) === "on";
    const raw = String(formData.get(`limit_${code}`) ?? "").trim();
    const limit = raw ? Number(raw) : null;
    return {
      code,
      included,
      limit: included && limit !== null && Number.isInteger(limit) && limit >= 0 ? limit : null,
    };
  });

  const supabase = await createClient();
  const { error } = await supabase.rpc("platform_admin_save_plan", {
    p_plan_code: parsed.data.planCode,
    p_payload: {
      name: parsed.data.name,
      description: parsed.data.description,
      priceMinor: parsed.data.priceMinor,
      currency: parsed.data.currency,
      billingInterval: parsed.data.billingInterval,
      seats: parsed.data.seats,
      workspaceLimit: parsed.data.workspaceLimit,
      aiMessageLimit: parsed.data.aiMessageLimit,
      transactionLimit: parsed.data.transactionLimit,
      integrationLimit: parsed.data.integrationLimit,
      exportLimit: parsed.data.exportLimit,
      sortOrder: parsed.data.sortOrder,
      isActive: parsed.data.isActive,
      features,
    } as never,
    p_ip: context.ip,
  });
  if (error) {
    logger.warn("platform_admin.plan_save_failed", { code: error.code, message: error.message });
    return failure(dict.admin.actionFailed);
  }

  revalidateAdmin();
  return formSuccess(dict.admin.planUpdated);
}

export async function saveBillingSettingsAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const locale = resolveLocale(String(formData.get("locale") ?? "en"));
  const dict = await getDictionary(locale);
  const context = await guard("admin");
  if (!context) return failure(dict.admin.noAccess);

  if (!rateLimit(`platform:billing:${context.userId}`, 30, 15 * 60_000)) {
    return failure(dict.errors.rateLimited);
  }

  const parsed = billingSettingsSchema.safeParse({
    trialDays: formData.get("trialDays"),
    trialPlanCode: formData.get("trialPlanCode"),
    reminderDays: formData.get("reminderDays") ?? "7,3,1",
  });
  if (!parsed.success) return failure(dict.admin.actionFailed, fieldErrorsFrom(parsed.error));

  const supabase = await createClient();
  const { error } = await supabase.rpc("platform_admin_save_billing_settings", {
    p_trial_days: parsed.data.trialDays,
    p_trial_plan_code: parsed.data.trialPlanCode,
    p_reminder_days: parsed.data.reminderDays,
    p_ip: context.ip,
  });
  if (error) {
    logger.warn("platform_admin.billing_save_failed", { code: error.code, message: error.message });
    return failure(dict.admin.actionFailed);
  }

  revalidateAdmin();
  return formSuccess(dict.admin.billingUpdated);
}
