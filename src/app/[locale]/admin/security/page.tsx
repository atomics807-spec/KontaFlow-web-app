import type { Metadata } from "next";
import { ShieldAlert } from "lucide-react";
import { AdminEmpty, AdminPageHeader, AdminSection } from "@/components/admin/admin-ui";
import { Badge } from "@/components/ui/badge";
import { intlLocale, resolveLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/server";
import { formatDateTime } from "@/lib/dates";
import { requirePlatformAdmin } from "@/lib/platform-admin";
import { getPlatformSecurityAudit } from "@/services/platform-admin";

export const metadata: Metadata = {
  title: "Security audit",
  robots: { index: false, follow: false },
};

export default async function AdminSecurityPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = resolveLocale((await params).locale);
  const dict = await getDictionary(locale);
  const copy = dict.admin;
  await requirePlatformAdmin(locale);
  const audit = await getPlatformSecurityAudit();

  return (
    <div className="space-y-5">
      <AdminPageHeader eyebrow={copy.security} title={copy.securityTitle} lead={copy.securityLead} icon={ShieldAlert} badge={audit.actions.length} />

      <AdminSection title={copy.securityActions}>
        {audit.actions.length === 0 ? (
          <AdminEmpty>{copy.noSecurityEvents}</AdminEmpty>
        ) : (
          <ul className="divide-y divide-black/8">
            {audit.actions.map((entry) => (
              <li key={entry.id} className="py-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <code className="rounded bg-[#f4f2ec] px-1.5 py-0.5 text-[0.68rem] font-bold text-[#3f6b52]">{entry.action}</code>
                  <Badge tone="outline">{entry.target_type}</Badge>
                  <span className="text-[0.65rem] text-[#151c19]/40">{formatDateTime(entry.created_at, intlLocale(locale))}</span>
                </div>
                <p className="mt-1 text-xs text-[#151c19]/55">
                  {entry.admin_email ?? "—"}
                  {entry.ip ? ` · ${copy.ipAddress}: ${entry.ip}` : ""}
                  {entry.target_id ? ` · ${entry.target_id}` : ""}
                </p>
                {Object.keys(entry.details).length > 0 ? (
                  <pre className="mt-1 max-h-24 overflow-auto rounded-lg bg-[#f7f6f1] p-2 text-[0.6rem] leading-relaxed text-[#151c19]/55">
                    {JSON.stringify(entry.details, null, 2)}
                  </pre>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </AdminSection>

      <AdminSection title={copy.restrictions}>
        {audit.restrictions.length === 0 ? (
          <AdminEmpty>{copy.noSecurityEvents}</AdminEmpty>
        ) : (
          <ul className="divide-y divide-black/8">
            {audit.restrictions.map((restriction) => (
              <li key={restriction.id} className="py-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={restriction.severity === "suspended" ? "clay" : "mango"}>{restriction.severity}</Badge>
                  <span className="text-sm font-semibold text-[#151c19]">{restriction.email ?? restriction.user_id}</span>
                  {restriction.lifted_at ? <Badge tone="neutral">lifted</Badge> : null}
                </div>
                <p className="mt-1 text-xs text-[#151c19]/55">{restriction.reason}</p>
                <p className="mt-0.5 text-[0.65rem] text-[#151c19]/40">
                  {formatDateTime(restriction.created_at, intlLocale(locale))}
                  {restriction.expires_at ? ` → ${formatDateTime(restriction.expires_at, intlLocale(locale))}` : ""}
                  {restriction.lift_reason ? ` · ${restriction.lift_reason}` : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </AdminSection>

      <AdminSection title={copy.supportAccessAudit}>
        {audit.support_access.length === 0 ? (
          <AdminEmpty>{copy.noSupportAccess}</AdminEmpty>
        ) : (
          <ul className="divide-y divide-black/8">
            {audit.support_access.map((grant) => (
              <li key={grant.id} className="py-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-[#151c19]">{grant.workspace_name}</span>
                  <Badge tone={grant.status === "approved" ? "jade" : grant.status === "pending" ? "mango" : "neutral"}>{grant.status}</Badge>
                  <Badge tone="outline">{grant.requested_hours}h</Badge>
                </div>
                <p className="mt-1 text-xs text-[#151c19]/55">{grant.justification}</p>
                <p className="mt-0.5 text-[0.65rem] text-[#151c19]/40">
                  {copy.requester}: {grant.requested_by_email ?? "—"} · {copy.approver}: {grant.approved_by_email ?? "—"} · {copy.accessCount}: {grant.access_count}
                </p>
              </li>
            ))}
          </ul>
        )}
      </AdminSection>
    </div>
  );
}
