import type { Metadata } from "next";
import { PhoneCall } from "lucide-react";
import { AdminEmpty, AdminPageHeader, AdminStat } from "@/components/admin/admin-ui";
import { Badge } from "@/components/ui/badge";
import { intlLocale, resolveLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/server";
import { formatDateTime } from "@/lib/dates";
import { requirePlatformAdmin } from "@/lib/platform-admin";
import { getPlatformUssdActivity } from "@/services/platform-admin";

export const metadata: Metadata = {
  title: "USSD activity",
  robots: { index: false, follow: false },
};

export default async function AdminUssdPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = resolveLocale((await params).locale);
  const dict = await getDictionary(locale);
  const copy = dict.admin;
  await requirePlatformAdmin(locale);
  const activity = await getPlatformUssdActivity();
  const maxDaily = Math.max(...activity.daily.map((day) => day.sessions), 1);

  return (
    <div className="space-y-5">
      <AdminPageHeader eyebrow={copy.ussd} title={copy.ussdTitle} lead={copy.ussdLead} icon={PhoneCall} badge={activity.totals.sessions_30d} />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <AdminStat label={copy.sessions30d} value={activity.totals.sessions_30d.toLocaleString()} tone="accent" />
        <AdminStat label={copy.activeSessions} value={activity.totals.active_sessions} tone={activity.totals.active_sessions ? "success" : "neutral"} />
        <AdminStat label={copy.uniquePhones} value={activity.totals.unique_phones_30d.toLocaleString()} />
        <AdminStat label={copy.linkedSessions} value={activity.totals.linked_sessions_30d.toLocaleString()} />
      </section>

      <section className="rounded-2xl border border-black/8 bg-white p-5">
        <h2 className="text-sm font-extrabold text-[#151c19]">{copy.usageDaily}</h2>
        {activity.daily.length === 0 ? (
          <AdminEmpty>{copy.noUssd}</AdminEmpty>
        ) : (
          <div className="mt-4 flex h-36 items-end gap-1.5" aria-label={copy.usageDaily}>
            {activity.daily.map((day) => (
              <div key={day.day} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                <span className="w-full rounded-t bg-[#3f6b52]" style={{ height: `${Math.max(4, Math.round((day.sessions / maxDaily) * 110))}px` }} title={`${day.day}: ${day.sessions}`} />
                <span className="w-full truncate text-center text-[0.55rem] text-[#151c19]/35">{day.day.slice(5)}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-black/8 bg-white p-5">
        <h2 className="text-sm font-extrabold text-[#151c19]">{copy.recentSessions}</h2>
        {activity.recent.length === 0 ? (
          <AdminEmpty>{copy.noUssd}</AdminEmpty>
        ) : (
          <ul className="mt-3 divide-y divide-black/8">
            {activity.recent.map((session) => (
              <li key={session.session_id} className="flex flex-wrap items-center gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-sm font-semibold text-[#151c19]">
                    {session.phone_masked}
                    {session.workspace_name ? <Badge tone="jade">{session.workspace_name}</Badge> : <Badge tone="outline">—</Badge>}
                  </p>
                  <p className="mt-0.5 text-[0.65rem] text-[#151c19]/45">
                    {session.service_code ?? "—"} · {formatDateTime(session.updated_at, intlLocale(locale))}
                  </p>
                </div>
                <div className="text-right text-[0.65rem] text-[#151c19]/40">
                  <p>{copy.expiresAt}</p>
                  <p className="font-semibold text-[#151c19]/60">{formatDateTime(session.expires_at, intlLocale(locale))}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
