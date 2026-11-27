import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { assertNoError } from "@/lib/supabase/errors";
import { todayInZone } from "@/lib/dates";
import type { AdvisorFocus } from "@/types/ai-advisor";
import type { AccountRow, CategoryRow, ContactRow, Database, DebtRow, WorkspaceRow } from "@/types/database";
import type { AiReferenceData } from "./command-builder";

export async function loadAiReference(
  workspace: WorkspaceRow,
  client?: SupabaseClient<Database>,
): Promise<AiReferenceData> {
  const supabase = client ?? (await createClient());
  const [categories, accounts, contacts, debts, settings, preferences] = await Promise.all([
    supabase
      .from("categories")
      .select("*")
      .eq("workspace_id", workspace.id)
      .eq("is_archived", false)
      .order("kind")
      .order("name"),
    supabase
      .from("accounts")
      .select("*")
      .eq("workspace_id", workspace.id)
      .eq("is_archived", false)
      .order("name"),
    supabase
      .from("contacts")
      .select("*")
      .eq("workspace_id", workspace.id)
      .eq("is_archived", false)
      .order("name")
      .limit(60),
    supabase
      .from("debts")
      .select("*")
      .eq("workspace_id", workspace.id)
      .in("status", ["open", "partially_paid"])
      .order("opened_on")
      .limit(200),
    supabase
      .from("business_settings")
      .select("ai_auto_post, ai_auto_post_max_minor")
      .eq("workspace_id", workspace.id)
      .maybeSingle(),
    supabase
      .from("ai_workspace_preferences")
      .select("*")
      .eq("workspace_id", workspace.id)
      .maybeSingle(),
  ]);

  if (categories.error) throw assertNoError(categories.error, "Could not load categories.");
  if (accounts.error) throw assertNoError(accounts.error, "Could not load accounts.");
  if (contacts.error) throw assertNoError(contacts.error, "Could not load contacts.");
  if (debts.error) throw assertNoError(debts.error, "Could not load debts.");
  if (settings.error) throw assertNoError(settings.error, "Could not load AI settings.");
  if (preferences.error) throw assertNoError(preferences.error, "Could not load AI preferences.");

  return {
    workspace,
    today: todayInZone(workspace.timezone),
    categories: (categories.data ?? []) as CategoryRow[],
    accounts: (accounts.data ?? []) as AccountRow[],
    contacts: (contacts.data ?? []) as ContactRow[],
    debts: (debts.data ?? []) as DebtRow[],
    settings: {
      autoPost: Boolean(settings.data?.ai_auto_post),
      autoPostMaxMinor: BigInt(String(settings.data?.ai_auto_post_max_minor ?? 5000)),
      insightsEnabled: Boolean(preferences.data?.insights_enabled ?? true),
      analysisWindowDays: Number(preferences.data?.analysis_window_days ?? 180),
      advisorFocus: (preferences.data?.advisor_focus ?? "balanced") as AdvisorFocus,
      advisorNote: (preferences.data?.advisor_note as string | null | undefined) ?? null,
    },
  };
}
