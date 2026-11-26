import "server-only";

import { channelAddressCandidates } from "@/lib/channels";
import { auditChannelEvent } from "@/lib/channels/audit";
import { DEFAULT_LOCALE, resolveLocale, type Locale } from "@/lib/i18n/config";
import { hashOtp, OTP_MAX_ATTEMPTS } from "@/lib/security/otp";
import { safeEqual } from "@/lib/security/safe-equal";
import { createAdminClient } from "@/lib/supabase/admin";
import { USSD_CONSENT_VERSION, USSD_LINK_OTP_PURPOSE } from "@/lib/ussd/commands";
import type { ChannelIdentityRow } from "@/types/database";

export type UssdVerificationResult =
  | { status: "missing" | "expired" | "locked" | "unavailable" }
  | { status: "already" }
  | { status: "invalid"; remaining: number }
  | { status: "verified"; identity: ChannelIdentityRow };

export async function findUssdIdentity(address: string): Promise<ChannelIdentityRow | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("channel_identities")
    .select("*")
    .eq("channel", "ussd")
    .in("address", channelAddressCandidates(address))
    .limit(1)
    .maybeSingle();
  return (data as ChannelIdentityRow | null) ?? null;
}

export async function resolveUssdLocale(identity: ChannelIdentityRow): Promise<Locale> {
  const admin = createAdminClient();
  const [{ data: workspace }, { data: profile }] = await Promise.all([
    admin.from("workspaces").select("locale").eq("id", identity.workspace_id).maybeSingle(),
    admin.from("profiles").select("locale").eq("id", identity.user_id).maybeSingle(),
  ]);
  return resolveLocale(profile?.locale ?? workspace?.locale ?? DEFAULT_LOCALE);
}

export async function setUssdLocale(identity: ChannelIdentityRow, locale: Locale): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("profiles").update({ locale }).eq("id", identity.user_id);
  if (error) throw new Error("Could not save the language preference");
}

export async function verifyPendingUssdIdentity(
  address: string,
  code: string,
  at = new Date(),
): Promise<UssdVerificationResult> {
  const identity = await findUssdIdentity(address);
  if (!identity) return { status: "missing" };
  if (identity.verified_at) return { status: "already" };
  if (!identity.verification_code_hash || !identity.verification_expires_at) {
    return { status: "missing" };
  }
  if (identity.verification_attempts >= OTP_MAX_ATTEMPTS) return { status: "locked" };
  if (new Date(identity.verification_expires_at).getTime() <= at.getTime()) {
    return { status: "expired" };
  }

  let expected: string;
  try {
    expected = hashOtp(code, identity.user_id, USSD_LINK_OTP_PURPOSE);
  } catch {
    return { status: "unavailable" };
  }

  const admin = createAdminClient();
  if (!safeEqual(expected, identity.verification_code_hash)) {
    const attempts = identity.verification_attempts + 1;
    await admin
      .from("channel_identities")
      .update({
        verification_attempts: attempts,
        verification_expires_at:
          attempts >= OTP_MAX_ATTEMPTS ? new Date().toISOString() : identity.verification_expires_at,
      })
      .eq("id", identity.id)
      .is("verified_at", null);
    return { status: "invalid", remaining: Math.max(0, OTP_MAX_ATTEMPTS - attempts) };
  }

  const now = at.toISOString();
  const { data, error } = await admin
    .from("channel_identities")
    .update({
      verified_at: now,
      verification_code_hash: null,
      verification_expires_at: null,
      verification_attempts: 0,
      verification_method: "ussd_link",
      consent_at: now,
      consent_version: USSD_CONSENT_VERSION,
    })
    .eq("id", identity.id)
    .eq("verification_code_hash", identity.verification_code_hash)
    .is("verified_at", null)
    .select("*")
    .maybeSingle();

  if (error || !data) {
    const current = await findUssdIdentity(address);
    return current?.verified_at ? { status: "already" } : { status: "missing" };
  }

  await auditChannelEvent({
    workspaceId: data.workspace_id,
    actorId: data.user_id,
    action: "ussd.verified",
    entityId: data.id,
    details: { channel: "ussd", method: "ussd_link" },
  });

  return { status: "verified", identity: data as ChannelIdentityRow };
}
