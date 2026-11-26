"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { WORKSPACE_COOKIE } from "@/lib/supabase/auth";
import { mapSupabaseError } from "@/lib/supabase/errors";
import { getDictionary } from "@/lib/i18n/server";
import { resolveLocale } from "@/lib/i18n/config";
import { workspaceSchema } from "@/lib/validation/schemas";
import { fieldErrorsFrom, formError, type FormState } from "@/lib/action-utils";
import { logger } from "@/lib/logger";

export async function createWorkspaceAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const locale = resolveLocale(String(formData.get("locale") ?? "en"));
  const dict = await getDictionary(locale);

  const parsed = workspaceSchema.safeParse({
    name: formData.get("name"),
    legalName: formData.get("legalName") ?? "",
    currency: formData.get("currency") ?? "XAF",
    country: formData.get("country") ?? "CM",
    timezone: formData.get("timezone") ?? "Africa/Douala",
    locale: formData.get("uiLocale") ?? locale,
  });

  if (!parsed.success) {
    return formError(dict.errors.generic, fieldErrorsFrom(parsed.error));
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return formError(dict.errors.sessionExpired);

  const { data, error } = await supabase.rpc("create_workspace", {
    p_name: parsed.data.name,
    p_currency: parsed.data.currency,
    p_country: parsed.data.country.toUpperCase(),
    p_timezone: parsed.data.timezone,
    p_legal_name: parsed.data.legalName || null,
    p_locale: parsed.data.locale,
  });

  if (error) {
    const mapped = mapSupabaseError(error, dict.errors.generic);
    logger.warn("workspace.create_failed", { code: error.code });
    return formError(mapped.publicMessage);
  }

  const created = data as { id?: string } | null;
  const workspaceId = created?.id;
  if (!workspaceId) return formError(dict.errors.generic);

  await supabase.from("profiles").update({ default_workspace_id: workspaceId }).eq("id", user.id);

  const cookieStore = await cookies();
  cookieStore.set(WORKSPACE_COOKIE, workspaceId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  revalidatePath("/", "layout");
  redirect(`/${locale}/dashboard`);
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

export const onboardingSchema = workspaceSchema;
export type OnboardingInput = z.infer<typeof workspaceSchema>;

export async function switchWorkspaceFormAction(formData: FormData): Promise<void> {
  const workspaceId = String(formData.get("workspaceId") ?? "");
  const locale = resolveLocale(String(formData.get("locale") ?? "en"));
  if (!workspaceId) redirect(`/${locale}/dashboard`);
  await switchWorkspaceAction(workspaceId, locale);
}
