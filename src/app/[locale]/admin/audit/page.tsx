import type { Metadata } from "next";
import { ScrollText } from "lucide-react";
import { intlLocale, resolveLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/server";
import { formatDateTime } from "@/lib/dates";
import { requirePlatformAdmin } from "@/lib/platform-admin";
import { listPlatformAudit } from "@/services/platform-admin";

export const metadata: Metadata = {
  title: "Audit log",
  robots: { index: false, follow: false },
};

function detailLine(details: Record<string, unknown>): string {
  return Object.entries(details)
    .filter(([, value]) => value !== null && value !== undefined && value !== "")
    .slice(0, 5)
    .map(([key, value]) => `${key}: ${typeof value === "object" ? JSON.stringify(value) : String(value)}`)
    .join(" · ");
}

export default async function AdminAuditPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const locale = resolveLocale((await params).locale);
  const dict = await getDictionary(locale);
  const copy = dict.admin;
  await requirePlatformAdmin(locale);
  const entries = await listPlatformAudit();

  return (
    <div className="space-y-5">
      <header>
        <p className="text-[0.65rem] font-bold uppercase tracking-[0.16em] text-[#3f6b52]">{copy.audit}</p>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-[#151c19]">{copy.auditTitle}</h1>
        <p className="mt-1 max-w-2xl text-sm text-[#151c19]/55">{copy.auditLead}</p>
      </header>

      <section className="overflow-hidden rounded-2xl border border-black/8 bg-white">
        <div className="flex items-center gap-2 border-b border-black/8 px-4 py-3">
          <ScrollText className="h-4 w-4 text-[#3f6b52]" aria-hidden />
          <h2 className="text-sm font-extrabold text-[#151c19]">{copy.auditTitle}</h2>
        </div>

        {entries.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-[#151c19]/50">{copy.noAudit}</p>
        ) : (
          <ul className="divide-y divide-black/8">
            {entries.map((entry) => (
              <li key={entry.id} className="px-4 py-3">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <code className="rounded bg-[#f4f2ec] px-1.5 py-0.5 text-[0.68rem] font-bold text-[#24301f]">
                    {entry.action}
                  </code>
                  <span className="text-[0.68rem] text-[#151c19]/50">
                    {entry.target_type}
                    {entry.target_id ? ` · ${entry.target_id.slice(0, 8)}` : ""}
                  </span>
                  <span className="ml-auto text-[0.65rem] text-[#151c19]/40">
                    {formatDateTime(entry.created_at, intlLocale(locale))}
                  </span>
                </div>
                <p className="mt-1 text-[0.65rem] text-[#151c19]/45">
                  {copy.by}: {entry.admin_email ?? "system"}
                </p>
                {detailLine(entry.details) ? (
                  <p className="mt-1 break-words font-mono text-[0.62rem] text-[#151c19]/35">
                    {detailLine(entry.details)}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
