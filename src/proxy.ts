import { NextResponse, type NextRequest } from "next/server";
import {
  DEFAULT_LOCALE,
  LOCALES,
  LOCALE_COOKIE,
  isLocale,
  negotiateLocale,
  resolvePathLocale,
} from "@/lib/i18n/config";
import { carryCookies, refreshSession } from "@/lib/supabase/proxy";

const AUTH_PAGES = ["/login", "/signup", "/forgot-password"];
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
  "/verify-phone",
  "/admin",
];

const STATIC_FILE = /\.(?:png|jpe?g|svg|ico|webp|avif|txt|xml|webmanifest|js|css|woff2?|map)$/i;

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const incomingRequestId = request.headers.get("x-request-id");
  const requestId =
    incomingRequestId && /^[A-Za-z0-9._:-]{8,128}$/.test(incomingRequestId)
      ? incomingRequestId
      : crypto.randomUUID();
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-request-id", requestId);
  const tag = <T extends NextResponse>(response: T): T => {
    response.headers.set("x-request-id", requestId);
    return response;
  };

  if (
    pathname.startsWith("/api/") ||
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/_next/") ||
    pathname === "/sw.js" ||
    STATIC_FILE.test(pathname)
  ) {
    return tag(NextResponse.next({ request: { headers: requestHeaders } }));
  }

  const [first] = pathname.split("/").filter(Boolean);
  const pathLocale = resolvePathLocale(first);

  // Keep old `/wes/...` links and already-sent emails working.
  if (first && pathLocale && !isLocale(first)) {
    const url = request.nextUrl.clone();
    url.pathname = `/${pathLocale}${pathname.slice(first.length)}`;
    const response = tag(NextResponse.redirect(url, 308));
    response.cookies.set(LOCALE_COOKIE, pathLocale, {
      path: "/",
      maxAge: 31536000,
      sameSite: "lax",
      httpOnly: false,
    });
    return response;
  }

  if (!pathLocale) {
    const cookieLocale = request.cookies.get(LOCALE_COOKIE)?.value;
    const locale = isLocale(cookieLocale)
      ? cookieLocale
      : negotiateLocale(request.headers.get("accept-language"));
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;
    return tag(NextResponse.redirect(url));
  }

  const locale = pathLocale;
  const rest = pathname.slice(locale.length + 1) || "/";
  const { response, userId } = await refreshSession(request);

  const isAuthPage = AUTH_PAGES.some((page) => rest === page || rest.startsWith(`${page}/`));
  const isProtected = PROTECTED_PAGES.some((page) => rest === page || rest.startsWith(`${page}/`));

  if (!userId && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}/login`;
    url.search = `?next=${encodeURIComponent(`/${locale}${rest}`)}`;
    return tag(carryCookies(response, NextResponse.redirect(url)));
  }

  if (userId && isAuthPage) {
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}/dashboard`;
    url.search = "";
    return tag(carryCookies(response, NextResponse.redirect(url)));
  }

  return tag(response);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

export const SUPPORTED_LOCALES = LOCALES;
export const FALLBACK_LOCALE = DEFAULT_LOCALE;
