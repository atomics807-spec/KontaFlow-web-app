"use server";

import { cookies } from "next/headers";
import { redirect, unstable_rethrow } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  getPlatformAdmin,
  getProfile,
  getSessionUser,
  getWorkspaceContext,
  WORKSPACE_COOKIE,
} from "@/lib/supabase/auth";
import { mapSupabaseError } from "@/lib/supabase/errors";
import { getDictionary } from "@/lib/i18n/server";
import { resolveLocale, LOCALE_COOKIE } from "@/lib/i18n/config";
import { onboardingSchema } from "@/lib/validation/onboarding";
import { normalizePhone } from "@/lib/validation/phone";
import { fieldErrorsFrom, formError, type FormState } from "@/lib/action-utils";
import { logger } from "@/lib/logger";
import { getRequestMeta } from "@/lib/security/request-meta";
import { consumeRateLimit } from "@/lib/security/durable-rate-limit";
import { LOGO_MIMES, validateUploadedFile } from "@/lib/security/file-validation";
import { scanBlocksUpload, scanUploadedFile } from "@/lib/security/malware-scan";
import { logSecurityEvent, writeWorkspaceAudit } from "@/lib/security/events";
import { secureCookieFlag } from "@/lib/security/cookies";

const MAX_LOGO_BYTES = 2 * 1024 * 1024;

type CreatedWorkspace = { id: string; name: string; slug: string; onboarding_completed: boolean };

export async function createWorkspaceAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const locale = resolveLocale(String(formData.get("locale") ?? "en"));

  try {
    return await runCreateWorkspaceAction(formData, locale);
  } catch (error) {
    // Preserve Next's redirect/notFound control flow; only swallow real failures.
    unstable_rethrow(error);
    logger.error("workspace.onboarding_unhandled", { error });

    // The RPC may have committed before a later step (logo, cookies, revalidate)
    // failed. Send the owner to the workspace instead of stranding them here.
    const context = await getWorkspaceContext().catch(() => null);
    if (context) redirect(`/${locale}/dashboard?welcome=1`);

    const dict = await getDictionary(locale);
    return formError(dict.errors.generic);
  }
}

async function runCreateWorkspaceAction(
  formData: FormData,
  locale: ReturnType<typeof resolveLocale>,
): Promise<FormState> {
  const dict = await getDictionary(locale);
  const user = await getSessionUser();
  if (!user) return formError(dict.errors.sessionExpired);
  if (await getPlatformAdmin()) return formError(dict.admin.noAccess);

  const profile = await getProfile();
  if (!profile) return formError(dict.errors.generic);
  const meta = await getRequestMeta();
  if (!(await consumeRateLimit(`workspace-create:${user.id}`, 5, 60 * 60))) {
    return formError(dict.identity.tooManyAttempts);
  }
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
  const logoFile = logoEntry instanceof File && logoEntry.size > 0 ? logoEntry : null;
  let logo: { bytes: Uint8Array; mime: string; extension: string; sizeBytes: number } | null = null;
  if (logoFile) {
    const bytes = new Uint8Array(await logoFile.arrayBuffer());
    const validated = validateUploadedFile({
      name: logoFile.name,
      type: logoFile.type,
      size: logoFile.size,
      bytes,
      allowed: LOGO_MIMES,
      maxBytes: MAX_LOGO_BYTES,
    });
    if (!validated.ok) {
      return formError(dict.onboarding.logoHint, { logo: [dict.onboarding.logoHint] });
    }
    const scan = await scanUploadedFile({
      bytes: validated.bytes,
      fileName: validated.fileName,
      mime: validated.mime,
    });
    if (scanBlocksUpload(scan)) {
      await logSecurityEvent({
        type: "upload.malware_blocked",
        userId: user.id,
        severity: "critical",
        ip: meta.ip,
        userAgent: meta.userAgent,
        metadata: { context: "workspace_logo", scan: scan.status, reason: scan.reason },
      });
      return formError(dict.onboarding.logoHint, { logo: [dict.onboarding.logoHint] });
    }
    logo = {
      bytes: validated.bytes,
      mime: validated.mime,
      extension: validated.extension,
      sizeBytes: validated.sizeBytes,
    };
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

  if (logo) {
    const path = `${workspace.id}/logo-${Date.now()}.${logo.extension}`;
    const { error: uploadError } = await supabase.storage
      .from("kontaflow-workspace-logos")
      .upload(path, logo.bytes, {
        contentType: logo.mime,
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
      await Promise.all([
        logSecurityEvent({
          type: "upload.accepted",
          userId: user.id,
          workspaceId: workspace.id,
          ip: meta.ip,
          userAgent: meta.userAgent,
          metadata: { context: "workspace_logo", mime: logo.mime, size: logo.sizeBytes },
        }),
        writeWorkspaceAudit({
          workspaceId: workspace.id,
          actorId: user.id,
          action: "workspace.logo_uploaded",
          entity: "workspace",
          entityId: workspace.id,
          metadata: { mime: logo.mime, size: logo.sizeBytes },
          ip: meta.ip,
          userAgent: meta.userAgent,
        }),
      ]);
    }
  }

  const cookieStore = await cookies();
  cookieStore.set(WORKSPACE_COOKIE, workspace.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: secureCookieFlag(),
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  cookieStore.set(LOCALE_COOKIE, parsed.data.uiLocale, {
    httpOnly: false,
    sameSite: "lax",
    secure: secureCookieFlag(),
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
    secure: secureCookieFlag(),
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
