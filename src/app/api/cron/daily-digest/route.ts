import { getServerEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/integrations/email";
import {
  isCustomerServiceWindowOpen,
  isWhatsappConfigured,
  safeEqual,
  sendWhatsappTemplate,
  sendWhatsappText,
} from "@/lib/integrations/whatsapp";
import { addDays, hourInZone, isLastDayOfMonthInZone, todayInZone, weekdayInZone } from "@/lib/dates";
import { resolveLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/server";
import { logger } from "@/lib/logger";
import { loadScheduledReportData, type ReportWorkspace, type ScheduledReportData } from "@/lib/reports/data";
import { buildScheduledReport, type BuiltReport } from "@/lib/reports/scheduled";
import type { Json, ReportChannel, ReportDeliveryRow, ReportFrequency, ReportKind } from "@/types/database";

type WorkspaceRow = ReportWorkspace & {
  owner_id: string;
  locale: string;
};

type Recipient = {
  userId: string;
  language: Locale;
  frequency: ReportFrequency;
  emailEnabled: boolean;
  inAppEnabled: boolean;
  whatsappEnabled: boolean;
};

type ChannelOutcome = {
  status: "sent" | "failed" | "skipped";
  error?: string;
  providerMessageId?: string;
  metadata?: Json;
};

const REPORT_HOUR = 21;
const STALE_RESERVATION_MS = 2 * 60 * 60 * 1000;
const RETRY_MIN_AGE_MS = 30 * 60 * 1000;
const RETRY_LOOKBACK_DAYS = 2;
const MAX_ATTEMPTS = 4;

const FEATURE_BY_KIND: Record<ReportKind, string> = {
  daily: "daily_reports",
  weekly: "weekly_reports",
  monthly: "monthly_reports",
};

function kindsForFrequency(frequency: ReportFrequency): ReportKind[] {
  if (frequency === "daily") return ["daily", "weekly", "monthly"];
  if (frequency === "weekly") return ["weekly", "monthly"];
  if (frequency === "monthly") return ["monthly"];
  return [];
}

function periodFor(kind: ReportKind, reportDate: string): { from: string; to: string } {
  if (kind === "daily") return { from: addDays(reportDate, -1), to: addDays(reportDate, -1) };
  if (kind === "weekly") return { from: addDays(reportDate, -6), to: reportDate };
  return { from: `${reportDate.slice(0, 7)}-01`, to: reportDate };
}

function isDue(kind: ReportKind, localHour: number, weekday: number, lastDayOfMonth: boolean): boolean {
  if (localHour < REPORT_HOUR) return false;
  if (kind === "daily") return true;
  if (kind === "weekly") return weekday === 0;
  return lastDayOfMonth;
}

function enabledChannels(recipient: Recipient): ReportChannel[] {
  const channels: ReportChannel[] = [];
  if (recipient.inAppEnabled) channels.push("in_app");
  if (recipient.emailEnabled) channels.push("email");
  if (recipient.whatsappEnabled) channels.push("whatsapp");
  return channels;
}

async function loadRecipients(
  admin: ReturnType<typeof createAdminClient>,
  workspace: WorkspaceRow,
): Promise<Recipient[]> {
  const { data: preferences, error } = await admin
    .from("report_preferences")
    .select("user_id, language, frequency, email_enabled, in_app_enabled, whatsapp_enabled")
    .eq("workspace_id", workspace.id);
  if (error) {
    logger.warn("cron.report_preferences_failed", { workspaceId: workspace.id, code: error.code });
  }

  const rows = preferences ?? [];
  const userIds = rows.map((row) => row.user_id);
  const [{ data: members }, { data: restrictions }] = await Promise.all([
    admin
      .from("workspace_members")
      .select("user_id, status")
      .eq("workspace_id", workspace.id)
      .eq("status", "active"),
    userIds.length > 0
      ? admin
          .from("account_restrictions")
          .select("user_id, expires_at")
          .in("user_id", userIds)
          .is("lifted_at", null)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const active = new Set((members ?? []).map((member) => member.user_id));
  const now = Date.now();
  const restricted = new Set(
    (restrictions ?? [])
      .filter((row) => row.expires_at === null || new Date(row.expires_at).getTime() > now)
      .map((row) => row.user_id),
  );

  const recipients: Recipient[] = rows
    .filter((row) => active.has(row.user_id) && !restricted.has(row.user_id))
    .map((row) => ({
      userId: row.user_id,
      language: resolveLocale(row.language),
      frequency: row.frequency,
      emailEnabled: row.email_enabled,
      inAppEnabled: row.in_app_enabled,
      whatsappEnabled: row.whatsapp_enabled,
    }));

  if (recipients.length === 0 && !restricted.has(workspace.owner_id)) {
    recipients.push({
      userId: workspace.owner_id,
      language: resolveLocale(workspace.locale),
      frequency: "daily",
      emailEnabled: true,
      inAppEnabled: true,
      whatsappEnabled: false,
    });
  }

  return recipients;
}

async function reserveDelivery(
  admin: ReturnType<typeof createAdminClient>,
  params: {
    workspaceId: string;
    userId: string;
    kind: ReportKind;
    reportDate: string;
    channel: ReportChannel;
  },
): Promise<{ id: string | null; state: "reserved" | "duplicate" | "exhausted" | "error"; code?: string }> {
  const now = new Date().toISOString();
  const insert = await admin
    .from("report_deliveries")
    .insert({
      workspace_id: params.workspaceId,
      user_id: params.userId,
      kind: params.kind,
      report_date: params.reportDate,
      channel: params.channel,
      status: "sending",
      attempts: 1,
      last_attempt_at: now,
      metadata: {},
    })
    .select("id")
    .maybeSingle();

  if (!insert.error) return { id: insert.data?.id ?? null, state: "reserved" };
  if (insert.error.code !== "23505") return { id: null, state: "error", code: insert.error.code };

  const { data: existing, error: existingError } = await admin
    .from("report_deliveries")
    .select("id, status, attempts")
    .eq("workspace_id", params.workspaceId)
    .eq("user_id", params.userId)
    .eq("kind", params.kind)
    .eq("report_date", params.reportDate)
    .eq("channel", params.channel)
    .maybeSingle();

  if (existingError || !existing) {
    return { id: null, state: "error", code: existingError?.code };
  }
  if (existing.status === "sent" || existing.status === "skipped" || existing.status === "sending") {
    return { id: null, state: "duplicate" };
  }
  if (Number(existing.attempts ?? 1) >= MAX_ATTEMPTS) {
    return { id: null, state: "exhausted" };
  }

  const retried = await admin
    .from("report_deliveries")
    .update({
      status: "sending",
      attempts: Number(existing.attempts ?? 1) + 1,
      last_error: null,
      last_attempt_at: now,
      provider_message_id: null,
    })
    .eq("id", existing.id)
    .eq("status", "failed")
    .select("id")
    .maybeSingle();

  if (retried.error || !retried.data) return { id: null, state: "duplicate" };
  return { id: retried.data.id, state: "reserved" };
}

async function finishDelivery(
  admin: ReturnType<typeof createAdminClient>,
  id: string,
  outcome: ChannelOutcome,
): Promise<void> {
  await admin
    .from("report_deliveries")
    .update({
      status: outcome.status,
      last_error: outcome.error ?? null,
      sent_at: outcome.status === "sent" ? new Date().toISOString() : null,
      provider_message_id: outcome.providerMessageId ?? null,
      metadata: outcome.metadata ?? {},
    })
    .eq("id", id);
}

async function deliverInApp(
  admin: ReturnType<typeof createAdminClient>,
  workspace: WorkspaceRow,
  recipient: Recipient,
  message: BuiltReport,
): Promise<ChannelOutcome> {
  const { error } = await admin.from("notifications").insert({
    workspace_id: workspace.id,
    user_id: recipient.userId,
    channel: "in_app",
    title: message.title,
    body: message.notificationBody,
    data: message.data,
    sent_at: new Date().toISOString(),
  });
  if (!error) return { status: "sent" };
  if (error.code === "23505") return { status: "sent", metadata: { duplicate: true } };
  return { status: "failed", error: `notification_${error.code}` };
}

async function deliverEmail(
  admin: ReturnType<typeof createAdminClient>,
  workspace: WorkspaceRow,
  recipient: Recipient,
  kind: ReportKind,
  reportDate: string,
  message: BuiltReport,
  emailCache: Map<string, string | null>,
): Promise<ChannelOutcome> {
  let email = emailCache.get(recipient.userId);
  if (email === undefined) {
    const { data } = await admin.auth.admin.getUserById(recipient.userId);
    email = data?.user?.email ?? null;
    emailCache.set(recipient.userId, email);
  }
  if (!email) return { status: "skipped", error: "no_email" };

  const result = await sendEmail({
    to: email,
    subject: message.subject,
    html: message.html,
    text: message.text,
    idempotencyKey: `${workspace.id}:${recipient.userId}:${kind}:${reportDate}:email`,
  });
  if (result.sent) return { status: "sent", providerMessageId: result.id };
  if (result.reason === "not_configured") return { status: "skipped", error: "email_not_configured" };
  return { status: "failed", error: "email_delivery_failed" };
}

async function deliverWhatsapp(
  admin: ReturnType<typeof createAdminClient>,
  workspace: WorkspaceRow,
  recipient: Recipient,
  message: BuiltReport,
): Promise<ChannelOutcome> {
  if (!isWhatsappConfigured()) return { status: "skipped", error: "whatsapp_not_configured" };

  const { data: identity, error } = await admin
    .from("channel_identities")
    .select("id, address, verified_at, consent_at, opted_out_at, service_window_expires_at")
    .eq("workspace_id", workspace.id)
    .eq("user_id", recipient.userId)
    .eq("channel", "whatsapp")
    .not("verified_at", "is", null)
    .not("consent_at", "is", null)
    .is("opted_out_at", null)
    .order("verified_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return { status: "failed", error: `whatsapp_lookup_${error.code}` };
  if (!identity) return { status: "skipped", error: "whatsapp_not_linked" };

  const env = getServerEnv();
  const result = isCustomerServiceWindowOpen(identity.service_window_expires_at)
    ? await sendWhatsappText(identity.address, message.whatsappText, {
        customerServiceWindowExpiresAt: identity.service_window_expires_at!,
      })
    : env.WHATSAPP_REPORT_TEMPLATE_NAME
      ? await sendWhatsappTemplate(identity.address, {
          name: env.WHATSAPP_REPORT_TEMPLATE_NAME,
          language: env.WHATSAPP_REPORT_TEMPLATE_LANG,
          components: [
            {
              type: "body",
              parameters: message.whatsappTemplateParams.map((text) => ({ type: "text" as const, text })),
            },
          ],
        })
      : { sent: false, reason: "outside_window" as const };

  if (result.sent) {
    await admin
      .from("channel_identities")
      .update({ last_outbound_at: new Date().toISOString() })
      .eq("id", identity.id);
    return { status: "sent", providerMessageId: result.id };
  }
  if (result.reason === "provider_error" || result.reason === "network_error") {
    return { status: "failed", error: `whatsapp_${result.reason}` };
  }
  return { status: "skipped", error: `whatsapp_${result.reason ?? "unavailable"}` };
}

async function deliverChannel(
  admin: ReturnType<typeof createAdminClient>,
  workspace: WorkspaceRow,
  recipient: Recipient,
  channel: ReportChannel,
  kind: ReportKind,
  reportDate: string,
  message: BuiltReport,
  emailCache: Map<string, string | null>,
): Promise<ChannelOutcome> {
  if (channel === "in_app") return deliverInApp(admin, workspace, recipient, message);
  if (channel === "email") {
    return deliverEmail(admin, workspace, recipient, kind, reportDate, message, emailCache);
  }
  return deliverWhatsapp(admin, workspace, recipient, message);
}

async function processChannel(
  admin: ReturnType<typeof createAdminClient>,
  workspace: WorkspaceRow,
  recipient: Recipient,
  channel: ReportChannel,
  kind: ReportKind,
  reportDate: string,
  data: ScheduledReportData,
  message: BuiltReport,
  emailCache: Map<string, string | null>,
): Promise<"sent" | "skipped" | "failed"> {
  const reservation = await reserveDelivery(admin, {
    workspaceId: workspace.id,
    userId: recipient.userId,
    kind,
    reportDate,
    channel,
  });
  if (reservation.state === "duplicate") return "skipped";
  if (reservation.state === "exhausted") {
    logger.warn("cron.report_attempts_exhausted", { workspaceId: workspace.id, userId: recipient.userId, kind, channel });
    return "skipped";
  }
  if (reservation.state === "error" || !reservation.id) {
    logger.warn("cron.report_reservation_failed", {
      workspaceId: workspace.id,
      userId: recipient.userId,
      kind,
      channel,
      code: reservation.code,
    });
    return "failed";
  }

  const outcome = data.hasActivity
    ? await deliverChannel(admin, workspace, recipient, channel, kind, reportDate, message, emailCache)
    : { status: "skipped" as const, error: "no_activity" };

  await finishDelivery(admin, reservation.id, outcome);
  return outcome.status;
}

async function run(request: Request): Promise<Response> {
  const secret = getServerEnv().CRON_SECRET;
  const authorization = request.headers.get("authorization") ?? "";
  if (!secret || !safeEqual(authorization, `Bearer ${secret}`)) {
    return new Response("Forbidden", { status: 403 });
  }

  const admin = createAdminClient();
  const now = new Date();

  await admin
    .from("report_deliveries")
    .update({ status: "failed", last_error: "stale_reservation" })
    .eq("status", "sending")
    .lt("last_attempt_at", new Date(now.getTime() - STALE_RESERVATION_MS).toISOString());
  await admin
    .from("report_deliveries")
    .update({ status: "failed", last_error: "stale_reservation" })
    .eq("status", "sending")
    .is("last_attempt_at", null)
    .lt("created_at", new Date(now.getTime() - STALE_RESERVATION_MS).toISOString());

  const { data: workspaces, error } = await admin
    .from("workspaces")
    .select("id, name, owner_id, currency, timezone, locale")
    .order("created_at", { ascending: true })
    .limit(500);

  if (error) {
    logger.error("cron.workspace_list_failed", { code: error.code });
    return new Response("error", { status: 500 });
  }

  let sent = 0;
  let skipped = 0;
  let failed = 0;
  const emailCache = new Map<string, string | null>();

  for (const workspace of (workspaces ?? []) as WorkspaceRow[]) {
    try {
      const localHour = hourInZone(workspace.timezone, now);
      const today = todayInZone(workspace.timezone, now);
      const weekday = weekdayInZone(workspace.timezone, now);
      const lastDay = isLastDayOfMonthInZone(workspace.timezone, now);
      const recipients = await loadRecipients(admin, workspace);
      if (recipients.length === 0) continue;

      const dueKinds: ReportKind[] = (["daily", "weekly", "monthly"] as ReportKind[]).filter((kind) =>
        isDue(kind, localHour, weekday, lastDay),
      );

      const dataCache = new Map<string, ScheduledReportData>();
      const messageCache = new Map<string, BuiltReport>();
      const featureCache = new Map<ReportKind, boolean>();
      const whatsappFeature = await admin.rpc("has_workspace_feature", {
        p_workspace_id: workspace.id,
        p_feature_code: "whatsapp_integration",
      });

      const getData = async (kind: ReportKind, reportDate: string): Promise<ScheduledReportData> => {
        const key = `${kind}:${reportDate}`;
        const cached = dataCache.get(key);
        if (cached) return cached;
        const period = periodFor(kind, reportDate);
        const data = await loadScheduledReportData(admin, workspace, kind, period.from, period.to, reportDate);
        dataCache.set(key, data);
        return data;
      };

      const getMessage = async (
        kind: ReportKind,
        reportDate: string,
        locale: Locale,
        data: ScheduledReportData,
      ): Promise<BuiltReport> => {
        const key = `${kind}:${reportDate}:${locale}`;
        const cached = messageCache.get(key);
        if (cached) return cached;
        const message = buildScheduledReport(data, await getDictionary(locale), locale);
        messageCache.set(key, message);
        return message;
      };

      const featureAllowed = async (kind: ReportKind): Promise<boolean> => {
        const cached = featureCache.get(kind);
        if (cached !== undefined) return cached;
        const result = await admin.rpc("has_workspace_feature", {
          p_workspace_id: workspace.id,
          p_feature_code: FEATURE_BY_KIND[kind],
        });
        const allowed = !result.error && Boolean(result.data);
        featureCache.set(kind, allowed);
        return allowed;
      };

      for (const kind of dueKinds) {
        if (!(await featureAllowed(kind))) {
          skipped += recipients.length;
          continue;
        }
        for (const recipient of recipients) {
          if (!kindsForFrequency(recipient.frequency).includes(kind)) continue;
          const channels = enabledChannels(recipient);
          if (channels.length === 0) continue;
          try {
            const data = await getData(kind, today);
            const message = await getMessage(kind, today, recipient.language, data);
            for (const channel of channels) {
              if (channel === "whatsapp" && !whatsappFeature.data) {
                skipped += 1;
                continue;
              }
              const status = await processChannel(
                admin,
                workspace,
                recipient,
                channel,
                kind,
                today,
                data,
                message,
                emailCache,
              );
              if (status === "sent") sent += 1;
              else if (status === "failed") failed += 1;
              else skipped += 1;
            }
          } catch (recipientError) {
            logger.warn("cron.report_recipient_failed", {
              workspaceId: workspace.id,
              userId: recipient.userId,
              kind,
              error: recipientError,
            });
            failed += 1;
          }
        }
      }

      // Retry failed channel deliveries independently of the 21:00 window.
      const { data: retries } = await admin
        .from("report_deliveries")
        .select("*")
        .eq("workspace_id", workspace.id)
        .eq("status", "failed")
        .lt("attempts", MAX_ATTEMPTS)
        .gte("report_date", addDays(today, -RETRY_LOOKBACK_DAYS))
        .limit(100);

      for (const delivery of (retries ?? []) as ReportDeliveryRow[]) {
        if (delivery.last_attempt_at && now.getTime() - new Date(delivery.last_attempt_at).getTime() < RETRY_MIN_AGE_MS) {
          continue;
        }
        const recipient = recipients.find((item) => item.userId === delivery.user_id);
        if (!recipient || !kindsForFrequency(recipient.frequency).includes(delivery.kind)) continue;
        if (!enabledChannels(recipient).includes(delivery.channel)) continue;
        if (!(await featureAllowed(delivery.kind))) continue;
        if (delivery.channel === "whatsapp" && !whatsappFeature.data) continue;
        try {
          const data = await getData(delivery.kind, delivery.report_date);
          const message = await getMessage(delivery.kind, delivery.report_date, recipient.language, data);
          const status = await processChannel(
            admin,
            workspace,
            recipient,
            delivery.channel,
            delivery.kind,
            delivery.report_date,
            data,
            message,
            emailCache,
          );
          if (status === "sent") sent += 1;
          else if (status === "failed") failed += 1;
          else skipped += 1;
        } catch (retryError) {
          logger.warn("cron.report_retry_failed", { deliveryId: delivery.id, error: retryError });
          failed += 1;
        }
      }
    } catch (workspaceError) {
      logger.warn("cron.workspace_failed", { workspaceId: workspace.id, error: workspaceError });
      failed += 1;
    }
  }

  logger.info("cron.scheduled_reports_done", { sent, skipped, failed });
  return Response.json({ processed: (workspaces ?? []).length, sent, skipped, failed });
}

export async function GET(request: Request) {
  return run(request);
}

export async function POST(request: Request) {
  return run(request);
}
