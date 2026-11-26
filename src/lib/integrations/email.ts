import "server-only";

import { Resend } from "resend";
import { getServerEnv } from "../env";
import { logger } from "../logger";
import type { Locale } from "../i18n/config";

export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

export type SendResult = { sent: boolean; id?: string; reason?: string };

/**
 * Transactional email adapter. Resend is the only implementation for now; the
 * interface is intentionally small so another provider can be swapped in
 * without touching call sites.
 */
export async function sendEmail(message: EmailMessage): Promise<SendResult> {
  const env = getServerEnv();
  if (!env.RESEND_API_KEY) {
    logger.info("email.skipped_not_configured", { to: message.to, subject: message.subject });
    return { sent: false, reason: "not_configured" };
  }

  try {
    const resend = new Resend(env.RESEND_API_KEY);
    const { data, error } = await resend.emails.send({
      from: env.EMAIL_FROM,
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
      ...(env.EMAIL_REPLY_TO ? { replyTo: env.EMAIL_REPLY_TO } : {}),
    });
    if (error) throw new Error(error.message);
    return { sent: true, id: data?.id };
  } catch (error) {
    logger.error("email.send_failed", { error, to: message.to });
    return { sent: false, reason: "provider_error" };
  }
}

const INVITE_COPY: Record<Locale, { subject: (workspace: string) => string; intro: string; cta: string; note: string }> = {
  en: {
    subject: (workspace) => `You are invited to ${workspace} on KontaFlow`,
    intro: "You have been invited to keep the books for",
    cta: "Accept invitation",
    note: "This invitation expires in 7 days.",
  },
  fr: {
    subject: (workspace) => `Vous êtes invité à rejoindre ${workspace} sur KontaFlow`,
    intro: "Vous avez été invité à tenir les comptes de",
    cta: "Accepter l'invitation",
    note: "Cette invitation expire dans 7 jours.",
  },
  wes: {
    subject: (workspace) => `Dem invite you join ${workspace} for KontaFlow`,
    intro: "Dem invite you come keep book for",
    cta: "Accept the invite",
    note: "This invite go expire for 7 days.",
  },
};

export async function sendInvitationEmail(params: {
  to: string;
  workspaceName: string;
  inviterName: string;
  inviteUrl: string;
  locale: Locale;
}): Promise<SendResult> {
  const copy = INVITE_COPY[params.locale] ?? INVITE_COPY.en;
  const subject = copy.subject(params.workspaceName);
  const html = `
    <div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;max-width:520px;margin:0 auto;padding:32px;color:#0b1f1a">
      <p style="font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:#0b7a5a;margin:0 0 24px">KontaFlow</p>
      <h1 style="font-size:22px;margin:0 0 16px">${escapeHtml(copy.intro)} ${escapeHtml(params.workspaceName)}</h1>
      <p style="font-size:15px;line-height:1.6;color:#4b5f58;margin:0 0 24px">
        ${escapeHtml(params.inviterName)} · KontaFlow
      </p>
      <a href="${escapeHtml(params.inviteUrl)}"
         style="display:inline-block;background:#0b7a5a;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:600">
        ${escapeHtml(copy.cta)}
      </a>
      <p style="font-size:12px;color:#7a8a83;margin:24px 0 0">${escapeHtml(copy.note)}</p>
    </div>`;
  const text = `${copy.intro} ${params.workspaceName}\n\n${params.inviterName}\n\n${copy.cta}: ${params.inviteUrl}\n\n${copy.note}`;

  return sendEmail({ to: params.to, subject, html, text });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
