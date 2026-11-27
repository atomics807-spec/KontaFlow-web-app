import type { Metadata } from "next";
import { Sparkles } from "lucide-react";
import { AdminBars, AdminEmpty, AdminPageHeader, AdminSection, AdminStat } from "@/components/admin/admin-ui";
import { resolveLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/server";
import { requirePlatformAdmin } from "@/lib/platform-admin";
import { getPlatformAiUsage } from "@/services/platform-admin";

export const metadata: Metadata = {
  title: "AI usage",
  robots: { index: false, follow: false },
};

export default async function AdminAiPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = resolveLocale((await params).locale);
  const dict = await getDictionary(locale);
  const copy = dict.admin;
  await requirePlatformAdmin(locale);
  const usage = await getPlatformAiUsage();
  const maxDaily = Math.max(...usage.daily.map((day) => day.tokens), 1);

  return (
    <div className="space-y-5">
      <AdminPageHeader eyebrow={copy.aiUsage} title={copy.aiUsageTitle} lead={copy.aiUsageLead} icon={Sparkles} badge={usage.totals.interactions_30d} />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <AdminStat label={copy.interactions30d} value={usage.totals.interactions_30d.toLocaleString()} tone="accent" />
        <AdminStat label={copy.promptTokens} value={usage.totals.prompt_tokens_30d.toLocaleString()} />
        <AdminStat label={copy.completionTokens} value={usage.totals.completion_tokens_30d.toLocaleString()} />
        <AdminStat label={copy.aiCost} value={usage.totals.cost_minor_30d} tone="warning" />
        <AdminStat label={copy.avgLatency} value={`${usage.totals.avg_latency_ms_30d} ms`} />
        <AdminStat label={copy.errors} value={usage.totals.errors_30d} tone={usage.totals.errors_30d ? "danger" : "neutral"} />
        <AdminStat label={copy.blocked} value={usage.totals.blocked_30d} tone={usage.totals.blocked_30d ? "warning" : "neutral"} />
        <AdminStat label={copy.byModel} value={usage.by_model.length} />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <AdminSection title={copy.byStatus}>
          <AdminBars label={copy.byStatus} data={usage.by_status.map((row) => ({ label: row.status, value: row.count }))} />
        </AdminSection>
        <AdminSection title={copy.byModel}>
          <AdminBars label={copy.byModel} data={usage.by_model.map((row) => ({ label: row.model, value: row.count }))} />
        </AdminSection>
      </div>

      <AdminSection title={copy.dailyUsage}>
        {usage.daily.length === 0 ? (
          <AdminEmpty>{copy.noAiUsage}</AdminEmpty>
        ) : (
          <div className="flex h-40 items-end gap-1.5" aria-label={copy.dailyUsage}>
            {usage.daily.map((day) => (
              <div key={day.day} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                <span
                  className="w-full rounded-t bg-[#7a8f3f]"
                  style={{ height: `${Math.max(4, Math.round((day.tokens / maxDaily) * 120))}px` }}
                  title={`${day.day}: ${day.interactions} · ${day.tokens} tokens`}
                />
                <span className="w-full truncate text-center text-[0.55rem] text-[#151c19]/35">{day.day.slice(5)}</span>
              </div>
            ))}
          </div>
        )}
      </AdminSection>

      <AdminSection title={copy.topAiWorkspaces}>
        {usage.top_workspaces.length === 0 ? (
          <AdminEmpty>{copy.noAiUsage}</AdminEmpty>
        ) : (
          <ol className="divide-y divide-black/8">
            {usage.top_workspaces.map((workspace) => (
              <li key={workspace.id} className="flex items-center gap-3 py-2.5">
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-[#151c19]">{workspace.name}</span>
                <span className="text-xs text-[#151c19]/45">{workspace.tokens.toLocaleString()} tokens</span>
                <span className="text-sm font-extrabold tabular-nums text-[#151c19]">{workspace.interactions.toLocaleString()}</span>
              </li>
            ))}
          </ol>
        )}
      </AdminSection>
    </div>
  );
}
