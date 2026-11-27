import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { AdminEmpty, AdminPageHeader, AdminSection, AdminStat } from "@/components/admin/admin-ui";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { intlLocale, resolveLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/server";
import { formatDate, formatDateTime } from "@/lib/dates";
import { formatMoney, moneyLocale } from "@/lib/money";
import { requirePlatformAdmin } from "@/lib/platform-admin";
import { getPlatformSupportSnapshot } from "@/services/platform-admin";

export const metadata: Metadata = {
  title: "Support snapshot",
  robots: { index: false, follow: false },
};

export default async function SupportSnapshotPage({
  params,
}: {
  params: Promise<{ locale: string; workspaceId: string }>;
}) {
  const { locale: rawLocale, workspaceId } = await params;
  const locale = resolveLocale(rawLocale);
  const dict = await getDictionary(locale);
  const copy = dict.admin;
  await requirePlatformAdmin(locale);

  let snapshot;
  try {
    snapshot = await getPlatformSupportSnapshot(workspaceId);
  } catch {
    return (
      <div className="space-y-4">
        <Link href={`/${locale}/admin/support`} className="inline-flex items-center gap-1.5 text-xs font-bold text-[#3f6b52]">
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          {dict.common.back}
        </Link>
        <Alert tone="error">{copy.snapshotExpired}</Alert>
      </div>
    );
  }

  const money = (value: string) =>
    formatMoney(BigInt(value), snapshot.workspace.currency, moneyLocale(locale, snapshot.workspace.currency));

  return (
    <div className="space-y-5">
      <Link href={`/${locale}/admin/support`} className="inline-flex items-center gap-1.5 text-xs font-bold text-[#3f6b52]">
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
        {dict.common.back}
      </Link>

      <AdminPageHeader
        eyebrow={copy.supportSnapshot}
        title={snapshot.workspace.name}
        lead={copy.snapshotLead}
        icon={ShieldCheck}
        badge={`${copy.grantExpires}: ${formatDateTime(snapshot.grant.expires_at, intlLocale(locale))}`}
      />

      <div className="flex flex-wrap gap-2 text-xs">
        <Badge tone="jade">{snapshot.workspace.plan}</Badge>
        <Badge tone="outline">{snapshot.workspace.slug}</Badge>
        <Badge tone="outline">{snapshot.workspace.timezone}</Badge>
        <Badge tone="outline">{snapshot.workspace.owner_email ?? "—"}</Badge>
        <Badge tone="mango">{copy.accessCount}: {snapshot.grant.access_count}</Badge>
      </div>

      <Alert tone="info">{snapshot.grant.justification}</Alert>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <AdminStat label={copy.members} value={snapshot.counts.members} />
        <AdminStat label={copy.customers} value={snapshot.counts.customers} />
        <AdminStat label={copy.suppliers} value={snapshot.counts.suppliers} />
        <AdminStat label={dict.transactions.title} value={snapshot.counts.transactions} />
      </section>

      <AdminSection title={copy.last30Days}>
        <div className="grid gap-3 sm:grid-cols-2">
          <AdminStat label={dict.dashboard.income} value={money(snapshot.totals_30d.income_minor)} tone="success" />
          <AdminStat label={dict.dashboard.expenses} value={money(snapshot.totals_30d.expense_minor)} tone="danger" />
        </div>
      </AdminSection>

      <AdminSection title={copy.recentTransactions}>
        {snapshot.recent_transactions.length === 0 ? (
          <AdminEmpty>—</AdminEmpty>
        ) : (
          <ul className="divide-y divide-black/8">
            {snapshot.recent_transactions.map((transaction) => (
              <li key={transaction.id} className="flex flex-wrap items-center gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[#151c19]">{transaction.description}</p>
                  <p className="mt-0.5 text-[0.65rem] text-[#151c19]/45">
                    {formatDate(transaction.occurred_on, intlLocale(locale))}
                    {transaction.category_name ? ` · ${transaction.category_name}` : ""} · {transaction.status}
                  </p>
                </div>
                <span className={`text-sm font-extrabold tabular-nums ${transaction.kind === "income" ? "text-[#2f5735]" : "text-[#8b2d18]"}`}>
                  {transaction.kind === "income" ? "+" : "−"}
                  {formatMoney(BigInt(transaction.amount_minor), transaction.currency, moneyLocale(locale, transaction.currency))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </AdminSection>
    </div>
  );
}
