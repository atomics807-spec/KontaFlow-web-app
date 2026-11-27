import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getPublicEnv, getSupabaseServerUrl } from "../env";
import { authCookieOptions, limitAuthCookie } from "@/lib/security/cookies";
import type { Database } from "@/types/database";

/**
 * Request-scoped Supabase client for Server Components, Server Actions and
 * Route Handlers. Sessions live in HTTP-only cookies managed by @supabase/ssr.
 */
export async function createClient() {
  const cookieStore = await cookies();
  const env = getPublicEnv();

  return createServerClient<Database>(getSupabaseServerUrl(), env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookieOptions: authCookieOptions(),
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, limitAuthCookie(options));
          }
        } catch {
          // Server Components cannot write cookies. The proxy refreshes the
          // session on navigation, so this is safe to ignore here.
        }
      },
    },
  });
}
