import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { getPublicEnv } from "@/lib/env";
import { isLocale } from "@/lib/i18n/config";
import { safeNextPath } from "@/lib/action-utils";
import { logger } from "@/lib/logger";
import type { Database } from "@/types/database";

/**
 * Email confirmation and password-recovery landing point.
 *
 * Supabase links arrive as either a PKCE `code` or a `token_hash` + `type`
 * pair. Both are exchanged server-side so tokens never reach client JavaScript.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const next = safeNextPath(url.searchParams.get("next"), "/en/onboarding");
  const segment = next.split("/").filter(Boolean)[0];
  const locale = isLocale(segment) ? segment : "en";

  const failure = (reason: string) => {
    logger.warn("auth.callback_failed", { reason });
    return NextResponse.redirect(new URL(`/${locale}/verify-email?error=1`, url));
  };

  if (url.searchParams.get("error")) return failure("provider_error");

  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  if (!code && !tokenHash) return failure("missing_token");

  const pendingCookies: { name: string; value: string; options?: CookieOptions }[] = [];
  const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY } = getPublicEnv();

  const supabase = createServerClient<Database>(NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const cookie of cookiesToSet) {
          pendingCookies.push(cookie);
        }
      },
    },
  });

  try {
    const { error } = code
      ? await supabase.auth.exchangeCodeForSession(code)
      : await supabase.auth.verifyOtp({
          token_hash: tokenHash!,
          type: (type ?? "email") as EmailOtpType,
        });

    if (error) return failure(error.message);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return failure("no_session");

    const destination = new URL(next, url);
    const response = NextResponse.redirect(destination);
    for (const cookie of pendingCookies) {
      response.cookies.set(cookie.name, cookie.value, cookie.options);
    }
    return response;
  } catch (error) {
    logger.error("auth.callback_exception", { error });
    return failure("exception");
  }
}
