"use server";

import { revalidatePath } from "next/cache";
import { getWorkspaceContext } from "@/lib/supabase/auth";
import { can } from "@/lib/permissions";
import { resolveLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/server";
import { linkChannel, unlinkChannel, updateWorkspace } from "@/services/workspaces";
import { workspaceSchema } from "@/lib/validation/schemas";
import { fieldErrorsFrom, formError, formSuccess, type FormState } from "@/lib/action-utils";
import { isAppError } from "@/lib/errors";
import { persistLocalePreference } from "@/app/[locale]/locale-actions";
import { logger } from "@/lib/logger";

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

  if (!parsed.success) return formError(dict.errors.generic, fieldErrorsFrom(parsed.error));

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

export async function linkChannelAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const locale = resolveLocale(String(formData.get("locale") ?? "en"));
  const dict = await getDictionary(locale);
  const context = await getWorkspaceContext();
  if (!context) return formError(dict.errors.unauthorized);
  if (!can(context.role, "integrations:manage")) return formError(dict.errors.forbidden);

  const channel = String(formData.get("channel") ?? "whatsapp");
  const address = String(formData.get("address") ?? "").replace(/[\s()-]/g, "");

  if (channel !== "whatsapp" && channel !== "ussd") return formError(dict.errors.generic);
  if (!/^\+?\d{8,15}$/.test(address)) return formError(dict.errors.generic);

  try {
    await linkChannel(context.workspace.id, context.user.id, channel, address);
  } catch (error) {
    return formError(isAppError(error) ? error.publicMessage : dict.errors.generic);
  }

  revalidatePath(`/${locale}/settings`);
  return formSuccess(dict.settings.saved);
}

export async function unlinkChannelAction(formData: FormData): Promise<void> {
  const locale = resolveLocale(String(formData.get("locale") ?? "en"));
  const context = await getWorkspaceContext();
  if (!context || !can(context.role, "integrations:manage")) return;
  const id = String(formData.get("channelId") ?? "");
  if (!id) return;
  try {
    await unlinkChannel(context.workspace.id, id);
  } catch (error) {
    logger.warn("settings.unlink_channel_failed", { error });
  }
  revalidatePath(`/${locale}/settings`);
}
