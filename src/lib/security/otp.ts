import "server-only";

import { createHmac, randomInt } from "node:crypto";
import { getServerEnv } from "@/lib/env";
import { AppError } from "@/lib/errors";

export const OTP_TTL_MS = 10 * 60 * 1000;
export const OTP_COOLDOWN_SECONDS = 60;
export const OTP_MAX_ATTEMPTS = 5;

export function generateOtp(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

/**
 * Keyed hash so a leaked `otp_verifications` row cannot be brute-forced offline
 * against the one million possible six-digit codes. The user and purpose are
 * bound into the message to stop a code being replayed for another account.
 */
export function hashOtp(code: string, userId: string, purpose: string): string {
  const env = getServerEnv();
  const secret = env.OTP_HMAC_SECRET ?? env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) {
    throw new AppError(
      "configuration_missing",
      "Phone verification is not configured on this deployment yet.",
    );
  }
  return createHmac("sha256", secret).update(`${purpose}:${userId}:${code}`).digest("hex");
}
