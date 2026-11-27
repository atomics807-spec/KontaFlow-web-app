import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/supabase/auth";
import { getServerEnv } from "@/lib/env";
import { getRequestMeta } from "@/lib/security/request-meta";
import { consumeRateLimit } from "@/lib/security/durable-rate-limit";
import { logSecurityEvent } from "@/lib/security/events";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Account-level privacy export. Business ledgers are exported separately from
 * Settings so this endpoint never joins another tenant's records.
 */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const meta = await getRequestMeta();
  if (
    !(await consumeRateLimit(
      `privacy-export:${user.id}`,
      getServerEnv().RATE_LIMIT_EXPORT_PER_MINUTE,
      60,
    ))
  ) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const supabase = await createClient();
  const [{ data: profile }, { data: memberships }, { data: consents }, { data: requests }] =
    await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
      supabase
        .from("workspace_members")
        .select("workspace_id, role, status, created_at")
        .eq("user_id", user.id),
      supabase
        .from("privacy_consents")
        .select("consent_type, version, granted, granted_at, revoked_at, source, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true }),
      supabase
        .from("account_deletion_requests")
        .select("id, status, reason, requested_at, reviewed_at, completed_at, retention_hold_until")
        .eq("user_id", user.id)
        .order("requested_at", { ascending: false }),
    ]);

  const workspaceIds = [...new Set((memberships ?? []).map((row) => row.workspace_id))];
  const { data: workspaces } = workspaceIds.length
    ? await supabase
        .from("workspaces")
        .select("id, name, currency, timezone, locale, country_code, created_at")
        .in("id", workspaceIds)
    : { data: [] };

  await logSecurityEvent({
    type: "privacy.account_exported",
    userId: user.id,
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  const payload = {
    exportedAt: new Date().toISOString(),
    format: "kontaflow-account-export/v1",
    account: {
      id: user.id,
      email: user.email ?? null,
      phone: user.phone ?? null,
      createdAt: user.created_at,
      lastSignInAt: user.last_sign_in_at ?? null,
      profile: profile ?? null,
    },
    workspaces: (workspaces ?? []).map((workspace) => {
      const membership = (memberships ?? []).find((row) => row.workspace_id === workspace.id);
      return { ...workspace, membership: membership ?? null };
    }),
    consents: consents ?? [],
    deletionRequests: requests ?? [],
    note:
      "Business transactions, receipts and reports are exported separately from Settings. Some records may be retained for legal, tax, fraud-prevention or dispute purposes.",
  };

  const body = JSON.stringify(payload, null, 2);
  logger.info("privacy.account_exported", { userId: user.id });
  return new NextResponse(body, {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="kontaflow-account-${new Date().toISOString().slice(0, 10)}.json"`,
      "cache-control": "no-store",
      vary: "Cookie",
    },
  });
}
