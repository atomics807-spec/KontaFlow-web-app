import "server-only";

import { can, type WorkspaceRole } from "@/lib/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashOtp, OTP_MAX_ATTEMPTS } from "@/lib/security/otp";
import { channelAddressCandidates } from "@/lib/channels";
import { resolveLocale, type Locale } from "@/lib/i18n/config";
import { safeEqual } from "@/lib/whatsapp/signature";
import { WHATSAPP_CONSENT_VERSION, WHATSAPP_LINK_OTP_PURPOSE } from "@/lib/whatsapp/commands";
import type {
  ChannelIdentityRow,
  SubscriptionRow,
  SubscriptionStatus,
  WorkspaceRow,
} from "@/types/database";

const WINDOW_MS = 24 * 60 * 60 * 1000;

export type WhatsappAccess = {
  identity: ChannelIdentityRow;
  workspace: WorkspaceRow;
  userId: string;
  role: WorkspaceRole | null;
  locale: Locale;
  subscription: SubscriptionRow | null;
  subscriptionStatus: SubscriptionStatus | "none";
  subscriptionReadable: boolean;
  subscriptionWritable: boolean;
  restricted: boolean;
  activeMember: boolean;
  readAllowed: boolean;
  writeAllowed: boolean;
  reportAllowed: boolean;
  aiAllowed: boolean;
  windowExpiresAt: string;
};

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

function windowFrom(identity: ChannelIdentityRow, fallback?: Date): string {
  if (identity.service_window_expires_at) return identity.service_window_expires_at;
  if (identity.last_inbound_at) {
    return new Date(new Date(identity.last_inbound_at).getTime() + WINDOW_MS).toISOString();
  }
  return (fallback ?? new Date(0)).toISOString();
}

function trialExpired(subscription: SubscriptionRow): boolean {
  return subscription.status === "trialing" && Boolean(
    subscription.trial_ends_at && new Date(subscription.trial_ends_at).getTime() <= Date.now(),
  );
}

export async function buildWhatsappAccess(
  identity: ChannelIdentityRow,
  fallbackWindow?: Date,
): Promise<WhatsappAccess> {
  const admin = createAdminClient();
  const [{ data: workspace }, { data: membership }, { data: profile }, { data: subscription }, { data: restrictions }, { data: platformAdmin }] =
    await Promise.all([
      admin.from("workspaces").select("*").eq("id", identity.workspace_id).maybeSingle(),
      admin
        .from("workspace_members")
        .select("role, status")
        .eq("workspace_id", identity.workspace_id)
        .eq("user_id", identity.user_id)
        .maybeSingle(),
      admin.from("profiles").select("locale").eq("id", identity.user_id).maybeSingle(),
      admin.from("subscriptions").select("*").eq("workspace_id", identity.workspace_id).maybeSingle(),
      admin
        .from("account_restrictions")
        .select("id, expires_at")
        .eq("user_id", identity.user_id)
        .is("lifted_at", null),
      admin
        .from("platform_admins")
        .select("user_id")
        .eq("user_id", identity.user_id)
        .eq("is_active", true)
        .maybeSingle(),
    ]);

  if (!workspace) {
    throw new Error("WhatsApp identity points at a missing workspace");
  }

  const now = Date.now();
  const restricted =
    Boolean(platformAdmin) ||
    (restrictions ?? []).some(
      (row) => row.expires_at === null || new Date(row.expires_at).getTime() > now,
    );
  const role =
    membership?.status === "active" ? (membership.role as WorkspaceRole) : null;
  const activeMember = role !== null && !restricted;
  const subscriptionRow = (subscription as SubscriptionRow | null) ?? null;
  const status: SubscriptionStatus | "none" = subscriptionRow?.status ?? "none";
  const expiredTrial = subscriptionRow ? trialExpired(subscriptionRow) : false;
  const subscriptionReadable =
    !subscriptionRow ||
    ((status === "trialing" || status === "active" || status === "past_due") && !expiredTrial);
  const subscriptionWritable =
    !subscriptionRow || ((status === "trialing" || status === "active") && !expiredTrial);

  return {
    identity,
    workspace: workspace as WorkspaceRow,
    userId: identity.user_id,
    role,
    locale: resolveLocale(profile?.locale ?? workspace.locale),
    subscription: subscriptionRow,
    subscriptionStatus: status,
    subscriptionReadable,
    subscriptionWritable,
    restricted,
    activeMember,
    readAllowed: activeMember && can(role, "transactions:read") && subscriptionReadable,
    writeAllowed: activeMember && can(role, "transactions:create") && subscriptionWritable,
    reportAllowed: activeMember && can(role, "reports:read") && subscriptionReadable,
    aiAllowed: activeMember && can(role, "ai:use") && subscriptionWritable,
    windowExpiresAt: windowFrom(identity, fallbackWindow),
  };
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
