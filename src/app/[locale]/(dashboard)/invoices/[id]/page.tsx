import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Ban, CircleCheck, FileText, HandCoins } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableWrap, Td, Th } from "@/components/ui/table";
import { buttonVariants } from "@/components/ui/button";
import { issueInvoiceAction, voidInvoiceAction } from "@/app/[locale]/(dashboard)/finance/actions";
import { getInvoice, hasFeature } from "@/services/finance";
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

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale: rawLocale, id } = await params;
  const locale = resolveLocale(rawLocale);
  const dict = await getDictionary(locale);
  const context = await requireWorkspaceContext(locale);

  if (!(await hasFeature(context.workspace.id, "invoicing"))) redirect(`/${locale}/invoices`);

  const result = await getInvoice(context.workspace.id, id);
  if (!result) notFound();
  const { invoice, items } = result;
  const currency = invoice.currency;
  const timezone = context.workspace.timezone;
  const canManage = context.can("invoices:manage");
  const money = (value: bigint | number | string) =>
    formatMoney(toMinorUnits(value), currency, moneyLocale(locale, currency));

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

  const badgeTone =
    invoice.status === "paid"
      ? "jade"
      : invoice.status === "void"
        ? "outline"
        : invoice.is_overdue
          ? "clay"
          : invoice.status === "partially_paid"
            ? "mango"
            : "neutral";

  const canVoid =
    canManage &&
    invoice.status !== "void" &&
    invoice.status !== "paid" &&
    toMinorUnits(invoice.amount_paid_minor) === 0n;
  const canIssue = canManage && invoice.status === "draft";

  return (
    <div className="space-y-5">
      <header>
        <Link href={`/${locale}/invoices`} className="inline-flex items-center gap-1 text-xs font-semibold text-muted hover:text-heading">
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          {dict.finance.invoices.backToList}
        </Link>
        <div className="mt-1 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-extrabold tracking-tight text-heading">{invoice.number}</h1>
              <Badge tone={badgeTone}>{invoice.is_overdue ? dict.finance.invoices.overdue : statusLabel(invoice.status)}</Badge>
            </div>
            <p className="mt-1 text-sm text-muted">
              {invoice.customer_name} · {dict.finance.invoices.issueDate}:{" "}
              {formatDate(invoice.issue_on, intlLocale(locale), timezone)} · {dict.finance.invoices.dueDate}:{" "}
              {formatDate(invoice.due_on, intlLocale(locale), timezone)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {canIssue ? (
              <form action={issueInvoiceAction}>
                <input type="hidden" name="locale" value={locale} />
                <input type="hidden" name="invoiceId" value={invoice.id} />
                <button type="submit" className={buttonVariants({ size: "md" })}>
                  <CircleCheck className="h-4 w-4" aria-hidden />
                  {dict.finance.invoices.issue}
                </button>
              </form>
            ) : null}
            {invoice.linked_debt_id ? (
              <Link
                href={`/${locale}/debts?direction=receivable&q=${encodeURIComponent(invoice.number)}`}
                className={buttonVariants({ variant: "secondary", size: "md" })}
              >
                <HandCoins className="h-4 w-4" aria-hidden />
                {dict.finance.debts.recordPayment}
              </Link>
            ) : null}
            {canVoid ? (
              <form action={voidInvoiceAction}>
                <input type="hidden" name="locale" value={locale} />
                <input type="hidden" name="invoiceId" value={invoice.id} />
                <button type="submit" className={buttonVariants({ variant: "ghost", size: "md" })}>
                  <Ban className="h-4 w-4" aria-hidden />
                  {dict.finance.invoices.voided}
                </button>
              </form>
            ) : null}
          </div>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        <Card className="p-5">
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.1em] text-muted">{dict.finance.invoices.total}</p>
          <p className="kpi-value mt-2 text-2xl font-semibold text-heading">{money(invoice.total_minor)}</p>
        </Card>
        <Card className="p-5">
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.1em] text-muted">{dict.finance.invoices.paid}</p>
          <p className="kpi-value mt-2 text-2xl font-semibold text-accent">{money(invoice.amount_paid_minor)}</p>
        </Card>
        <Card className="p-5">
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.1em] text-muted">{dict.finance.invoices.remaining}</p>
          <p className="kpi-value mt-2 text-2xl font-semibold text-heading">{money(invoice.remaining_minor)}</p>
        </Card>
      </section>

      <Card className="overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-4 sm:px-5">
          <FileText className="h-4 w-4 text-accent" aria-hidden />
          <h2 className="text-base font-bold text-heading">{dict.finance.invoices.items}</h2>
        </div>
        <TableWrap>
          <Table>
            <thead>
              <tr>
                <Th scope="col">{dict.finance.invoices.itemDescription}</Th>
                <Th scope="col" className="text-right">
                  {dict.finance.invoices.quantity}
                </Th>
                <Th scope="col" className="text-right">
                  {dict.finance.invoices.unitPrice}
                </Th>
                <Th scope="col" className="text-right">
                  {dict.finance.invoices.taxRate}
                </Th>
                <Th scope="col" className="text-right">
                  {dict.finance.invoices.lineTotal}
                </Th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <Td className="text-sm text-heading">{item.description}</Td>
                  <Td className="kpi-value text-right text-sm text-muted">{item.quantity}</Td>
                  <Td className="kpi-value text-right text-sm text-muted">{money(item.unit_price_minor)}</Td>
                  <Td className="kpi-value text-right text-sm text-muted">{(item.tax_rate_bp / 100).toFixed(2)}%</Td>
                  <Td className="kpi-value text-right text-sm font-semibold text-heading">{money(item.line_total_minor)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </TableWrap>
        <dl className="ml-auto max-w-sm space-y-1.5 border-t border-line px-4 py-4 text-sm sm:px-5">
          <div className="flex justify-between gap-3">
            <dt className="text-muted">{dict.finance.invoices.subtotal}</dt>
            <dd className="kpi-value font-semibold text-heading">{money(invoice.subtotal_minor)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted">{dict.finance.invoices.tax}</dt>
            <dd className="kpi-value font-semibold text-heading">{money(invoice.tax_minor)}</dd>
          </div>
          <div className="flex justify-between gap-3 border-t border-line pt-1.5">
            <dt className="font-bold text-heading">{dict.finance.invoices.total}</dt>
            <dd className="kpi-value text-base font-bold text-heading">{money(invoice.total_minor)}</dd>
          </div>
        </dl>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2">
        {invoice.notes ? (
          <Card className="p-5">
            <h2 className="text-sm font-bold text-heading">{dict.finance.invoices.notes}</h2>
            <p className="mt-2 whitespace-pre-wrap text-sm text-muted">{invoice.notes}</p>
          </Card>
        ) : null}
        {invoice.terms ? (
          <Card className="p-5">
            <h2 className="text-sm font-bold text-heading">{dict.finance.invoices.terms}</h2>
            <p className="mt-2 whitespace-pre-wrap text-sm text-muted">{invoice.terms}</p>
          </Card>
        ) : null}
        <Card className="p-5 sm:col-span-2">
          <h2 className="text-sm font-bold text-heading">{dict.finance.invoices.paymentDetails}</h2>
          <p className="mt-2 text-sm text-muted">{dict.finance.invoices.recordedViaDebt}</p>
          {invoice.linked_debt_id ? (
            <Link
              href={`/${locale}/debts?direction=receivable&q=${encodeURIComponent(invoice.number)}`}
              className="mt-3 inline-flex text-sm font-semibold text-accent hover:underline"
            >
              {dict.finance.debts.repaymentHistory}
            </Link>
          ) : null}
        </Card>
      </div>
    </div>
  );
}
