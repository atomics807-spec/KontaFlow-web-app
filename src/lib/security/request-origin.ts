export type OriginCheckInput = {
  origin: string | null;
  secFetchSite: string | null;
  requestUrl: string;
  appUrl?: string | null;
  trustedOrigins?: string | null;
};

export type OriginCheck = { ok: true } | { ok: false; reason: "cross_site" | "untrusted_origin" };

function originOf(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

/**
 * Browser requests carry Origin and/or Sec-Fetch-Site. Non-browser clients may
 * omit both; they still need a valid session cookie, so they are not a CSRF
 * vector. A present cross-site signal always wins.
 */
export function verifySameOrigin(input: OriginCheckInput): OriginCheck {
  const fetchSite = input.secFetchSite?.toLowerCase() ?? null;
  if (fetchSite === "cross-site" || fetchSite === "same-site") {
    return { ok: false, reason: "cross_site" };
  }

  if (!input.origin) return { ok: true };

  // Trust configured origins, not client-supplied forwarding headers. A
  // preview or reverse-proxy host must be listed in TRUSTED_ORIGINS.
  const allowed = new Set<string>();
  const configured = input.appUrl ? [input.appUrl] : [input.requestUrl];
  for (const value of configured) {
    const origin = originOf(value);
    if (origin) allowed.add(origin);
  }

  for (const entry of (input.trustedOrigins ?? "").split(",")) {
    const origin = originOf(entry.trim());
    if (origin) allowed.add(origin);
  }

  const supplied = originOf(input.origin);
  if (!supplied || !allowed.has(supplied)) {
    return { ok: false, reason: "untrusted_origin" };
  }
  return { ok: true };
}
