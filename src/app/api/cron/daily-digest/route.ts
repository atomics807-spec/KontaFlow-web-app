import { getServerEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/integrations/email";
import { safeEqual } from "@/lib/integrations/whatsapp";
import { addDays, todayInZone } from "@/lib/dates";
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

/**
 * Daily book close email for workspace owners.
 * Schedule: 19:00 Africa/Douala (18:00 UTC) via Vercel Cron or Cloudflare Cron
 * Triggers, with `Authorization: Bearer $CRON_SECRET`.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function run(request: Request): Promise<Response> {
  const secret = getServerEnv().CRON_SECRET;
  const authorization = request.headers.get("authorization") ?? "";
  if (!secret || !safeEqual(authorization, `Bearer ${secret}`)) {
    return new Response("Forbidden", { status: 403 });
  }

  const admin = createAdminClient();
  const { data: workspaces, error } = await admin
    .from("workspaces")
    .select("id, name, owner_id, currency, timezone, locale")
    .order("created_at", { ascending: true })
    .limit(200);

  if (error) {
    logger.error("cron.workspace_list_failed", { code: error.code });
    return new Response("error", { status: 500 });
  }

  let sent = 0;
  let skipped = 0;

  for (const workspace of workspaces ?? []) {
    try {
      const today = todayInZone(workspace.timezone);
      const yesterday = addDays(today, -1);

      const { data: summary, error: summaryError } = await admin.rpc("get_workspace_summary_as_service", {
        p_workspace_id: workspace.id,
        p_from: yesterday,
        p_to: yesterday,
      });
      if (summaryError || !summary) {
        skipped += 1;
        continue;
      }

      const figures = summary as Summary;
      const income = BigInt(figures.totalIncomeMinor ?? "0");
      const expense = BigInt(figures.totalExpenseMinor ?? "0");
      if (income === 0n && expense === 0n) {
        skipped += 1;
        continue;
      }

      const { data: owner } = await admin.auth.admin.getUserById(workspace.owner_id);
      const email = owner?.user?.email;
      if (!email) {
        skipped += 1;
        continue;
      }

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
      const subject = interpolate(copy.dailySubject, {
        workspace: workspace.name.replace(/[\r\n]+/g, " "),
        date: yesterday,
      });

      const text = interpolate(copy.dailyText, {
        workspace: workspace.name,
        date: yesterday,
        income: money(income),
        expense: money(expense),
        net: money(net),
        cash: money(cash),
        open: copy.dailyOpen,
      });

      const html = `
        <div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;max-width:520px;margin:0 auto;padding:32px;color:#0b1f1a">
          <p style="font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:#0b7a5a;margin:0 0 20px">KontaFlow</p>
          <h1 style="font-size:20px;margin:0 0 4px">${escapeHtml(workspace.name)}</h1>
          <p style="font-size:13px;color:#7a8a83;margin:0 0 20px">${escapeHtml(yesterday)}</p>
          <table style="width:100%;font-size:14px;border-collapse:collapse">
            <tr><td style="padding:6px 0;color:#4b5f58">${escapeHtml(copy.dailyIncome)}</td><td style="text-align:right;font-weight:600">${escapeHtml(money(income))}</td></tr>
            <tr><td style="padding:6px 0;color:#4b5f58">${escapeHtml(copy.dailyExpenses)}</td><td style="text-align:right;font-weight:600">${escapeHtml(money(expense))}</td></tr>
            <tr><td style="padding:6px 0;color:#4b5f58">${escapeHtml(copy.dailyNet)}</td><td style="text-align:right;font-weight:600">${escapeHtml(money(net))}</td></tr>
            <tr><td style="padding:6px 0;border-top:1px solid #e5dfd1;color:#4b5f58">${escapeHtml(copy.dailyCash)}</td><td style="text-align:right;font-weight:600;border-top:1px solid #e5dfd1">${escapeHtml(money(cash))}</td></tr>
          </table>
          <p style="font-size:12px;color:#7a8a83;margin:24px 0 0">${escapeHtml(copy.dailyFooter)}</p>
        </div>`;

      const result = await sendEmail({
        to: email,
        subject,
        html,
        text,
      });

      if (result.sent) {
        sent += 1;
        await admin.from("notifications").insert({
          workspace_id: workspace.id,
          user_id: workspace.owner_id,
          channel: "email",
          title: interpolate(copy.dailyTitle, { date: yesterday }),
          body: text.slice(0, 900),
          sent_at: new Date().toISOString(),
        });
      } else {
        skipped += 1;
      }
    } catch (error) {
      logger.warn("cron.workspace_failed", { error });
      skipped += 1;
    }
  }

  logger.info("cron.daily_digest_done", { sent, skipped });
  return Response.json({ processed: (workspaces ?? []).length, sent, skipped });
}

export async function GET(request: Request) {
  return run(request);
}

export async function POST(request: Request) {
  return run(request);
}
