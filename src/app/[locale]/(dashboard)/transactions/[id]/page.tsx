import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download, FileText, History, Paperclip, Pencil, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EditTransactionForm } from "@/components/forms/edit-transaction-form";
import { VoidButton } from "@/components/dashboard/void-button";
import { getTransactionDetail, getTransactionOptions } from "@/services/transactions";
import { requireWorkspaceContext } from "@/lib/supabase/auth";
import { intlLocale, pickTranslation, resolveLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/server";
import { formatMoney, moneyLocale, toMinorUnits } from "@/lib/money";
import { formatDate, formatDateTime } from "@/lib/dates";

export async function generateMetadata({ params }: { params: Promise<{ locale: string; id: string }> }): Promise<Metadata> {
  const dict = await getDictionary(resolveLocale((await params).locale));
  return { title: dict.transactions.title, robots: { index: false, follow: false } };
}

export default async function TransactionDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale: rawLocale, id } = await params;
  const locale = resolveLocale(rawLocale);
  const dict = await getDictionary(locale);
  const context = await requireWorkspaceContext(locale);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const detail = await getTransactionDetail(context.workspace.id, id);
  if (!detail) notFound();

  const transaction = detail.transaction;
  const options = await getTransactionOptions(context.workspace.id);
  const currency = transaction.currency;
  const money = (value: bigint) => formatMoney(value, currency, moneyLocale(locale, currency));
  const canAmend = context.can("transactions:create") && context.can("transactions:void") && transaction.status === "posted";
  const canVoid = context.can("transactions:void") && transaction.status === "posted";

  return (
    <div className="space-y-5">
      <Link href={`/${locale}/transactions`} className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-heading">
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
        {dict.transactions.title}
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-2xl font-extrabold tracking-tight text-heading">{transaction.description}</h1>
            <Badge tone={transaction.status === "voided" ? "clay" : "jade"}>{transaction.status}</Badge>
            <Badge tone="outline">{dict.transactions[transaction.kind]}</Badge>
          </div>
          <p className="mt-1 text-sm text-muted">
            {formatDate(transaction.occurred_on, intlLocale(locale), context.workspace.timezone)} · {transaction.account_name}
            {transaction.category_name ? ` · ${pickTranslation(transaction.category_translations, locale) ?? transaction.category_name}` : ""}
          </p>
        </div>
        <p className={`text-2xl font-extrabold tabular-nums ${transaction.kind === "income" ? "text-accent" : "text-danger"}`}>
          {transaction.kind === "income" ? "+" : "−"}
          {money(toMinorUnits(transaction.amount_minor))}
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <Card className="p-5 sm:p-6">
          <h2 className="flex items-center gap-2 text-base font-bold text-heading">
            <FileText className="h-4 w-4 text-accent" aria-hidden />
            {dict.transactions.detailsTitle}
          </h2>
          <dl className="mt-4 grid gap-3 sm:grid-cols-2">
            {[
              [dict.transactions.dateLabel, formatDate(transaction.occurred_on, intlLocale(locale), context.workspace.timezone)],
              [dict.transactions.paymentMethod, transaction.payment_method.replace(/_/g, " ")],
              [dict.transactions.accountLabel, transaction.account_name],
              [dict.transactions.contactLabel, transaction.contact_name ?? "—"],
              [dict.transactions.reference, transaction.reference ?? "—"],
              [dict.transactions.source, transaction.channel],
              [dict.transactions.recordedAt, formatDateTime(transaction.recorded_at, intlLocale(locale), transaction.recorded_timezone)],
              [dict.transactions.syncedAt, transaction.sync_received_at ? formatDateTime(transaction.sync_received_at, intlLocale(locale)) : "—"],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-[0.62rem] font-bold uppercase tracking-[0.12em] text-muted">{label}</dt>
                <dd className="mt-0.5 text-sm font-semibold capitalize text-heading">{value}</dd>
              </div>
            ))}
          </dl>

          {transaction.status === "voided" ? (
            <div className="mt-4 rounded-xl bg-danger-soft px-3.5 py-3 text-sm text-danger">
              <p className="font-bold">{dict.transactions.voided}</p>
              <p className="mt-0.5">{transaction.void_reason ?? "—"}</p>
              {transaction.voided_at ? <p className="mt-1 text-xs opacity-75">{formatDateTime(transaction.voided_at, intlLocale(locale))}</p> : null}
            </div>
          ) : null}

          {detail.attachments.length > 0 ? (
            <div className="mt-4 space-y-2">
              <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.12em] text-muted">
                <Paperclip className="h-3.5 w-3.5" aria-hidden />
                {dict.transactions.receipt}
              </h3>
              {detail.attachments.map((attachment) => (
                <a
                  key={attachment.id}
                  href={`/api/receipts/${transaction.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 rounded-xl border border-line bg-panel px-3 py-2 text-sm font-semibold text-heading hover:border-accent-line"
                >
                  <Download className="h-4 w-4 text-accent" aria-hidden />
                  <span className="min-w-0 flex-1 truncate">{attachment.file_name}</span>
                  <span className="text-[0.65rem] font-normal text-muted">{Math.max(1, Math.round(attachment.size_bytes / 1024))} KB</span>
                </a>
              ))}
            </div>
          ) : null}
        </Card>

        <div className="space-y-4">
          {canVoid ? (
            <Card className="p-5">
              <h2 className="text-sm font-bold text-heading">{dict.transactions.void}</h2>
              <p className="mt-1 text-xs text-muted">{dict.transactions.voidConfirm}</p>
              <div className="mt-3">
                <VoidButton transactionId={transaction.id} />
              </div>
            </Card>
          ) : null}

          <Card className="p-5">
            <h2 className="flex items-center gap-2 text-sm font-bold text-heading">
              <History className="h-4 w-4 text-accent" aria-hidden />
              {dict.transactions.auditHistory}
            </h2>
            {detail.audit.length === 0 ? (
              <p className="mt-3 text-xs text-muted">—</p>
            ) : (
              <ol className="mt-3 space-y-2.5">
                {detail.audit.map((entry) => (
                  <li key={entry.id} className="border-l-2 border-line pl-3">
                    <p className="text-xs font-bold text-heading">{entry.action}</p>
                    <p className="mt-0.5 text-[0.65rem] text-muted">
                      {entry.actor_name ?? entry.actor_type} · {formatDateTime(entry.created_at, intlLocale(locale))}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>
      </div>

      {canAmend ? (
        <Card className="p-5 sm:p-6">
          <div className="flex items-start gap-2.5">
            <ShieldCheck className="mt-0.5 h-4 w-4 text-accent" aria-hidden />
            <div>
              <h2 className="flex items-center gap-2 text-base font-bold text-heading">
                <Pencil className="h-4 w-4" aria-hidden />
                {dict.transactions.editTitle}
              </h2>
              <p className="mt-0.5 text-sm text-muted">{dict.transactions.editHint}</p>
            </div>
          </div>
          <div className="mt-4">
            <EditTransactionForm
              transaction={transaction}
              currency={currency}
              accounts={options.accounts.map((account) => ({ id: account.id, name: account.name, subtype: account.subtype }))}
              categories={options.categories.map((category) => ({
                id: category.id,
                name: category.name,
                kind: category.kind,
                translations: category.translations,
              }))}
              contacts={options.contacts.map((contact) => ({ id: contact.id, name: contact.name }))}
            />
          </div>
        </Card>
      ) : null}
    </div>
  );
}
