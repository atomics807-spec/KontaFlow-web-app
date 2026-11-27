import { getPublicEnv, getServerEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/integrations/email";
import { safeEqual } from "@/lib/integrations/whatsapp";
import { resolveLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/server";
import { interpolate } from "@/lib/i18n/interpolate";
import { logger } from "@/lib/logger";

const DAY_MS = 24 * 60 * 60 * 1000;

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
  const expired = await admin.rpc("expire_trials");
  if (expired.error) logger.warn("cron.expire_trials_failed", { code: expired.error.code });

  const { data: settings, error: settingsError } = await admin
    .from("platform_settings")
    .select("value")
    .eq("key", "billing")
    .maybeSingle();
  if (settingsError) {
    logger.error("cron.trial_settings_failed", { code: settingsError.code });
    return new Response("error", { status: 500 });
  }
  const reminderValue = (settings?.value as { trial_reminder_days?: unknown })?.trial_reminder_days;
  const reminderDays = Array.isArray(reminderValue)
    ? reminderValue.map(Number).filter((day) => Number.isInteger(day) && day > 0)
    : [7, 3, 1];

  const { data: subscriptions, error } = await admin
    .from("subscriptions")
    .select("id, workspace_id, trial_ends_at, trial_plan_id")
    .eq("status", "trialing")
    .not("trial_ends_at", "is", null)
    .order("trial_ends_at", { ascending: true })
    .limit(500);
  if (error) {
    logger.error("cron.trial_list_failed", { code: error.code });
    return new Response("error", { status: 500 });
  }

  const workspaceIds = [...new Set((subscriptions ?? []).map((row) => row.workspace_id))];
  const { data: workspaces } = workspaceIds.length
    ? await admin.from("workspaces").select("id, name, owner_id, locale, currency").in("id", workspaceIds)
    : { data: [] };
  const workspaceById = new Map((workspaces ?? []).map((workspace) => [workspace.id, workspace]));
  const planIds = [...new Set((subscriptions ?? []).map((row) => row.trial_plan_id).filter(Boolean))] as string[];
  const { data: plans } = planIds.length
    ? await admin.from("subscription_plans").select("id, name").in("id", planIds)
    : { data: [] };
  const planById = new Map((plans ?? []).map((plan) => [plan.id, plan]));

  let sent = 0;
  let skipped = 0;

  for (const subscription of subscriptions ?? []) {
    try {
      if (!subscription.trial_ends_at) continue;
      const daysLeft = Math.max(0, Math.ceil((new Date(subscription.trial_ends_at).getTime() - Date.now()) / DAY_MS));
      if (!reminderDays.includes(daysLeft)) {
        skipped += 1;
        continue;
      }

      const workspace = workspaceById.get(subscription.workspace_id);
      if (!workspace) {
        skipped += 1;
        continue;
      }

      const { data: existing } = await admin
        .from("trial_reminder_log")
        .select("workspace_id")
        .eq("workspace_id", workspace.id)
        .eq("days_before", daysLeft)
        .maybeSingle();
      if (existing) {
        skipped += 1;
        continue;
      }

      const { data: owner } = await admin.auth.admin.getUserById(workspace.owner_id);
      const email = owner?.user?.email;
      if (!email) {
        skipped += 1;
        continue;
      }

      const { data: profile } = await admin
        .from("profiles")
        .select("locale")
        .eq("id", workspace.owner_id)
        .maybeSingle();
      const locale = resolveLocale(profile?.locale ?? workspace.locale);
      const dict = await getDictionary(locale);
      const copy = dict.emails;
      const planName = subscription.trial_plan_id
        ? planById.get(subscription.trial_plan_id)?.name ?? dict.plans.starter
        : dict.plans.starter;
      const billingUrl = `${getPublicEnv().NEXT_PUBLIC_APP_URL}/${locale}/billing`;
      const subject = interpolate(copy.trialSubject, { workspace: workspace.name, days: daysLeft });
      const text = interpolate(copy.trialText, {
        workspace: workspace.name,
        days: daysLeft,
        plan: planName,
        cta: copy.trialCta,
        url: billingUrl,
      });
      const html = `
        <div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;max-width:520px;margin:0 auto;padding:32px;color:#0b1f1a">
          <p style="font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:#0b7a5a;margin:0 0 24px">KontaFlow</p>
          <h1 style="font-size:22px;margin:0 0 16px">${escapeHtml(interpolate(copy.trialTitle, { workspace: workspace.name }))}</h1>
          <p style="font-size:15px;line-height:1.6;color:#4b5f58;margin:0 0 16px">${escapeHtml(text)}</p>
          <a href="${escapeHtml(billingUrl)}"
             style="display:inline-block;background:#0b7a5a;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:600">
            ${escapeHtml(copy.trialCta)}
          </a>
        </div>`;

      const result = await sendEmail({ to: email, subject, html, text });
      if (!result.sent) {
        skipped += 1;
        continue;
      }

      await admin.from("trial_reminder_log").insert({ workspace_id: workspace.id, days_before: daysLeft });
      await admin.from("notifications").insert({
        workspace_id: workspace.id,
        user_id: workspace.owner_id,
        channel: "email",
        title: subject,
        body: text.slice(0, 900),
        sent_at: new Date().toISOString(),
      });
      sent += 1;
    } catch (error) {
      logger.warn("cron.trial_reminder_failed", { error });
      skipped += 1;
    }
  }

  logger.info("cron.trial_reminders_done", { sent, skipped, expired: expired.data ?? 0 });
  return Response.json({ processed: (subscriptions ?? []).length, sent, skipped, expired: expired.data ?? 0 });
}

export async function GET(request: Request) {
  return run(request);
}

export async function POST(request: Request) {
  return run(request);
}
