"use server";

import { revalidatePath } from "next/cache";
import { getWorkspaceContext } from "@/lib/supabase/auth";
import { can } from "@/lib/permissions";
import { resolveLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/server";
import { updateWorkspace } from "@/services/workspaces";
import { requestWhatsappLink } from "@/services/whatsapp";
import { unlinkChannel } from "@/services/channels";
import { linkUssdChannel } from "@/services/ussd";
import { updateAiSettings } from "@/services/ai-commands";
import { purgeAiHistory, updateAiPreferences } from "@/services/ai-preferences";
import { parseMoneyToMinor } from "@/lib/money";
import { aiAdvisorPreferencesSchema, reportPreferencesSchema, workspaceSchema } from "@/lib/validation/schemas";
import { fieldErrorsFrom, formError, formSuccess, type FormState } from "@/lib/action-utils";
import { isAppError } from "@/lib/errors";
import { persistLocalePreference } from "@/app/[locale]/locale-actions";
import { logger } from "@/lib/logger";
import { normalizePhone } from "@/lib/validation/phone";
import { interpolate } from "@/lib/i18n/interpolate";
import { getWorkspaceEntitlements } from "@/lib/entitlements/service";
import { getServerEnv } from "@/lib/env";
import { getVerifiedWhatsappAddress, updateReportPreferences } from "@/services/report-preferences";

export async function updateWorkspaceAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const locale = resolveLocale(String(formData.get("locale") ?? "en"));
  const dict = await getDictionary(locale);
  const context = await getWorkspaceContext();
  if (!context) return formError(dict.errors.unauthorized);
  if (!can(context.role, "workspace:update")) return formError(dict.errors.forbidden);

  const parsed = workspaceSchema.safeParse({
    name: formData.get("name"),
    legalName: formData.get("legalName") ?? "",
    currency: formData.get("currency") ?? context.workspace.currency,
    country: formData.get("country") ?? context.workspace.country_code,
    timezone: formData.get("timezone") ?? context.workspace.timezone,
    locale: formData.get("uiLocale") ?? locale,
  });

  if (!parsed.success) {
    const missingChannel = parsed.error.issues.some((issue) => issue.path[0] === "channels");
    return formError(
      missingChannel ? dict.settings.reportsChannelRequired : dict.errors.generic,
      fieldErrorsFrom(parsed.error),
    );
  }

  try {
    await updateWorkspace(context.workspace.id, parsed.data);
  } catch (error) {
    return formError(isAppError(error) ? error.publicMessage : dict.errors.generic);
  }

  if (parsed.data.locale !== locale) {
    await persistLocalePreference(parsed.data.locale);
  }

  revalidatePath("/", "layout");
  return formSuccess(dict.settings.saved);
}

export async function updateAiSettingsAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const locale = resolveLocale(String(formData.get("locale") ?? "en"));
  const dict = await getDictionary(locale);
  const context = await getWorkspaceContext();
  if (!context) return formError(dict.errors.unauthorized);
  if (!can(context.role, "workspace:update")) return formError(dict.errors.forbidden);

  const rawLimit = String(formData.get("aiAutoPostMax") ?? "").trim();
  let maxMinor: bigint;
  try {
    maxMinor = parseMoneyToMinor(rawLimit, context.workspace.currency);
  } catch {
    return formError(dict.settings.aiAutoPostLimit);
  }
  if (maxMinor <= 0n || maxMinor > 1_000_000_000_000n) {
    return formError(dict.settings.aiAutoPostLimit);
  }

  try {
    await updateAiSettings({
      workspaceId: context.workspace.id,
      autoPost: formData.get("aiAutoPost") === "on",
      autoPostMaxMinor: maxMinor,
    });
  } catch (error) {
    return formError(isAppError(error) ? error.publicMessage : dict.errors.generic);
  }

  revalidatePath(`/${locale}/settings`);
  revalidatePath(`/${locale}/assistant`);
  return formSuccess(dict.settings.aiAutoPostSaved);
}

export async function updateAiAdvisorSettingsAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const locale = resolveLocale(String(formData.get("locale") ?? "en"));
  const dict = await getDictionary(locale);
  const context = await getWorkspaceContext();
  if (!context) return formError(dict.errors.unauthorized);
  if (context.role !== "owner") return formError(dict.errors.forbidden);

  const parsed = aiAdvisorPreferencesSchema.safeParse({
    insightsEnabled: formData.get("insightsEnabled") === "on",
    analysisWindowDays: formData.get("analysisWindowDays"),
    historyRetentionDays: formData.get("historyRetentionDays"),
    advisorFocus: formData.get("advisorFocus"),
    advisorNote: formData.get("advisorNote") ?? "",
  });
  if (!parsed.success) {
    const missingChannel = parsed.error.issues.some((issue) => issue.path[0] === "channels");
    return formError(
      missingChannel ? dict.settings.reportsChannelRequired : dict.errors.generic,
      fieldErrorsFrom(parsed.error),
    );
  }

  try {
    await updateAiPreferences({
      workspaceId: context.workspace.id,
      insightsEnabled: parsed.data.insightsEnabled,
      analysisWindowDays: parsed.data.analysisWindowDays,
      historyRetentionDays: parsed.data.historyRetentionDays,
      advisorFocus: parsed.data.advisorFocus,
      advisorNote: parsed.data.advisorNote || null,
    });
  } catch (error) {
    return formError(isAppError(error) ? error.publicMessage : dict.errors.generic);
  }

  revalidatePath(`/${locale}/settings`);
  revalidatePath(`/${locale}/insights`);
  revalidatePath(`/${locale}/assistant`);
  return formSuccess(dict.settings.aiAdvisorSaved);
}

export async function purgeAiHistoryAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const locale = resolveLocale(String(formData.get("locale") ?? "en"));
  const dict = await getDictionary(locale);
  const context = await getWorkspaceContext();
  if (!context) return formError(dict.errors.unauthorized);
  if (context.role !== "owner") return formError(dict.errors.forbidden);

  try {
    const result = await purgeAiHistory(context.workspace.id, { deleteAll: true });
    revalidatePath(`/${locale}/settings`);
    revalidatePath(`/${locale}/assistant`);
    return formSuccess(
      dict.settings.aiHistoryPurged.replace(
        "{count}",
        String(result.messages + result.interactions + result.conversations),
      ),
    );
  } catch (error) {
    return formError(isAppError(error) ? error.publicMessage : dict.errors.generic);
  }
}

export async function updateReportPreferencesAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const locale = resolveLocale(String(formData.get("locale") ?? "en"));
  const dict = await getDictionary(locale);
  const context = await getWorkspaceContext();
  if (!context) return formError(dict.errors.unauthorized);

  const parsed = reportPreferencesSchema.safeParse({
    language: formData.get("reportLanguage"),
    frequency: formData.get("reportFrequency"),
    emailEnabled: formData.get("reportEmail") === "on",
    inAppEnabled: formData.get("reportInApp") === "on",
    whatsappEnabled: formData.get("reportWhatsapp") === "on",
  });
  if (!parsed.success) {
    const missingChannel = parsed.error.issues.some((issue) => issue.path[0] === "channels");
    return formError(
      missingChannel ? dict.settings.reportsChannelRequired : dict.errors.generic,
      fieldErrorsFrom(parsed.error),
    );
  }

  if (parsed.data.whatsappEnabled) {
    const entitlements = await getWorkspaceEntitlements(context.workspace.id, context.user.id);
    if (!entitlements.features.whatsapp_integration.included) {
      return formError(
        interpolate(dict.plans.lockedBody, {
          plan: entitlements.features.whatsapp_integration.requiredPlan ?? dict.plans.growth,
        }),
      );
    }
    const address = await getVerifiedWhatsappAddress(context.workspace.id, context.user.id);
    if (!address) return formError(dict.settings.reportsWhatsappUnavailable);
  }

  try {
    await updateReportPreferences({
      workspaceId: context.workspace.id,
      userId: context.user.id,
      language: parsed.data.language,
      frequency: parsed.data.frequency,
      emailEnabled: parsed.data.emailEnabled,
      inAppEnabled: parsed.data.inAppEnabled,
      whatsappEnabled: parsed.data.whatsappEnabled,
    });
  } catch (error) {
    return formError(isAppError(error) ? error.publicMessage : dict.errors.generic);
  }

  revalidatePath(`/${locale}/settings`);
  return formSuccess(dict.settings.reportsSaved);
}

