import "server-only";

import { createClient } from "@/lib/supabase/server";
import { assertNoError } from "@/lib/supabase/errors";
import { resolveLocale, type Locale } from "@/lib/i18n/config";
import type { ReportDeliveryRow, ReportFrequency } from "@/types/database";

export type ReportPreferences = {
  language: Locale;
  frequency: ReportFrequency;
  emailEnabled: boolean;
  inAppEnabled: boolean;
  whatsappEnabled: boolean;
};

export type ReportPreferencesUpdate = ReportPreferences & {
  workspaceId: string;
  userId: string;
};

export async function getReportPreferences(
  workspaceId: string,
  userId: string,
): Promise<ReportPreferences> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("report_preferences")
    .select("language, frequency, email_enabled, in_app_enabled, whatsapp_enabled")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw assertNoError(error, "Could not load report preferences.");

  if (data) {
    return {
      language: resolveLocale(data.language),
      frequency: data.frequency,
      emailEnabled: data.email_enabled,
      inAppEnabled: data.in_app_enabled,
      whatsappEnabled: data.whatsapp_enabled,
    };
  }

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("locale")
    .eq("id", workspaceId)
    .maybeSingle();

  return {
    language: resolveLocale(workspace?.locale ?? "en"),
    frequency: "daily",
    emailEnabled: true,
    inAppEnabled: true,
    whatsappEnabled: false,
  };
}

export async function updateReportPreferences(params: ReportPreferencesUpdate): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("report_preferences").upsert(
    {
      workspace_id: params.workspaceId,
      user_id: params.userId,
      language: params.language,
      frequency: params.frequency,
      email_enabled: params.emailEnabled,
      in_app_enabled: params.inAppEnabled,
      whatsapp_enabled: params.whatsappEnabled,
    },
    { onConflict: "workspace_id,user_id" },
  );
  if (error) throw assertNoError(error, "Could not save report preferences.");
}

export async function listReportDeliveries(
  workspaceId: string,
  limit = 12,
): Promise<ReportDeliveryRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("report_deliveries")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw assertNoError(error, "Could not load report deliveries.");
  return data ?? [];
}

export async function getVerifiedWhatsappAddress(
  workspaceId: string,
  userId: string,
): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("channel_identities")
    .select("address")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .eq("channel", "whatsapp")
    .not("verified_at", "is", null)
    .not("consent_at", "is", null)
    .is("opted_out_at", null)
    .order("verified_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw assertNoError(error, "Could not check the WhatsApp channel.");
  return data?.address ?? null;
}
