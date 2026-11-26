import "server-only";

import { Resend } from "resend";
import { getServerEnv } from "../env";
import { logger } from "../logger";
import type { Locale } from "../i18n/config";
import { getDictionary } from "../i18n/server";
import { interpolate } from "../i18n/interpolate";

export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
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
      ...(message.replyTo ?? env.EMAIL_REPLY_TO
        ? { replyTo: message.replyTo ?? env.EMAIL_REPLY_TO }
        : {}),
    });
    if (error) throw new Error(error.message);
    return { sent: true, id: data?.id };
  } catch (error) {
    logger.error("email.send_failed", { error, to: message.to });
    return { sent: false, reason: "provider_error" };
  }
}

export async function sendInvitationEmail(params: {
  to: string;
  workspaceName: string;
  inviterName: string;
  inviteUrl: string;
  locale: Locale;
}): Promise<SendResult> {
  const dict = await getDictionary(params.locale);
  const copy = dict.emails;
  const intro = interpolate(copy.inviteIntro, { workspace: params.workspaceName });
  const subject = interpolate(copy.inviteSubject, { workspace: params.workspaceName });
  const html = `
    <div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;max-width:520px;margin:0 auto;padding:32px;color:#0b1f1a">
      <p style="font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:#0b7a5a;margin:0 0 24px">KontaFlow</p>
      <h1 style="font-size:22px;margin:0 0 16px">${escapeHtml(intro)}</h1>
      <p style="font-size:15px;line-height:1.6;color:#4b5f58;margin:0 0 24px">
        ${escapeHtml(params.inviterName)} · KontaFlow
      </p>
      <a href="${escapeHtml(params.inviteUrl)}"
         style="display:inline-block;background:#0b7a5a;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:600">
        ${escapeHtml(copy.inviteCta)}
      </a>
      <p style="font-size:12px;color:#7a8a83;margin:24px 0 0">${escapeHtml(copy.inviteNote)}</p>
    </div>`;
  const text = interpolate(copy.inviteText, {
    intro,
    inviter: params.inviterName,
    cta: copy.inviteCta,
    url: params.inviteUrl,
    note: copy.inviteNote,
  });

  return sendEmail({ to: params.to, subject, html, text });
}

export async function sendContactNotification(params: {
  name: string;
  email: string;
  company: string | null;
  topic: string;
  message: string;
  locale: string;
}): Promise<SendResult> {
  const env = getServerEnv();
  const subject = `[KontaFlow contact] ${params.topic} — ${params.name.replace(/[\r\n]+/g, " ")}`;
  const lines = [
    `Name: ${params.name}`,
    `Email: ${params.email}`,
    `Company: ${params.company ?? "—"}`,
    `Topic: ${params.topic}`,
    `Locale: ${params.locale}`,
    "",
    params.message,
  ];
  const html = `
    <div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;max-width:620px;margin:0 auto;padding:32px;color:#0b1f1a">
      <p style="font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:#0b7a5a;margin:0 0 24px">KontaFlow contact</p>
      <h1 style="font-size:20px;margin:0 0 16px">${escapeHtml(params.topic)} from ${escapeHtml(params.name)}</h1>
      <table style="font-size:14px;line-height:1.6;color:#4b5f58;border-collapse:collapse">
        <tr><td style="padding:2px 12px 2px 0;font-weight:600">Email</td><td>${escapeHtml(params.email)}</td></tr>
        <tr><td style="padding:2px 12px 2px 0;font-weight:600">Company</td><td>${escapeHtml(params.company ?? "—")}</td></tr>
        <tr><td style="padding:2px 12px 2px 0;font-weight:600">Locale</td><td>${escapeHtml(params.locale)}</td></tr>
      </table>
      <div style="margin-top:20px;padding:16px;border-radius:12px;background:#f4f8f6;font-size:14px;line-height:1.7;white-space:pre-wrap">${escapeHtml(params.message)}</div>
    </div>`;

  return sendEmail({
    to: env.CONTACT_INBOX_EMAIL,
    replyTo: params.email,
    subject,
    html,
    text: lines.join("\n"),
  });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
