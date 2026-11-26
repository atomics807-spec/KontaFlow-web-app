"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getProfile, getSessionUser } from "@/lib/supabase/auth";
import { getDictionary } from "@/lib/i18n/server";
import { resolveLocale } from "@/lib/i18n/config";
import { getRequestMeta } from "@/lib/security/request-meta";
import { generateOtp, hashOtp } from "@/lib/security/otp";
import { sendSms } from "@/lib/integrations/sms";
import { rateLimit } from "@/lib/rate-limit";
import { interpolate as fill } from "@/lib/i18n/interpolate";
import { safeNextPath, formError, formSuccess, type FormState } from "@/lib/action-utils";
import { logger } from "@/lib/logger";

type ChallengeStatus = {
  status: string;
  attempts_remaining?: number;
  retry_after_seconds?: number;
};

export async function sendPhoneCodeAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const locale = resolveLocale(String(formData.get("locale") ?? "en"));
  const dict = await getDictionary(locale);
  const meta = await getRequestMeta();
  const user = await getSessionUser();
  if (!user) return formError(dict.errors.sessionExpired);

  if (!rateLimit(`phone-send:${meta.ip ?? "unknown"}:${user.id}`, 5, 10 * 60_000)) {
    return formError(dict.identity.tooManyAttempts);
  }

  const profile = await getProfile();
  if (!profile?.phone) return formError(dict.identity.phoneRequired);
  if (profile.phone_verified_at) return formSuccess(dict.identity.phoneVerified);

  const code = generateOtp();
  const codeHash = hashOtp(code, user.id, "phone_verification");
  const expiresAt = new Date(Date.now() + 10 * 60_000).toISOString();

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("request_phone_verification", {
    p_code_hash: codeHash,
    p_expires_at: expiresAt,
    p_ip: meta.ip,
  });

  if (error) {
    logger.warn("phone.request_failed", { code: error.code });
    return formError(dict.errors.generic);
  }

  const result = data as ChallengeStatus | null;
  const status = result?.status;
  if (status === "verified") return formSuccess(dict.identity.phoneVerified);
  if (status === "no_phone") return formError(dict.identity.phoneRequired);
  if (status === "cooldown") {
    return formError(fill(dict.identity.resendCooldown, { seconds: result?.retry_after_seconds ?? 60 }));
  }
  if (status === "rate_limited") return formError(dict.identity.tooManyAttempts);
  if (status !== "sent") return formError(dict.errors.generic);

  const delivery = await sendSms({
    to: profile.phone,
    message: fill(dict.identity.smsBody, {
      code,
      minutes: 10,
      brand: "KontaFlow",
    }),
  });

  if (!delivery.sent) {
    logger.warn("phone.sms_not_delivered", { reason: delivery.reason });
    return formError(dict.identity.smsUnavailable);
  }

  logger.info("phone.code_sent", { userId: user.id });
  return formSuccess(dict.identity.codeSent);
}

export async function verifyPhoneCodeAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const locale = resolveLocale(String(formData.get("locale") ?? "en"));
  const dict = await getDictionary(locale);
  const user = await getSessionUser();
  if (!user) return formError(dict.errors.sessionExpired);

  const parsed = z
    .string()
    .trim()
    .regex(/^[0-9]{6}$/, dict.identity.codeInvalid)
    .safeParse(formData.get("code"));
  if (!parsed.success) {
    return formError(dict.identity.codeInvalid, { code: [dict.identity.codeInvalid] });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("verify_phone_verification", {
    p_code_hash: hashOtp(parsed.data, user.id, "phone_verification"),
  });

  if (error) {
    logger.warn("phone.verify_failed", { code: error.code });
    return formError(dict.errors.generic);
  }

  const result = data as ChallengeStatus | null;
  switch (result?.status) {
    case "verified": {
      const next = safeNextPath(formData.get("next"), `/${locale}/onboarding`);
      revalidatePath("/", "layout");
      redirect(next);
    }
    case "invalid":
      return formError(
        fill(dict.identity.codeWrong, { attempts: result.attempts_remaining ?? 0 }),
        { code: [dict.identity.codeInvalid] },
      );
    case "expired":
      return formError(dict.identity.codeExpired);
    case "locked":
      return formError(dict.identity.codeLocked);
    case "missing":
      return formError(dict.identity.codeMissing);
    case "unauthenticated":
      return formError(dict.errors.sessionExpired);
    default:
      return formError(dict.errors.generic);
  }
}
