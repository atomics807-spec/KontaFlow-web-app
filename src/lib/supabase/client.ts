import { createBrowserClient } from "@supabase/ssr";
import { getPublicEnv } from "../env";
import type { Database } from "@/types/database";

let browserClient: ReturnType<typeof createBrowserClient<Database>> | null = null;

/** Browser-side Supabase client. Safe to expose: access is enforced by RLS. */
export function createClient() {
  if (browserClient) return browserClient;
  const env = getPublicEnv();
  browserClient = createBrowserClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      auth: {
        flowType: "pkce",
        detectSessionInUrl: true,
        persistSession: true,
        autoRefreshToken: true,
      },
    },
  );
  return browserClient;
}
