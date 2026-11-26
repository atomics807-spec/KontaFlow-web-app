import "server-only";

import { AppError } from "@/lib/errors";
import { getServerEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import { rateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateOtp, hashOtp, OTP_COOLDOWN_SECONDS, OTP_TTL_MS } from "@/lib/security/otp";
import { normalizePhone } from "@/lib/validation/phone";
import { channelAddressCandidates } from "@/lib/channels";
import { isWhatsappConfigured, sendWhatsappTemplate } from "@/lib/integrations/whatsapp";
import { auditWhatsappEvent } from "@/lib/whatsapp/messages";
import { WHATSAPP_LINK_OTP_PURPOSE } from "@/lib/whatsapp/commands";
import type { ChannelIdentityRow } from "@/types/database";

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

export type WhatsappLinkRequest = {
  address: string;
  code: string;
  expiresAt: string;
  templateSent: boolean;
};

/**
 * Starts a WhatsApp link challenge. The user must send the code from the
 * WhatsApp number itself; possession of the code in the browser is not proof
 * of control. A template is optional and only speeds up delivery.
 */
export async function requestWhatsappLink(params: {
  workspaceId: string;
  userId: string;
  address: string;
  countryCode: string;
  locale: string;
}): Promise<WhatsappLinkRequest> {
  const address = normalizePhone(params.address, params.countryCode);
  if (!address) {
    throw new AppError("validation_failed", "Enter a valid phone number for the selected country.");
  }
  if (!rateLimit(`whatsapp-link:${params.userId}`, 5)) {
    throw new AppError("rate_limited", "Too many link attempts. Wait a minute and try again.");
  }

  await assertActiveMember(params.workspaceId, params.userId);

  const admin = createAdminClient();
  const { data: existingData, error: existingError } = await admin
    .from("channel_identities")
    .select("*")
    .eq("channel", "whatsapp")
    .in("address", channelAddressCandidates(address))
    .limit(1)
    .maybeSingle();
  if (existingError) throw new AppError("internal_error", "Could not check that number.");

  const existing = existingData as ChannelIdentityRow | null;
  const now = Date.now();
  const pendingActive =
    existing?.verification_expires_at &&
    new Date(existing.verification_expires_at).getTime() > now;

  if (existing?.verified_at) {
    throw new AppError("conflict", "That WhatsApp number is already linked.");
  }
  if (
    existing &&
    pendingActive &&
    (existing.user_id !== params.userId || existing.workspace_id !== params.workspaceId)
  ) {
    throw new AppError(
      "conflict",
      "That number is already waiting for verification. Try again after the code expires.",
    );
  }

  if (
    existing?.verification_sent_at &&
    now - new Date(existing.verification_sent_at).getTime() < OTP_COOLDOWN_SECONDS * 1000
  ) {
    throw new AppError("rate_limited", "A code was just sent. Wait a minute before requesting another.");
  }

  const code = generateOtp();
  const codeHash = hashOtp(code, params.userId, WHATSAPP_LINK_OTP_PURPOSE);
  const expiresAt = new Date(now + OTP_TTL_MS).toISOString();
  const patch = {
    workspace_id: params.workspaceId,
    user_id: params.userId,
    channel: "whatsapp" as const,
    address,
    verified_at: null,
    verification_code_hash: codeHash,
    verification_expires_at: expiresAt,
    verification_attempts: 0,
    verification_sent_at: new Date(now).toISOString(),
    verification_method: "whatsapp_reply" as const,
    consent_at: null,
    consent_version: null,
    opted_out_at: null,
    metadata: { requested_locale: params.locale },
  };

  let identityId: string;
  if (existing) {
    const { data, error } = await admin
      .from("channel_identities")
      .update(patch)
      .eq("id", existing.id)
      .is("verified_at", null)
      .select("id")
      .single();
    if (error || !data) {
      throw new AppError(
        error?.code === "PGRST116" ? "conflict" : "internal_error",
        error?.code === "PGRST116"
          ? "That WhatsApp number is already linked."
          : "Could not start WhatsApp verification.",
      );
    }
    identityId = data.id;
  } else {
    const { data, error } = await admin
      .from("channel_identities")
      .insert(patch)
      .select("id")
      .single();
    if (error) {
      if (error.code === "23505") {
        throw new AppError("conflict", "That WhatsApp number is already linked.");
      }
      throw new AppError("internal_error", "Could not start WhatsApp verification.");
    }
    identityId = data.id;
  }

  const env = getServerEnv();
  let templateSent = false;
  if (env.WHATSAPP_VERIFICATION_TEMPLATE_NAME && isWhatsappConfigured()) {
    const result = await sendWhatsappTemplate(address, {
      name: env.WHATSAPP_VERIFICATION_TEMPLATE_NAME,
      language: env.WHATSAPP_VERIFICATION_TEMPLATE_LANG,
      components: [{ type: "body", parameters: [{ type: "text", text: code }] }],
    });
    templateSent = result.sent;
    if (!result.sent) {
      logger.warn("whatsapp.verification_template_failed", { reason: result.reason, status: result.status });
    }
  }

  await auditWhatsappEvent({
    workspaceId: params.workspaceId,
    actorId: params.userId,
    action: "whatsapp.link_requested",
    entityId: identityId,
    details: { template_sent: templateSent, expires_at: expiresAt },
  });

  return { address, code, expiresAt, templateSent };
}
