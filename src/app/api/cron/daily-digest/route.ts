import { getServerEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/integrations/email";
import { safeEqual } from "@/lib/integrations/whatsapp";
import { addDays, hourInZone, todayInZone, weekdayInZone } from "@/lib/dates";
import { formatMoney, moneyLocale } from "@/lib/money";
import { resolveLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/server";
import { interpolate } from "@/lib/i18n/interpolate";
import { logger } from "@/lib/logger";

type Summary = {
  totalIncomeMinor: string;
  totalExpenseMinor: string;
  netProfitMinor: string;
  cashBalanceMinor: string;
};

type ReportKind = "daily" | "weekly";

type WorkspaceRow = {
  id: string;
  name: string;
  owner_id: string;
  currency: string;
  timezone: string;
  locale: string;
};

const REPORT_HOUR = 21;
const STALE_RESERVATION_MS = 2 * 60 * 60 * 1000;

/**
 * Scheduled book-close emails for Growth and Scale.
 * The cron runs hourly; each workspace receives its report at 21:00 local time.
 * Sundays send the weekly report in addition to the daily close.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function deliverReport(
  admin: ReturnType<typeof createAdminClient>,
  workspace: WorkspaceRow,
  kind: ReportKind,
  from: string,
  to: string,
): Promise<"sent" | "skipped" | "failed"> {
  const { data: summary, error: summaryError } = await admin.rpc("get_workspace_summary_as_service", {
    p_workspace_id: workspace.id,
    p_from: from,
    p_to: to,
  });
  if (summaryError || !summary) return "skipped";

  const figures = summary as Summary;
  const income = BigInt(figures.totalIncomeMinor ?? "0");
  const expense = BigInt(figures.totalExpenseMinor ?? "0");
  if (income === 0n && expense === 0n) return "skipped";

  const { data: owner } = await admin.auth.admin.getUserById(workspace.owner_id);
  const email = owner?.user?.email;
  if (!email) return "skipped";

  const { data: ownerProfile } = await admin
    .from("profiles")
    .select("locale")
    .eq("id", workspace.owner_id)
    .maybeSingle();
  const locale = resolveLocale(ownerProfile?.locale ?? workspace.locale);
  const dict = await getDictionary(locale);
  const copy = dict.emails;
  const money = (value: bigint) => formatMoney(value, workspace.currency, moneyLocale(locale, workspace.currency));
  const net = BigInt(figures.netProfitMinor ?? "0");
  const cash = BigInt(figures.cashBalanceMinor ?? "0");

  const subject =
    kind === "weekly"
      ? interpolate(copy.weeklySubject, {
          workspace: workspace.name.replace(/[\r\n]+/g, " "),
          date: to,
        })
      : interpolate(copy.dailySubject, {
          workspace: workspace.name.replace(/[\r\n]+/g, " "),
          date: from,
        });

  const text =
    kind === "weekly"
      ? interpolate(copy.weeklyText, {
          workspace: workspace.name,
          from,
          to,
          income: money(income),
          expense: money(expense),
          net: money(net),
          cash: money(cash),
          open: copy.dailyOpen,
        })
      : interpolate(copy.dailyText, {
          workspace: workspace.name,
          date: from,
          income: money(income),
          expense: money(expense),
          net: money(net),
          cash: money(cash),
          open: copy.dailyOpen,
        });

  const periodLabel = kind === "weekly" ? `${from} – ${to}` : from;
  const footer = kind === "weekly" ? copy.weeklyFooter : copy.dailyFooter;
  const html = `
    <div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;max-width:520px;margin:0 auto;padding:32px;color:#0b1f1a">
      <p style="font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:#0b7a5a;margin:0 0 20px">KontaFlow</p>
      <h1 style="font-size:20px;margin:0 0 4px">${escapeHtml(workspace.name)}</h1>
      <p style="font-size:13px;color:#7a8a83;margin:0 0 20px">${escapeHtml(periodLabel)}</p>
      <table style="width:100%;font-size:14px;border-collapse:collapse">
        <tr><td style="padding:6px 0;color:#4b5f58">${escapeHtml(copy.dailyIncome)}</td><td style="text-align:right;font-weight:600">${escapeHtml(money(income))}</td></tr>
        <tr><td style="padding:6px 0;color:#4b5f58">${escapeHtml(copy.dailyExpenses)}</td><td style="text-align:right;font-weight:600">${escapeHtml(money(expense))}</td></tr>
        <tr><td style="padding:6px 0;color:#4b5f58">${escapeHtml(copy.dailyNet)}</td><td style="text-align:right;font-weight:600">${escapeHtml(money(net))}</td></tr>
        <tr><td style="padding:6px 0;border-top:1px solid #e5dfd1;color:#4b5f58">${escapeHtml(copy.dailyCash)}</td><td style="text-align:right;font-weight:600;border-top:1px solid #e5dfd1">${escapeHtml(money(cash))}</td></tr>
      </table>
      <p style="font-size:12px;color:#7a8a83;margin:24px 0 0">${escapeHtml(footer)}</p>
    </div>`;

  const result = await sendEmail({ to: email, subject, html, text });
  if (!result.sent) return "failed";

  await admin.from("notifications").insert({
    workspace_id: workspace.id,
    user_id: workspace.owner_id,
    channel: "email",
    title:
      kind === "weekly"
        ? interpolate(copy.weeklyTitle, { from, to })
        : interpolate(copy.dailyTitle, { date: from }),
    body: text.slice(0, 900),
    sent_at: new Date().toISOString(),
  });
  return "sent";
}

async function reserveReport(
  admin: ReturnType<typeof createAdminClient>,
  workspaceId: string,
  kind: ReportKind,
  reportDate: string,
): Promise<{ id: string | null; state: "reserved" | "duplicate" | "error"; code?: string }> {
  const insert = await admin
    .from("report_deliveries")
    .insert({
      workspace_id: workspaceId,
      kind,
      report_date: reportDate,
      status: "sending",
    })
    .select("id")
    .maybeSingle();
  if (!insert.error) return { id: insert.data?.id ?? null, state: "reserved" };
  if (insert.error.code !== "23505") return { id: null, state: "error", code: insert.error.code };

  const { data: existing } = await admin
    .from("report_deliveries")
    .select("id, status, attempts")
    .eq("workspace_id", workspaceId)
    .eq("kind", kind)
    .eq("report_date", reportDate)
    .maybeSingle();

  if (existing?.status === "failed") {
    const retried = await admin
      .from("report_deliveries")
      .update({ status: "sending", attempts: Number(existing.attempts ?? 1) + 1, last_error: null })
      .eq("id", existing.id)
      .eq("status", "failed")
      .select("id")
      .maybeSingle();
    if (!retried.error && retried.data) return { id: retried.data.id, state: "reserved" };
  }

  return { id: null, state: "duplicate" };
}

async function run(request: Request): Promise<Response> {
  const secret = getServerEnv().CRON_SECRET;
  const authorization = request.headers.get("authorization") ?? "";
  if (!secret || !safeEqual(authorization, `Bearer ${secret}`)) {
    return new Response("Forbidden", { status: 403 });
  }

  const admin = createAdminClient();
  const now = new Date();

  // A crashed process must not block the next day's report forever.
  await admin
    .from("report_deliveries")
    .delete()
    .eq("status", "sending")
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

  for (const workspace of (workspaces ?? []) as WorkspaceRow[]) {
    try {
      if (hourInZone(workspace.timezone, now) !== REPORT_HOUR) {
        skipped += 1;
        continue;
      }

      const today = todayInZone(workspace.timezone, now);
      const kinds: ReportKind[] = weekdayInZone(workspace.timezone, now) === 0 ? ["daily", "weekly"] : ["daily"];

      for (const kind of kinds) {
        const feature = kind === "weekly" ? "weekly_reports" : "daily_reports";
        const { data: allowed, error: featureError } = await admin.rpc("has_workspace_feature", {
          p_workspace_id: workspace.id,
          p_feature_code: feature,
        });
        if (featureError) {
          logger.warn("cron.report_feature_failed", {
            workspaceId: workspace.id,
            kind,
            code: featureError.code,
          });
          failed += 1;
          continue;
        }
        if (!allowed) {
          skipped += 1;
          continue;
        }

        const reservation = await reserveReport(admin, workspace.id, kind, today);
        if (reservation.state === "duplicate") {
          skipped += 1;
          continue;
        }
        if (reservation.state === "error") {
          logger.warn("cron.report_reservation_failed", {
            workspaceId: workspace.id,
            kind,
            code: reservation.code,
          });
          failed += 1;
          continue;
        }

        const from = kind === "weekly" ? addDays(today, -6) : addDays(today, -1);
        const to = kind === "weekly" ? today : addDays(today, -1);
        const result = await deliverReport(admin, workspace, kind, from, to);

        if (reservation.id) {
          await admin
            .from("report_deliveries")
            .update({
              status: result,
              last_error: result === "failed" ? "email_delivery_failed" : null,
              sent_at: result === "sent" ? new Date().toISOString() : null,
            })
            .eq("id", reservation.id);
        }

        if (result === "sent") sent += 1;
        else if (result === "skipped") skipped += 1;
        else failed += 1;
      }
    } catch (error) {
      logger.warn("cron.workspace_failed", { workspaceId: workspace.id, error });
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
