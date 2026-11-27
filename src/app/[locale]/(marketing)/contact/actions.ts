"use server";

import { headers } from "next/headers";
import { createAdminClient, hasServiceRole } from "@/lib/supabase/admin";
import { sendContactNotification } from "@/lib/integrations/email";
import { logger } from "@/lib/logger";
import { consumeRateLimit } from "@/lib/security/durable-rate-limit";
import { fieldErrorsFrom, formError, formSuccess, type FormState } from "@/lib/action-utils";
import { createContactSchema } from "@/lib/validation/contact";
import { resolveLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/server";

export async function submitContactMessage(_state: FormState, formData: FormData): Promise<FormState> {
  const localeValue = formData.get("locale");
  const locale = resolveLocale(typeof localeValue === "string" ? localeValue : null);
  const dict = await getDictionary(locale);
  const copy = dict.pages.contact;

  if (String(formData.get("website") ?? "").length > 0) {
    return formSuccess(copy.successTitle);
  }

  const requestHeaders = await headers();
  const ip =
    requestHeaders.get("cf-connecting-ip") ??
    requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown";
  if (!(await consumeRateLimit(`contact:${ip}`, 5, 600))) {
    return formError(dict.errors.rateLimited);
  }

  const schema = createContactSchema({
    name: copy.errName,
    email: copy.errEmail,
    message: copy.errMessage,
    topic: copy.errTopic,
    consent: copy.errConsent,
  });

  const text = (key: string) => {
    const value = formData.get(key);
    return typeof value === "string" ? value : undefined;
  };

  const parsed = schema.safeParse({
    name: text("name"),
    email: text("email"),
    company: text("company"),
    topic: text("topic"),
    message: text("message"),
    consent: formData.get("consent") === "on",
  });

  if (!parsed.success) {
    return formError(copy.errorGeneric, fieldErrorsFrom(parsed.error));
  }

  const input = parsed.data;
  let stored = false;

  if (hasServiceRole()) {
    try {
      const { error } = await createAdminClient().from("contact_messages").insert({
        name: input.name,
        email: input.email,
        company: input.company,
        topic: input.topic,
        message: input.message,
        locale,
      });
      if (error) {
        logger.error("contact.store_failed", { error });
      } else {
        stored = true;
      }
    } catch (error) {
      logger.error("contact.store_failed", { error });
    }
  }

  const email = await sendContactNotification({
    name: input.name,
    email: input.email,
    company: input.company,
    topic: input.topic,
    message: input.message,
    locale,
  });

  if (!stored && !email.sent) {
    return formError(copy.errorGeneric);
  }

  logger.info("contact.received", { topic: input.topic, locale, stored, emailed: email.sent });
  return formSuccess(copy.successTitle);
}
