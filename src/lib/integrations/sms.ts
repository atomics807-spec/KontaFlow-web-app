import "server-only";

import { getServerEnv } from "@/lib/env";
import { logger } from "@/lib/logger";

export type SmsResult = { sent: boolean; reason?: "not_configured" | "provider_error" | "invalid_number" };

type SmsInput = { to: string; message: string };

/**
 * SMS adapter. Africa's Talking is the production transport (the same account
 * already powers USSD). The console transport exists for local development and
 * is refused outside development/test.
 */
export async function sendSms(input: SmsInput): Promise<SmsResult> {
  const env = getServerEnv();

  if (env.SMS_PROVIDER === "none") {
    logger.info("sms.skipped_not_configured", { to: input.to });
    return { sent: false, reason: "not_configured" };
  }

  if (env.SMS_PROVIDER === "console") {
    if (env.APP_ENV === "production") {
      logger.error("sms.console_provider_in_production", { to: input.to });
      return { sent: false, reason: "not_configured" };
    }
    // Development only. Never enabled in production by the guard above.
    console.info(`[sms:console] to=${input.to} message=${input.message}`);
    return { sent: true };
  }

  if (!env.AFRICASTALKING_API_KEY) {
    logger.info("sms.skipped_missing_key", { to: input.to });
    return { sent: false, reason: "not_configured" };
  }

  const host =
    env.AFRICASTALKING_USERNAME === "sandbox"
      ? "https://api.sandbox.africastalking.com"
      : "https://api.africastalking.com";

  const body = new URLSearchParams({
    username: env.AFRICASTALKING_USERNAME,
    to: input.to,
    message: input.message,
  });
  if (env.AFRICASTALKING_SENDER_ID) {
    body.set("from", env.AFRICASTALKING_SENDER_ID);
  }

  try {
    const response = await fetch(`${host}/version1/messaging`, {
      method: "POST",
      headers: {
        apiKey: env.AFRICASTALKING_API_KEY,
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body,
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      logger.error("sms.provider_rejected", { to: input.to, status: response.status });
      return { sent: false, reason: "provider_error" };
    }

    const payload = (await response.json().catch(() => null)) as
      | { SMSMessageData?: { Recipients?: { status?: string }[] } }
      | null;
    const recipient = payload?.SMSMessageData?.Recipients?.[0];
    if (recipient?.status && !/success/i.test(recipient.status)) {
      logger.error("sms.provider_rejected", { to: input.to, status: recipient.status });
      return { sent: false, reason: "provider_error" };
    }

    return { sent: true };
  } catch (error) {
    logger.error("sms.send_failed", { to: input.to, error });
    return { sent: false, reason: "provider_error" };
  }
}
