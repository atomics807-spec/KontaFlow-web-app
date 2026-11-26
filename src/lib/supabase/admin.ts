import "server-only";

import { createClient } from "@supabase/supabase-js";
import { getPublicEnv, getServerEnv } from "../env";
import { AppError } from "../errors";
import type { Database } from "@/types/database";

/**
 * Service-role client. Bypasses RLS: only use it in trusted server contexts
 * (webhooks, cron jobs, channel adapters) and always scope queries by an
 * explicitly resolved workspace_id.
 */
export function createAdminClient() {
  const env = getPublicEnv();
  const { SUPABASE_SERVICE_ROLE_KEY } = getServerEnv();

  if (!SUPABASE_SERVICE_ROLE_KEY) {
    throw new AppError(
      "configuration_missing",
      "This feature is not configured on this deployment yet.",
    );
  }

  return createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export function hasServiceRole(): boolean {
  try {
    return Boolean(getServerEnv().SUPABASE_SERVICE_ROLE_KEY);
  } catch {
    return false;
  }
}
