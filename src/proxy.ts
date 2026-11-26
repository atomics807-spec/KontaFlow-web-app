import { NextResponse, type NextRequest } from "next/server";
import {
  DEFAULT_LOCALE,
  LOCALES,
  LOCALE_COOKIE,
  isLocale,
  negotiateLocale,
} from "@/lib/i18n/config";
import { carryCookies, refreshSession } from "@/lib/supabase/proxy";

const AUTH_PAGES = ["/login", "/signup", "/forgot-password", "/reset-password"];
const PROTECTED_PAGES = [
  "/dashboard",
  "/transactions",
  "/reports",
  "/contacts",
  "/assistant",
  "/settings",
  "/team",
  "/billing",
  "/onboarding",
];

const STATIC_FILE = /\.(?:png|jpe?g|svg|ico|webp|avif|txt|xml|webmanifest|js|css|woff2?|map)$/i;

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/api/") ||
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/_next/") ||
    pathname === "/sw.js" ||
    STATIC_FILE.test(pathname)
  ) {
    return NextResponse.next();
  }

  const [first] = pathname.split("/").filter(Boolean);

  if (!isLocale(first)) {
    const cookieLocale = request.cookies.get(LOCALE_COOKIE)?.value;
    const locale = isLocale(cookieLocale)
      ? cookieLocale
      : negotiateLocale(request.headers.get("accept-language"));
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;
    return NextResponse.redirect(url);
  }

  const locale = first;
  const rest = pathname.slice(locale.length + 1) || "/";
  const { response, userId } = await refreshSession(request);

  const isAuthPage = AUTH_PAGES.some((page) => rest === page || rest.startsWith(`${page}/`));
  const isProtected = PROTECTED_PAGES.some((page) => rest === page || rest.startsWith(`${page}/`));

  if (!userId && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}/login`;
    url.search = `?next=${encodeURIComponent(rest)}`;
    return carryCookies(response, NextResponse.redirect(url));
  }

  if (userId && isAuthPage) {
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}/dashboard`;
    url.search = "";
    return carryCookies(response, NextResponse.redirect(url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

export const SUPPORTED_LOCALES = LOCALES;
export const FALLBACK_LOCALE = DEFAULT_LOCALE;
