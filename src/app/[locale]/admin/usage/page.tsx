import type { Metadata } from "next";
import { Gauge } from "lucide-react";
import { AdminBars, AdminEmpty, AdminPageHeader, AdminSection, AdminStat } from "@/components/admin/admin-ui";
import { resolveLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/server";
import { requirePlatformAdmin } from "@/lib/platform-admin";
import { getPlatformUsageMetrics } from "@/services/platform-admin";

export const metadata: Metadata = {
  title: "Usage",
  robots: { index: false, follow: false },
};

export default async function AdminUsagePage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = resolveLocale((await params).locale);
  const dict = await getDictionary(locale);
  const copy = dict.admin;
  await requirePlatformAdmin(locale);
  const usage = await getPlatformUsageMetrics();
  const maxDaily = Math.max(...usage.daily.map((day) => day.quantity), 1);

  return (
    <div className="space-y-5">
      <AdminPageHeader eyebrow={copy.usage} title={copy.usageTitle} lead={copy.usageLead} icon={Gauge} badge={usage.totals.events_30d} />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <AdminStat label={copy.events30d} value={usage.totals.events_30d.toLocaleString()} tone="accent" />
        <AdminStat label={copy.activeWorkspaces} value={usage.totals.active_workspaces_30d} />
        <AdminStat label={copy.transactions30d} value={usage.totals.transactions_30d.toLocaleString()} />
        <AdminStat label={copy.aiMessages} value={usage.totals.ai_messages_30d.toLocaleString()} />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <AdminSection title={copy.usageByKind}>
          <AdminBars
            label={copy.usageByKind}
            data={usage.by_kind.map((row) => ({ label: row.kind, value: row.quantity }))}
          />
        </AdminSection>

        <AdminSection title={copy.usageDaily}>
          {usage.daily.length === 0 ? (
            <AdminEmpty>{copy.noUsage}</AdminEmpty>
          ) : (
            <div className="flex h-40 items-end gap-1.5" aria-label={copy.usageDaily}>
              {usage.daily.map((day) => (
                <div key={day.day} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                  <span
                    className="w-full rounded-t bg-[#3f6b52]"
                    style={{ height: `${Math.max(4, Math.round((day.quantity / maxDaily) * 120))}px` }}
                    title={`${day.day}: ${day.quantity}`}
                  />
                  <span className="w-full truncate text-center text-[0.55rem] text-[#151c19]/35">{day.day.slice(5)}</span>
                </div>
              ))}
            </div>
          )}
        </AdminSection>
      </div>

      <AdminSection title={copy.topWorkspaces}>
        {usage.top_workspaces.length === 0 ? (
          <AdminEmpty>{copy.noUsage}</AdminEmpty>
        ) : (
          <ol className="divide-y divide-black/8">
            {usage.top_workspaces.map((workspace, index) => (
              <li key={workspace.id} className="flex items-center gap-3 py-2.5">
                <span className="grid h-6 w-6 place-items-center rounded-full bg-[#eef3da] text-[0.65rem] font-extrabold text-[#3f6b52]">{index + 1}</span>
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-[#151c19]">{workspace.name}</span>
                <span className="text-sm font-extrabold tabular-nums text-[#151c19]">{workspace.quantity.toLocaleString()}</span>
              </li>
            ))}
          </ol>
        )}
      </AdminSection>
    </div>
  );
}