export async function linkChannelAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const locale = resolveLocale(String(formData.get("locale") ?? "en"));
  const dict = await getDictionary(locale);
  const context = await getWorkspaceContext();
  if (!context) return formError(dict.errors.unauthorized);
  if (!can(context.role, "integrations:manage")) return formError(dict.errors.forbidden);

  const channel = String(formData.get("channel") ?? "whatsapp");
  const rawAddress = String(formData.get("address") ?? "");
  const address = normalizePhone(rawAddress, context.workspace.country_code);

  if (channel !== "whatsapp" && channel !== "ussd") return formError(dict.errors.generic);
  if (!address) return formError(dict.settings.phoneInvalid);

  const entitlements = await getWorkspaceEntitlements(context.workspace.id, context.user.id);
  const feature = channel === "whatsapp" ? "whatsapp_integration" : "ussd_integration";
  if (!entitlements.features[feature].included) {
    return formError(
      interpolate(dict.plans.lockedBody, {
        plan: entitlements.features[feature].requiredPlan ?? dict.plans.growth,
      }),
    );
  }
  if (!entitlements.writable) return formError(dict.plans.readOnly);
  const integrationLimit = entitlements.limits.integrations;
  if (integrationLimit !== null && entitlements.usage.integrations >= integrationLimit) {
    return formError(dict.errors.generic);
  }

  try {
    if (channel === "whatsapp") {
      const result = await requestWhatsappLink({
        workspaceId: context.workspace.id,
        userId: context.user.id,
        address,
        countryCode: context.workspace.country_code,
        locale,
      });
      const business =
        getServerEnv().WHATSAPP_DISPLAY_PHONE_NUMBER ?? dict.settings.whatsappBusinessFallback;
      const message = interpolate(dict.settings.whatsappLinkRequested, {
        code: result.code,
        phone: result.address,
        business,
      });
      revalidatePath(`/${locale}/settings`);
      return formSuccess(
        result.templateSent ? `${message} ${dict.settings.whatsappTemplateSent}` : message,
      );
    }

    const result = await linkUssdChannel({
      workspaceId: context.workspace.id,
      userId: context.user.id,
      address,
      countryCode: context.workspace.country_code,
    });
    const service = getServerEnv().USSD_SERVICE_CODE ?? dict.settings.ussdServiceFallback;
    const message = interpolate(dict.settings.ussdLinkRequested, {
      code: result.code,
      phone: result.address,
      service,
    });
    revalidatePath(`/${locale}/settings`);
    return formSuccess(message);
  } catch (error) {
    return formError(isAppError(error) ? error.publicMessage : dict.errors.generic);
  }
}

export async function unlinkChannelAction(formData: FormData): Promise<void> {
  const locale = resolveLocale(String(formData.get("locale") ?? "en"));
  const context = await getWorkspaceContext();
  if (!context || !can(context.role, "integrations:manage")) return;
  const id = String(formData.get("channelId") ?? "");
  if (!id) return;
  try {
    await unlinkChannel(context.workspace.id, id, context.user.id);
  } catch (error) {
    logger.warn("settings.unlink_channel_failed", { error });
  }
  revalidatePath(`/${locale}/settings`);
}
