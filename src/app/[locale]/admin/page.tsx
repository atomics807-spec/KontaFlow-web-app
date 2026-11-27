import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, Building2, Gauge, LifeBuoy, Megaphone, PlugZap, ShieldAlert, Users } from "lucide-react";
import { AdminStat } from "@/components/admin/admin-ui";
import { buttonVariants } from "@/components/ui/button";
import { intlLocale, resolveLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/server";
import { formatDateTime, formatDate } from "@/lib/dates";
import { formatMoney, moneyLocale } from "@/lib/money";
import { getPlatformOperationsOverview, getPlatformOverview } from "@/services/platform-admin";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const dict = await getDictionary(resolveLocale((await params).locale));
  return { title: dict.admin.overviewTitle, robots: { index: false, follow: false } };
}

function Stat({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="rounded-2xl border border-black/8 bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <p className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-[#151c19]/45">{label}</p>
      <p className="mt-2 text-2xl font-extrabold tracking-tight text-[#151c19]">{value}</p>
      {detail ? <p className="mt-1 text-xs text-[#151c19]/50">{detail}</p> : null}
    </div>
  );
}

export default async function AdminOverviewPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const locale = resolveLocale((await params).locale);
  const dict = await getDictionary(locale);
  const copy = dict.admin;
  const [overview, operations] = await Promise.all([
    getPlatformOverview(),
    getPlatformOperationsOverview(),
  ]);

  const volume = Object.entries(overview.volume_30d_by_currency);
  const plans = Object.entries(overview.plan_distribution);

  return (
    <div className="space-y-6">
      <header className="rounded-2xl bg-[#151c19] px-5 py-6 text-white sm:px-7">
        <p className="text-[0.65rem] font-bold uppercase tracking-[0.18em] text-[#c9e46a]/70">
          {copy.console}
        </p>
        <h1 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">{copy.overviewTitle}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/60">{copy.overviewLead}</p>
      </header>

      <section aria-label={copy.overviewTitle} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label={copy.totalUsers}
          value={overview.users.toLocaleString(intlLocale(locale))}
          detail={`${overview.new_users_30d.toLocaleString(intlLocale(locale))} ${copy.newUsers.toLowerCase()}`}
        />
        <Stat
          label={copy.workspacesTotal}
          value={overview.workspaces.toLocaleString(intlLocale(locale))}
          detail={`${overview.active_subscriptions.toLocaleString(intlLocale(locale))} ${copy.activeSubscriptions.toLowerCase()}`}
        />
        <Stat
          label={copy.transactions30d}
          value={overview.transactions_30d.toLocaleString(intlLocale(locale))}
          detail={volume.length ? volume.map(([currency, minor]) => formatMoney(BigInt(minor), currency, moneyLocale(locale, currency))).join(" · ") : "—"}
        />
        <Stat
          label={`${copy.restricted} / ${copy.suspended}`}
          value={`${overview.restricted_users.toLocaleString(intlLocale(locale))} / ${overview.suspended_users.toLocaleString(intlLocale(locale))}`}
          detail={`${overview.trialing_subscriptions.toLocaleString(intlLocale(locale))} ${copy.trialingSubscriptions.toLowerCase()}`}
        />
      </section>

      <section aria-label={copy.usage} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <AdminStat label={copy.aiMessages} value={operations.ai_interactions_30d.toLocaleString(intlLocale(locale))} detail={copy.last30Days} tone="accent" />
        <AdminStat label={copy.sent30d} value={operations.emails_sent_30d.toLocaleString(intlLocale(locale))} detail={`${operations.emails_failed_30d} ${copy.failed30d.toLowerCase()}`} />
        <AdminStat label={copy.ussd} value={operations.ussd_sessions_30d.toLocaleString(intlLocale(locale))} detail={copy.last30Days} />
        <AdminStat label={copy.whatsapp} value={operations.whatsapp_messages_30d.toLocaleString(intlLocale(locale))} detail={`${operations.whatsapp_failed_30d} ${copy.failedMessages.toLowerCase()}`} />
        <AdminStat label={copy.failedPayments} value={operations.failed_payments_30d} detail={copy.last30Days} tone={operations.failed_payments_30d ? "danger" : "neutral"} />
        <AdminStat label={copy.supportRequests} value={operations.new_support_requests} detail={`${operations.pending_support_access} ${copy.pending.toLowerCase()}`} tone={operations.new_support_requests ? "warning" : "neutral"} />
        <AdminStat label={copy.webhookFailures} value={operations.webhook_failures_24h} detail="24h" tone={operations.webhook_failures_24h ? "warning" : "neutral"} />
        <AdminStat label={copy.activeAnnouncements} value={operations.active_announcements} />
      </section>

      <section className="flex flex-wrap gap-2">
        <Link href={`/${locale}/admin/payments`} className={buttonVariants({ variant: "secondary", size: "sm" })}>
          <Building2 className="h-4 w-4" aria-hidden />
          {copy.payments}
        </Link>
        <Link href={`/${locale}/admin/support`} className={buttonVariants({ variant: "secondary", size: "sm" })}>
          <LifeBuoy className="h-4 w-4" aria-hidden />
          {copy.support}
        </Link>
        <Link href={`/${locale}/admin/announcements`} className={buttonVariants({ variant: "secondary", size: "sm" })}>
          <Megaphone className="h-4 w-4" aria-hidden />
          {copy.announcements}
        </Link>
        <Link href={`/${locale}/admin/integrations`} className={buttonVariants({ variant: "secondary", size: "sm" })}>
          <PlugZap className="h-4 w-4" aria-hidden />
          {copy.integrations}
        </Link>
        <Link href={`/${locale}/admin/usage`} className={buttonVariants({ variant: "secondary", size: "sm" })}>
          <Gauge className="h-4 w-4" aria-hidden />
          {copy.usage}
        </Link>
      </section>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-2xl border border-black/8 bg-white p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-extrabold tracking-tight text-[#151c19]">{copy.recentRestrictions}</h2>
              <p className="mt-1 text-xs text-[#151c19]/50">{copy.restrictionHelp}</p>
            </div>
            <ShieldAlert className="h-5 w-5 text-[#b4552d]" aria-hidden />
          </div>
          {overview.recent_restrictions.length === 0 ? (
            <p className="mt-5 rounded-xl bg-[#f4f2ec] px-4 py-5 text-sm text-[#151c19]/55">
              {copy.noRestrictions}
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-black/8">
              {overview.recent_restrictions.map((item) => (
                <li key={item.id} className="flex flex-wrap items-start gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-[#151c19]">{item.email ?? item.user_id}</p>
                    <p className="mt-0.5 text-xs text-[#151c19]/60">{item.reason}</p>
                    <p className="mt-1 text-[0.65rem] text-[#151c19]/40">
                      {formatDateTime(item.created_at, intlLocale(locale))}
                      {" · "}
                      {item.expires_at ? `${copy.until} ${formatDate(item.expires_at, intlLocale(locale))}` : copy.durationForever}
                    </p>
                  </div>
                  <span
                    className={
                      item.severity === "suspended"
                        ? "rounded-full bg-[#f8d9d0] px-2.5 py-1 text-[0.65rem] font-bold text-[#8b2d18]"
                        : "rounded-full bg-[#f7e7c8] px-2.5 py-1 text-[0.65rem] font-bold text-[#7a4b10]"
                    }
                  >
                    {item.severity === "suspended" ? copy.suspended : copy.restricted}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <Link
            href={`/${locale}/admin/users`}
            className={buttonVariants({ variant: "secondary", size: "sm", className: "mt-4" })}
          >
            <Users className="h-4 w-4" aria-hidden />
            {copy.viewUsers}
          </Link>
        </section>

        <div className="space-y-4">
          <section className="rounded-2xl border border-black/8 bg-white p-5">
            <h2 className="text-base font-extrabold tracking-tight text-[#151c19]">{copy.planMix}</h2>
            <ul className="mt-3 space-y-2">
              {plans.length === 0 ? (
                <li className="text-sm text-[#151c19]/50">{copy.noWorkspaces}</li>
              ) : (
                plans.map(([plan, count]) => (
                  <li key={plan} className="flex items-center justify-between rounded-xl bg-[#f4f2ec] px-3 py-2">
                    <span className="text-sm font-semibold capitalize text-[#151c19]">{dict.plans[plan as "starter" | "growth" | "scale"] ?? plan}</span>
                    <span className="text-sm font-extrabold text-[#151c19]">{count.toLocaleString(intlLocale(locale))}</span>
                  </li>
                ))
              )}
            </ul>
            <Link
              href={`/${locale}/admin/workspaces`}
              className={buttonVariants({ variant: "secondary", size: "sm", className: "mt-4" })}
            >
              <Building2 className="h-4 w-4" aria-hidden />
              {copy.viewWorkspaces}
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </section>

          <section className="rounded-2xl border border-[#c9e46a]/30 bg-[#eef3da] p-5">
            <h2 className="text-sm font-extrabold tracking-tight text-[#24301f]">{copy.volume30d}</h2>
            {volume.length === 0 ? (
              <p className="mt-2 text-sm text-[#24301f]/60">—</p>
            ) : (
              <ul className="mt-3 space-y-1.5">
                {volume.map(([currency, minor]) => (
                  <li key={currency} className="flex items-center justify-between gap-3 text-sm">
                    <span className="font-semibold text-[#24301f]/60">{currency}</span>
                    <span className="font-extrabold text-[#24301f]">
                      {formatMoney(BigInt(minor), currency, moneyLocale(locale, currency))}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
