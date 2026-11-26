import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, FileText, LockKeyhole, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { hasFeature, listInvoices } from "@/services/finance";
import { requireWorkspaceContext } from "@/lib/supabase/auth";
import { intlLocale, resolveLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/server";
import { formatMoney, moneyLocale, toMinorUnits } from "@/lib/money";
import { formatDate } from "@/lib/dates";
import type { InvoiceStatus } from "@/types/database";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const dict = await getDictionary(resolveLocale((await params).locale));
  return { title: dict.finance.invoices.title, robots: { index: false, follow: false } };
}

export default async function InvoicesPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = resolveLocale((await params).locale);
  const dict = await getDictionary(locale);
  const context = await requireWorkspaceContext(locale);
  const currency = context.workspace.currency;
  const timezone = context.workspace.timezone;
  const canManage = context.can("invoices:manage");
  const enabled = await hasFeature(context.workspace.id, "invoicing");

  if (!enabled) {
    return (
      <div className="space-y-5">
        <header>
          <h1 className="text-2xl font-extrabold tracking-tight text-heading">{dict.finance.invoices.title}</h1>
          <p className="mt-1 text-sm text-muted">{dict.finance.invoices.subtitle}</p>
        </header>
        <Card className="relative overflow-hidden p-6 sm:p-8">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_85%_0%,rgba(242,182,75,0.18),transparent_50%)]"
          />
          <div className="relative max-w-xl">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-accent-soft text-accent">
              <LockKeyhole className="h-5 w-5" aria-hidden />
            </span>
            <h2 className="mt-4 text-xl font-extrabold text-heading">{dict.finance.invoices.planRequired}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">{dict.finance.invoices.planRequiredHint}</p>
            <Link href={`/${locale}/billing`} className={buttonVariants({ size: "md", className: "mt-5" })}>
              {dict.nav.billing}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  const invoices = await listInvoices(context.workspace.id);
  const money = (value: bigint | number | string) =>
    formatMoney(toMinorUnits(value), currency, moneyLocale(locale, currency));

  const outstanding = invoices
    .filter((invoice) => ["sent", "partially_paid", "overdue"].includes(invoice.status))
    .reduce((sum, invoice) => sum + toMinorUnits(invoice.remaining_minor), 0n);
  const overdue = invoices
    .filter((invoice) => invoice.is_overdue)
    .reduce((sum, invoice) => sum + toMinorUnits(invoice.remaining_minor), 0n);
  const paid = invoices
    .filter((invoice) => invoice.status !== "void")
    .reduce((sum, invoice) => sum + toMinorUnits(invoice.amount_paid_minor), 0n);

  const statusLabel = (status: InvoiceStatus) =>
    status === "draft"
      ? dict.finance.invoices.draft
      : status === "sent"
        ? dict.finance.invoices.sent
        : status === "partially_paid"
          ? dict.finance.invoices.partiallyPaid
          : status === "paid"
            ? dict.finance.invoices.paidStatus
            : status === "overdue"
              ? dict.finance.invoices.overdue
              : dict.finance.invoices.voided;

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-heading">{dict.finance.invoices.title}</h1>
          <p className="mt-1 text-sm text-muted">{dict.finance.invoices.subtitle}</p>
        </div>
        {canManage ? (
          <Link href={`/${locale}/invoices/new`} className={buttonVariants({ size: "md" })}>
            <Plus className="h-4 w-4" aria-hidden />
            {dict.finance.invoices.new}
          </Link>
        ) : null}
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        <Card className="p-5">
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.1em] text-muted">
            {dict.finance.debts.outstanding}
          </p>
          <p className="kpi-value mt-2 text-2xl font-semibold text-heading">{money(outstanding)}</p>
        </Card>
        <Card className="p-5">
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.1em] text-muted">
            {dict.finance.invoices.overdue}
          </p>
          <p className="kpi-value mt-2 text-2xl font-semibold text-danger">{money(overdue)}</p>
        </Card>
        <Card className="p-5">
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.1em] text-muted">
            {dict.finance.invoices.paidStatus}
          </p>
          <p className="kpi-value mt-2 text-2xl font-semibold text-accent">{money(paid)}</p>
        </Card>
      </section>

      {invoices.length === 0 ? (
        <Card className="p-6">
          <EmptyState icon={FileText} title={dict.finance.invoices.empty} description={dict.finance.invoices.emptyHint} />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-line/70">
            {invoices.map((invoice) => (
              <li key={invoice.id}>
                <Link
                  href={`/${locale}/invoices/${invoice.id}`}
                  className="flex items-center gap-3 px-4 py-3.5 transition hover:bg-page/60 sm:px-5"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
                    <FileText className="h-4 w-4" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="truncate text-sm font-bold text-heading">{invoice.number}</p>
                      <Badge
                        tone={
                          invoice.status === "paid"
                            ? "jade"
                            : invoice.status === "void"
                              ? "outline"
                              : invoice.is_overdue
                                ? "clay"
                                : invoice.status === "partially_paid"
                                  ? "mango"
                                  : "neutral"
                        }
                        className="text-[0.6rem]"
                      >
                        {invoice.is_overdue ? dict.finance.invoices.overdue : statusLabel(invoice.status)}
                      </Badge>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted">
                      {invoice.customer_name} · {dict.finance.invoices.dueDate}:{" "}
                      {formatDate(invoice.due_on, intlLocale(locale), timezone)}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="kpi-value text-sm font-semibold text-heading">{money(invoice.total_minor)}</p>
                    {invoice.status !== "draft" && invoice.status !== "void" ? (
                      <p className="mt-0.5 text-[0.65rem] text-muted">
                        {dict.finance.invoices.remaining}: {money(invoice.remaining_minor)}
                      </p>
                    ) : null}
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
