import type { Metadata } from "next";
import Link from "next/link";
import { CreditCard, Search } from "lucide-react";
import { AdminEmpty, AdminPageHeader, AdminStat } from "@/components/admin/admin-ui";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { intlLocale, resolveLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/server";
import { formatDateTime } from "@/lib/dates";
import { formatMoney, moneyLocale } from "@/lib/money";
import { requirePlatformAdmin } from "@/lib/platform-admin";
import { getPlatformOperationsOverview, listPlatformPayments } from "@/services/platform-admin";

export const metadata: Metadata = {
  title: "Payments",
  robots: { index: false, follow: false },
};

const STATUSES = ["all", "pending", "processing", "succeeded", "failed", "expired", "refunded", "reversed"] as const;

const TONE: Record<string, "jade" | "mango" | "clay" | "neutral"> = {
  succeeded: "jade",
  pending: "mango",
  processing: "mango",
  failed: "clay",
  expired: "clay",
  refunded: "neutral",
  reversed: "neutral",
};

export default async function AdminPaymentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const locale = resolveLocale((await params).locale);
  const dict = await getDictionary(locale);
  const copy = dict.admin;
  await requirePlatformAdmin(locale);
  const query = await searchParams;
  const status = STATUSES.includes((query.status ?? "all") as (typeof STATUSES)[number])
    ? (query.status ?? "all")
    : "all";
  const search = (query.q ?? "").slice(0, 120);

  const [overview, payments] = await Promise.all([
    getPlatformOperationsOverview(),
    listPlatformPayments(status, search),
  ]);

  const href = (nextStatus: string) => {
    const params = new URLSearchParams();
    if (nextStatus !== "all") params.set("status", nextStatus);
    if (search) params.set("q", search);
    const qs = params.toString();
    return `/${locale}/admin/payments${qs ? `?${qs}` : ""}`;
  };

  return (
    <div className="space-y-5">
      <AdminPageHeader eyebrow={copy.payments} title={copy.paymentsTitle} lead={copy.paymentsLead} icon={CreditCard} badge={payments.length} />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <AdminStat label={copy.activeSubscriptions} value={overview.active_subscriptions} detail={`${overview.trialing_subscriptions} ${copy.trialingSubscriptions.toLowerCase()}`} tone="success" />
        <AdminStat label={copy.pastDueSubscriptions} value={overview.past_due_subscriptions} detail={copy.paymentFailuresLead} tone={overview.past_due_subscriptions ? "warning" : "neutral"} />
        <AdminStat label={copy.failedPayments} value={overview.failed_payments_30d} detail={copy.last30Days} tone={overview.failed_payments_30d ? "danger" : "neutral"} />
        <AdminStat label={copy.webhookFailures} value={overview.webhook_failures_24h} detail="24h" tone={overview.webhook_failures_24h ? "warning" : "neutral"} />
      </section>

      <div className="flex flex-wrap gap-2">
        {STATUSES.map((value) => (
          <Link key={value} href={href(value)}>
            <Badge tone={status === value ? "jade" : "outline"} className="px-3 py-1.5 text-xs">
              {value === "all" ? copy.allStatuses : value}
            </Badge>
          </Link>
        ))}
      </div>

      <form action={`/${locale}/admin/payments`} method="get" className="flex flex-wrap gap-2 rounded-2xl border border-black/8 bg-white p-3">
        {status !== "all" ? <input type="hidden" name="status" value={status} /> : null}
        <label htmlFor="payment-search" className="sr-only">
          {copy.searchPayments}
        </label>
        <Input id="payment-search" name="q" defaultValue={search} placeholder={copy.searchPayments} className="h-10 min-w-0 flex-1 basis-64" maxLength={120} />
        <Button type="submit" size="sm" variant="dark">
          <Search className="h-4 w-4" aria-hidden />
          {copy.search}
        </Button>
        {search || status !== "all" ? (
          <Link href={`/${locale}/admin/payments`} className={buttonVariants({ size: "sm", variant: "ghost" })}>
            {copy.clear}
          </Link>
        ) : null}
      </form>

      {payments.length === 0 ? (
        <AdminEmpty>{copy.noPayments}</AdminEmpty>
      ) : (
        <div className="space-y-2">
          {payments.map((payment) => (
            <article key={payment.id} className="rounded-2xl border border-black/8 bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
              <div className="flex flex-wrap items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate text-sm font-extrabold text-[#151c19]">{payment.workspace_name}</h2>
                    <Badge tone={TONE[payment.status] ?? "neutral"}>{payment.status}</Badge>
                    {payment.plan_code ? <Badge tone="outline">{payment.plan_code}</Badge> : null}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-[#151c19]/55">
                    {payment.owner_email ?? "—"} · {payment.provider} · {payment.merchant_reference}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[0.68rem] text-[#151c19]/45">
                    <span>{copy.created}: {formatDateTime(payment.created_at, intlLocale(locale))}</span>
                    <span>{copy.paidAt}: {payment.paid_at ? formatDateTime(payment.paid_at, intlLocale(locale)) : "—"}</span>
                    {payment.provider_ref ? <span>{copy.reference}: {payment.provider_ref}</span> : null}
                  </div>
                  {payment.failure_code || payment.failure_message ? (
                    <p className="mt-2 rounded-xl bg-[#fbeee9] px-3 py-2 text-xs text-[#8b2d18]">
                      {payment.failure_code ? `${payment.failure_code}: ` : ""}
                      {payment.failure_message ?? ""}
                    </p>
                  ) : null}
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-lg font-extrabold tabular-nums text-[#151c19]">
                    {formatMoney(BigInt(payment.amount_minor), payment.currency, moneyLocale(locale, payment.currency))}
                  </p>
                  {BigInt(payment.refunded_amount_minor) > 0n ? (
                    <p className="mt-1 text-[0.65rem] text-[#151c19]/45">
                      −{formatMoney(BigInt(payment.refunded_amount_minor), payment.currency, moneyLocale(locale, payment.currency))}
                    </p>
                  ) : null}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
