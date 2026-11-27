import "server-only";

import { getPublicEnv, getServerEnv } from "@/lib/env";

export type AuthCookieOptions = {
  path: string;
  httpOnly: true;
  secure: boolean;
  sameSite: "lax";
  maxAge: number;
};

function isHttpsApp(): boolean {
  try {
    return new URL(getPublicEnv().NEXT_PUBLIC_APP_URL).protocol === "https:";
  } catch {
    return process.env.NODE_ENV === "production";
  }
}

/**
 * Supabase's SSR default is a 400-day, JavaScript-readable cookie. KontaFlow
 * has no browser-side Auth client, so the session can be HttpOnly and shorter.
 * `proxy.ts` and the request-scoped server client share these options.
 */
export function authCookieOptions(): AuthCookieOptions {
  let maxAge = 60 * 60 * 24 * 7;
  try {
    maxAge = getServerEnv().SESSION_COOKIE_MAX_AGE_SECONDS;
  } catch {
    // Keep the safe default when env validation is not available yet.
  }
  return { path: "/", httpOnly: true, secure: isHttpsApp(), sameSite: "lax", maxAge };
}

export function secureCookieFlag(): boolean {
  return isHttpsApp();
}

/**
 * Supabase SSR hard-codes a 400-day maxAge when it writes auth cookies. Cap
 * positive lifetimes here, while preserving maxAge 0 so sign-out still clears.
 */
export function limitAuthCookie<T extends { maxAge?: number }>(options: T): T & AuthCookieOptions {
  if (options.maxAge === 0) return options as T & AuthCookieOptions;
  const base = authCookieOptions();
  return {
    ...options,
    ...base,
    expires: new Date(Date.now() + base.maxAge * 1000),
  };
}
