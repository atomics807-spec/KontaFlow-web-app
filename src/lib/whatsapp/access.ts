import "server-only";

import { hashOtp, OTP_MAX_ATTEMPTS } from "@/lib/security/otp";
import { createAdminClient } from "@/lib/supabase/admin";
import { channelAddressCandidates } from "@/lib/channels";
import { safeEqual } from "@/lib/whatsapp/signature";
import { WHATSAPP_CONSENT_VERSION, WHATSAPP_LINK_OTP_PURPOSE } from "@/lib/whatsapp/commands";
import { buildChannelAccess, type ChannelAccess } from "@/lib/channels/access";
import type { ChannelIdentityRow } from "@/types/database";

const WINDOW_MS = 24 * 60 * 60 * 1000;

export type WhatsappAccess = ChannelAccess;

export type PendingVerificationResult =
  | { status: "missing" | "expired" | "locked" | "unavailable" }
  | { status: "already" }
  | { status: "invalid"; remaining: number }
  | { status: "verified"; identity: ChannelIdentityRow };

export async function findWhatsappIdentity(address: string): Promise<ChannelIdentityRow | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("channel_identities")
    .select("*")
    .eq("channel", "whatsapp")
    .in("address", channelAddressCandidates(address))
    .limit(1)
    .maybeSingle();
  return (data as ChannelIdentityRow | null) ?? null;
}

export async function buildWhatsappAccess(
  identity: ChannelIdentityRow,
  fallbackWindow?: Date,
): Promise<WhatsappAccess> {
  return buildChannelAccess(identity, fallbackWindow);
}

export async function touchWhatsappInbound(params: {
  identityId: string;
  at: Date;
  displayName?: string | null;
}): Promise<{ windowExpiresAt: string }> {
  const admin = createAdminClient();
  const windowExpiresAt = new Date(params.at.getTime() + WINDOW_MS).toISOString();
  const displayName = params.displayName?.trim().slice(0, 120);

  const { data: current, error: readError } = await admin
    .from("channel_identities")
    .select("last_inbound_at, service_window_expires_at")
    .eq("id", params.identityId)
    .maybeSingle();
  if (readError) throw new Error("Could not read the WhatsApp window");

  // Meta can deliver out of order; an older message must not shorten a newer window.
  if (current?.last_inbound_at && new Date(current.last_inbound_at).getTime() > params.at.getTime()) {
    return {
      windowExpiresAt:
        current.service_window_expires_at ??
        new Date(new Date(current.last_inbound_at).getTime() + WINDOW_MS).toISOString(),
    };
  }

  const { error } = await admin
    .from("channel_identities")
    .update({
      last_inbound_at: params.at.toISOString(),
      service_window_expires_at: windowExpiresAt,
      ...(displayName ? { display_name: displayName } : {}),
    })
    .eq("id", params.identityId);
  if (error) throw new Error("Could not update the WhatsApp window");

  return { windowExpiresAt };
}

export async function verifyPendingWhatsappIdentity(
  address: string,
  code: string,
  at: Date,
  displayName?: string | null,
): Promise<PendingVerificationResult> {
  const identity = await findWhatsappIdentity(address);
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
    expected = hashOtp(code, identity.user_id, WHATSAPP_LINK_OTP_PURPOSE);
  } catch {
    return { status: "unavailable" };
  }

  if (!safeEqual(expected, identity.verification_code_hash)) {
    const attempts = identity.verification_attempts + 1;
    const admin = createAdminClient();
    await admin
      .from("channel_identities")
      .update({
        verification_attempts: attempts,
        verification_expires_at:
          attempts >= OTP_MAX_ATTEMPTS ? new Date().toISOString() : identity.verification_expires_at,
      })
      .eq("id", identity.id);
    return { status: "invalid", remaining: Math.max(0, OTP_MAX_ATTEMPTS - attempts) };
  }

  const admin = createAdminClient();
  const now = at.toISOString();
  const { data, error } = await admin
    .from("channel_identities")
    .update({
      verified_at: now,
      verification_code_hash: null,
      verification_expires_at: null,
      verification_attempts: 0,
      verification_method: "whatsapp_reply",
      consent_at: now,
      consent_version: WHATSAPP_CONSENT_VERSION,
      opted_out_at: null,
      last_inbound_at: now,
      service_window_expires_at: new Date(at.getTime() + WINDOW_MS).toISOString(),
      display_name: displayName?.trim()?.slice(0, 120) || identity.display_name,
    })
    .eq("id", identity.id)
    .eq("verification_code_hash", identity.verification_code_hash)
    .is("verified_at", null)
    .select("*")
    .maybeSingle();

  if (error || !data) return { status: "missing" };
  return { status: "verified", identity: data as ChannelIdentityRow };
}

export async function markWhatsappOptOut(identityId: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("channel_identities")
    .update({ opted_out_at: new Date().toISOString() })
    .eq("id", identityId);
  if (error) throw new Error("Could not record the WhatsApp opt-out");
}

export async function markWhatsappOptIn(identityId: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("channel_identities")
    .update({ opted_out_at: null, consent_at: new Date().toISOString(), consent_version: WHATSAPP_CONSENT_VERSION })
    .eq("id", identityId);
  if (error) throw new Error("Could not record the WhatsApp opt-in");
}
