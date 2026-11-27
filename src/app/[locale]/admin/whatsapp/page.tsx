import type { Metadata } from "next";
import { MessageCircle } from "lucide-react";
import { AdminEmpty, AdminPageHeader, AdminStat } from "@/components/admin/admin-ui";
import { Badge } from "@/components/ui/badge";
import { intlLocale, resolveLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/server";
import { formatDateTime } from "@/lib/dates";
import { requirePlatformAdmin } from "@/lib/platform-admin";
import { getPlatformWhatsappActivity } from "@/services/platform-admin";

export const metadata: Metadata = {
  title: "WhatsApp activity",
  robots: { index: false, follow: false },
};

export default async function AdminWhatsappPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = resolveLocale((await params).locale);
  const dict = await getDictionary(locale);
  const copy = dict.admin;
  await requirePlatformAdmin(locale);
  const activity = await getPlatformWhatsappActivity();
  const maxDaily = Math.max(...activity.daily.map((day) => day.messages), 1);

  return (
    <div className="space-y-5">
      <AdminPageHeader eyebrow={copy.whatsapp} title={copy.whatsappTitle} lead={copy.whatsappLead} icon={MessageCircle} badge={activity.totals.messages_30d} />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <AdminStat label={copy.messages30d} value={activity.totals.messages_30d.toLocaleString()} tone="accent" />
        <AdminStat label={copy.inbound30d} value={activity.totals.inbound_30d.toLocaleString()} />
        <AdminStat label={copy.outbound30d} value={activity.totals.outbound_30d.toLocaleString()} />
        <AdminStat label={copy.failedMessages} value={activity.totals.failed_30d.toLocaleString()} tone={activity.totals.failed_30d ? "danger" : "neutral"} />
      </section>

      <section className="rounded-2xl border border-black/8 bg-white p-5">
        <h2 className="text-sm font-extrabold text-[#151c19]">{copy.usageDaily}</h2>
        {activity.daily.length === 0 ? (
          <AdminEmpty>{copy.noWhatsapp}</AdminEmpty>
        ) : (
          <div className="mt-4 flex h-36 items-end gap-1.5" aria-label={copy.usageDaily}>
            {activity.daily.map((day) => (
              <div key={day.day} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                <span className="flex w-full flex-col justify-end" style={{ height: "110px" }}>
                  <span className="w-full bg-[#3f6b52]" style={{ height: `${Math.max(2, Math.round((day.inbound / maxDaily) * 110))}px` }} title={`${day.day}: ${day.inbound} inbound`} />
                  <span className="w-full bg-[#c9e46a]" style={{ height: `${Math.max(2, Math.round((day.outbound / maxDaily) * 110))}px` }} title={`${day.day}: ${day.outbound} outbound`} />
                </span>
                <span className="w-full truncate text-center text-[0.55rem] text-[#151c19]/35">{day.day.slice(5)}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-black/8 bg-white p-5">
        <h2 className="text-sm font-extrabold text-[#151c19]">{copy.recentMessages}</h2>
        {activity.recent.length === 0 ? (
          <AdminEmpty>{copy.noWhatsapp}</AdminEmpty>
        ) : (
          <ul className="mt-3 divide-y divide-black/8">
            {activity.recent.map((message) => (
              <li key={message.id} className="flex flex-wrap items-center gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-[#151c19]">
                    <Badge tone={message.direction === "inbound" ? "jade" : "outline"}>{message.direction}</Badge>
                    {message.message_type}
                    {message.workspace_name ? <span className="text-[0.65rem] font-normal text-[#151c19]/45">{message.workspace_name}</span> : null}
                  </p>
                  <p className="mt-0.5 text-[0.65rem] text-[#151c19]/45">
                    {message.from_phone_masked} → {message.to_phone_masked} · {formatDateTime(message.created_at, intlLocale(locale))}
                  </p>
                </div>
                {message.status ? <Badge tone={message.status === "failed" ? "clay" : "neutral"}>{message.status}</Badge> : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
