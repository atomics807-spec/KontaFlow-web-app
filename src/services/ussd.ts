import "server-only";

import { channelAddressCandidates } from "@/lib/channels";
import { auditChannelEvent } from "@/lib/channels/audit";
import { AppError } from "@/lib/errors";
import { rateLimit } from "@/lib/rate-limit";
import { generateOtp, hashOtp, OTP_COOLDOWN_SECONDS, OTP_TTL_MS } from "@/lib/security/otp";
import { createAdminClient } from "@/lib/supabase/admin";
import { USSD_LINK_OTP_PURPOSE } from "@/lib/ussd/commands";
import { normalizePhone } from "@/lib/validation/phone";

async function assertActiveMember(workspaceId: string, userId: string): Promise<void> {
  const admin = createAdminClient();
  const [{ data: member }, { data: restrictions }] = await Promise.all([
    admin
      .from("workspace_members")
      .select("status")
      .eq("workspace_id", workspaceId)
      .eq("user_id", userId)
      .maybeSingle(),
    admin
      .from("account_restrictions")
      .select("id, expires_at")
      .eq("user_id", userId)
      .is("lifted_at", null),
  ]);

  if (member?.status !== "active") {
    throw new AppError("forbidden", "You are not an active member of this workspace.");
  }

  const now = Date.now();
  if ((restrictions ?? []).some((row) => row.expires_at === null || new Date(row.expires_at).getTime() > now)) {
    throw new AppError("forbidden", "This account is restricted. Contact KontaFlow support.");
  }
}

export type UssdLinkRequest = {
  address: string;
  code: string;
  expiresAt: string;
};

/**
 * Starts a USSD link challenge. The number becomes usable only after the user
 * dials the service code and enters the code from their own handset.
 */
export async function linkUssdChannel(params: {
  workspaceId: string;
  userId: string;
  address: string;
  countryCode: string;
}): Promise<UssdLinkRequest> {
  const address = normalizePhone(params.address, params.countryCode);
  if (!address) {
    throw new AppError("validation_failed", "Enter a valid phone number for the selected country.");
  }
  if (!rateLimit(`ussd-link:${params.userId}`, 5)) {
    throw new AppError("rate_limited", "Too many link attempts. Wait a minute and try again.");
  }

  await assertActiveMember(params.workspaceId, params.userId);

  const admin = createAdminClient();
  const { data: existing, error: existingError } = await admin
    .from("channel_identities")
    .select("id, user_id, workspace_id, verified_at, verification_sent_at")
    .eq("channel", "ussd")
    .in("address", channelAddressCandidates(address))
    .limit(1)
    .maybeSingle();
  if (existingError) throw new AppError("internal_error", "Could not check that number.");

  if (existing?.verified_at) {
    throw new AppError("conflict", "That number is already linked to a workspace.");
  }
  if (existing && (existing.user_id !== params.userId || existing.workspace_id !== params.workspaceId)) {
    throw new AppError("conflict", "That number is already linked to a workspace.");
  }
  if (existing?.verification_sent_at) {
    const elapsed = Date.now() - new Date(existing.verification_sent_at).getTime();
    if (elapsed < OTP_COOLDOWN_SECONDS * 1000) {
      throw new AppError("rate_limited", "Wait a minute before requesting another code.");
    }
  }

  const code = generateOtp();
  const expiresAt = new Date(Date.now() + OTP_TTL_MS).toISOString();
  const patch = {
    workspace_id: params.workspaceId,
    user_id: params.userId,
    channel: "ussd" as const,
    address,
    verified_at: null,
    verification_code_hash: hashOtp(code, params.userId, USSD_LINK_OTP_PURPOSE),
    verification_expires_at: expiresAt,
    verification_attempts: 0,
    verification_sent_at: new Date().toISOString(),
    verification_method: "ussd_link" as const,
    consent_at: null,
    consent_version: null,
  };

  let identityId: string;
  if (existing) {
    const { data, error } = await admin
      .from("channel_identities")
      .update(patch)
      .eq("id", existing.id)
      .select("id")
      .single();
    if (error || !data) throw new AppError("internal_error", "Could not link that number.");
    identityId = data.id;
  } else {
    const { data, error } = await admin
      .from("channel_identities")
      .insert(patch)
      .select("id")
      .single();
    if (error || !data) {
      if (error?.code === "23505") {
        throw new AppError("conflict", "That number is already linked to a workspace.");
      }
      throw new AppError("internal_error", "Could not link that number.");
    }
    identityId = data.id;
  }

  await auditChannelEvent({
    workspaceId: params.workspaceId,
    actorId: params.userId,
    action: "ussd.link_requested",
    entityId: identityId,
    details: { channel: "ussd", expires_at: expiresAt },
  });

  return { address, code, expiresAt };
}
