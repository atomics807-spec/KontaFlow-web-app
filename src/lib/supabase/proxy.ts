import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getPublicEnv, getSupabaseServerUrl } from "../env";
import { logger } from "../logger";
import type { Database } from "@/types/database";

/**
 * Refreshes the Supabase session for a request and returns the (possibly
 * mutated) response so downstream logic can redirect without losing cookies.
 */
export async function refreshSession(request: NextRequest): Promise<{
  response: NextResponse;
  userId: string | null;
}> {
  let response = NextResponse.next({ request });

  try {
    const env = getPublicEnv();
    const supabase = createServerClient<Database>(getSupabaseServerUrl(), env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    });

    const {
      data: { user },
    } = await supabase.auth.getUser();

    return { response, userId: user?.id ?? null };
  } catch (error) {
    logger.warn("proxy.session_refresh_failed", { error });
    return { response, userId: null };
  }
}

/** Copies cookies from a refresh response onto a redirect/rewrite response. */
export function carryCookies(from: NextResponse, to: NextResponse): NextResponse {
  for (const cookie of from.cookies.getAll()) {
    to.cookies.set(cookie);
  }
  return to;
}
