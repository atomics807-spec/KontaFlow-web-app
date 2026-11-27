import type { Metadata } from "next";
import { Mail } from "lucide-react";
import { AdminEmpty, AdminPageHeader, AdminStat } from "@/components/admin/admin-ui";
import { Badge } from "@/components/ui/badge";
import { intlLocale, resolveLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/server";
import { formatDateTime } from "@/lib/dates";
import { requirePlatformAdmin } from "@/lib/platform-admin";
import { getPlatformEmailDelivery } from "@/services/platform-admin";

export const metadata: Metadata = {
  title: "Email delivery",
  robots: { index: false, follow: false },
};

const TONE: Record<string, "jade" | "mango" | "clay"> = {
  sent: "jade",
  skipped: "mango",
  failed: "clay",
};

export default async function AdminEmailPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = resolveLocale((await params).locale);
  const dict = await getDictionary(locale);
  const copy = dict.admin;
  await requirePlatformAdmin(locale);
  const delivery = await getPlatformEmailDelivery();

  return (
    <div className="space-y-5">
      <AdminPageHeader eyebrow={copy.emailDelivery} title={copy.emailTitle} lead={copy.emailLead} icon={Mail} badge={delivery.recent.length} />

      <section className="grid gap-3 sm:grid-cols-3">
        <AdminStat label={copy.sent30d} value={delivery.totals.sent_30d.toLocaleString()} tone="success" />
        <AdminStat label={copy.failed30d} value={delivery.totals.failed_30d.toLocaleString()} tone={delivery.totals.failed_30d ? "danger" : "neutral"} />
        <AdminStat label={copy.skipped30d} value={delivery.totals.skipped_30d.toLocaleString()} tone={delivery.totals.skipped_30d ? "warning" : "neutral"} />
      </section>

      {delivery.recent.length === 0 ? (
        <AdminEmpty>{copy.noEmails}</AdminEmpty>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-black/8 bg-white">
          <table className="w-full min-w-[42rem] text-left text-sm">
            <thead className="bg-[#f4f2ec] text-[0.62rem] uppercase tracking-[0.12em] text-[#151c19]/45">
              <tr>
                <th className="px-4 py-2.5 font-bold">{copy.recipient}</th>
                <th className="px-4 py-2.5 font-bold">{copy.subject}</th>
                <th className="px-4 py-2.5 font-bold">{copy.emailKind}</th>
                <th className="px-4 py-2.5 font-bold">{copy.deliveryStatus}</th>
                <th className="px-4 py-2.5 font-bold">{copy.created}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/8">
              {delivery.recent.map((email) => (
                <tr key={email.id} className="align-top">
                  <td className="px-4 py-3">
                    <p className="max-w-[14rem] truncate font-semibold text-[#151c19]">{email.recipient}</p>
                    {email.workspace_name ? <p className="mt-0.5 truncate text-[0.65rem] text-[#151c19]/40">{email.workspace_name}</p> : null}
                  </td>
                  <td className="px-4 py-3">
                    <p className="max-w-[18rem] truncate text-[#151c19]/75">{email.subject}</p>
                    {email.error ? <p className="mt-0.5 max-w-[18rem] truncate text-[0.65rem] text-[#8b2d18]">{email.error}</p> : null}
                  </td>
                  <td className="px-4 py-3 text-xs text-[#151c19]/55">{email.kind}</td>
                  <td className="px-4 py-3"><Badge tone={TONE[email.status] ?? "neutral"}>{email.status}</Badge></td>
                  <td className="px-4 py-3 text-xs text-[#151c19]/50">{formatDateTime(email.created_at, intlLocale(locale))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
