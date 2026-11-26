"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getPlatformAdmin, getProfile, getSessionUser, WORKSPACE_COOKIE } from "@/lib/supabase/auth";
import { mapSupabaseError } from "@/lib/supabase/errors";
import { getDictionary } from "@/lib/i18n/server";
import { resolveLocale, LOCALE_COOKIE } from "@/lib/i18n/config";
import { onboardingSchema } from "@/lib/validation/onboarding";
import { normalizePhone } from "@/lib/validation/phone";
import { fieldErrorsFrom, formError, type FormState } from "@/lib/action-utils";
import { logger } from "@/lib/logger";

const LOGO_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};
const MAX_LOGO_BYTES = 2 * 1024 * 1024;

type CreatedWorkspace = { id: string; name: string; slug: string; onboarding_completed: boolean };

export async function createWorkspaceAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const locale = resolveLocale(String(formData.get("locale") ?? "en"));
  const dict = await getDictionary(locale);
  const user = await getSessionUser();
  if (!user) return formError(dict.errors.sessionExpired);
  if (await getPlatformAdmin()) return formError(dict.admin.noAccess);

  const profile = await getProfile();
  if (!profile) return formError(dict.errors.generic);
  if (
    profile.verification_required &&
    (!(user.email_confirmed_at || profile.email_verified_at) || !profile.phone_verified_at)
  ) {
    return formError(dict.identity.verificationRequired);
  }

  const parsed = onboardingSchema.safeParse({
    name: formData.get("name"),
    legalName: formData.get("legalName") ?? "",
    businessType: formData.get("businessType"),
    city: formData.get("city"),
    industry: formData.get("industry"),
    businessSize: formData.get("businessSize"),
    currency: formData.get("currency") ?? "XAF",
    fiscalYearStartMonth: formData.get("fiscalYearStartMonth") ?? 1,
    country: formData.get("country") ?? "CM",
    timezone: formData.get("timezone") ?? "Africa/Douala",
    uiLocale: formData.get("uiLocale") ?? locale,
    businessPhone: formData.get("businessPhone") ?? "",
  });

  if (!parsed.success) {
    return formError(dict.errors.generic, fieldErrorsFrom(parsed.error));
  }

  const businessPhone = parsed.data.businessPhone
    ? normalizePhone(parsed.data.businessPhone, parsed.data.country)
    : null;
  if (parsed.data.businessPhone && !businessPhone) {
    return formError(dict.auth.phoneInvalid, { businessPhone: [dict.auth.phoneInvalid] });
  }

  const logoEntry = formData.get("logo");
  const logo = logoEntry instanceof File && logoEntry.size > 0 ? logoEntry : null;
  const logoExtension = logo ? LOGO_TYPES[logo.type] : null;
  if (logo && (!logoExtension || logo.size > MAX_LOGO_BYTES)) {
    return formError(dict.onboarding.logoHint, { logo: [dict.onboarding.logoHint] });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("complete_onboarding", {
    p_name: parsed.data.name,
    p_business_type: parsed.data.businessType,
    p_city: parsed.data.city,
    p_industry: parsed.data.industry,
    p_business_size: parsed.data.businessSize,
    p_currency: parsed.data.currency,
    p_fiscal_year_start_month: parsed.data.fiscalYearStartMonth,
    p_country: parsed.data.country.toUpperCase(),
    p_phone: businessPhone,
    p_timezone: parsed.data.timezone,
    p_locale: parsed.data.uiLocale,
    p_legal_name: parsed.data.legalName || null,
  });

  if (error) {
    const mapped = mapSupabaseError(error, dict.errors.generic);
    logger.warn("workspace.onboarding_failed", { code: error.code });
    return formError(mapped.publicMessage);
  }

  const workspace = data as CreatedWorkspace | null;
  if (!workspace?.id) return formError(dict.errors.generic);

  if (logo && logoExtension) {
    const path = `${workspace.id}/logo-${Date.now()}.${logoExtension}`;
    const { error: uploadError } = await supabase.storage
      .from("kontaflow-workspace-logos")
      .upload(path, await logo.arrayBuffer(), {
        contentType: logo.type,
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      // The workspace exists; a missing logo is not worth losing the booking for.
      logger.warn("workspace.logo_upload_failed", { code: uploadError.message });
    } else {
      const { error: updateError } = await supabase
        .from("workspaces")
        .update({ logo_path: path })
        .eq("id", workspace.id);
      if (updateError) logger.warn("workspace.logo_save_failed", { code: updateError.code });
    }
  }

  const cookieStore = await cookies();
  cookieStore.set(WORKSPACE_COOKIE, workspace.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  cookieStore.set(LOCALE_COOKIE, parsed.data.uiLocale, {
    httpOnly: false,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  revalidatePath("/", "layout");
  redirect(`/${parsed.data.uiLocale}/dashboard?welcome=1`);
}

export async function switchWorkspaceAction(workspaceId: string, locale: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${resolveLocale(locale)}/login`);

  const { data: membership } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (!membership) throw new Error("You are not a member of that workspace.");

  const cookieStore = await cookies();
  cookieStore.set(WORKSPACE_COOKIE, workspaceId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  await supabase.from("profiles").update({ default_workspace_id: workspaceId }).eq("id", user.id);
  revalidatePath("/", "layout");
  redirect(`/${resolveLocale(locale)}/dashboard`);
}

export type OnboardingInput = z.infer<typeof onboardingSchema>;

export async function switchWorkspaceFormAction(formData: FormData): Promise<void> {
  const workspaceId = String(formData.get("workspaceId") ?? "");
  const locale = resolveLocale(String(formData.get("locale") ?? "en"));
  if (!workspaceId) redirect(`/${locale}/dashboard`);
  await switchWorkspaceAction(workspaceId, locale);
}
