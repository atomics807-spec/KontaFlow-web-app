import type { Metadata } from "next";
import Link from "next/link";
import { Archive, ArrowLeftRight, Banknote, Coins, RotateCcw, Smartphone, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { NewAccountForm } from "@/components/forms/new-account-form";
import { TransactionList } from "@/components/dashboard/transaction-list";
import { listAccountBalances } from "@/services/finance";
import { listTransactions } from "@/services/transactions";
import { requireWorkspaceContext } from "@/lib/supabase/auth";
import { pickTranslation, resolveLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/server";
import { formatMoney, moneyLocale, toMinorUnits } from "@/lib/money";
import { archiveAccountAction } from "@/app/[locale]/(dashboard)/finance/actions";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const dict = await getDictionary(resolveLocale((await params).locale));
  return { title: dict.finance.accounts.title, robots: { index: false, follow: false } };
}

export default async function AccountsPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = resolveLocale((await params).locale);
  const dict = await getDictionary(locale);
  const context = await requireWorkspaceContext(locale);
  const currency = context.workspace.currency;
  const canManage = context.can("accounts:manage");

  const [accounts, transfers] = await Promise.all([
    listAccountBalances(context.workspace.id),
    listTransactions(context.workspace.id, { kind: "transfer", limit: 6 }),
  ]);

  const money = (value: bigint | number | string) =>
    formatMoney(toMinorUnits(value), currency, moneyLocale(locale, currency));
  const moneyAccounts = accounts.filter((account) =>
    ["cash", "bank", "mobile_money"].includes(account.subtype),
  );
  const active = moneyAccounts.filter((account) => !account.is_archived);
  const archived = moneyAccounts.filter((account) => account.is_archived);
  const total = active.reduce((sum, account) => sum + toMinorUnits(account.balance_minor), 0n);

  const subtypeLabel = (subtype: string) =>
    subtype === "bank"
      ? dict.finance.accounts.bank
      : subtype === "mobile_money"
        ? dict.finance.accounts.mobileMoney
        : dict.finance.accounts.cash;

  const subtypeIcon = (subtype: string) =>
    subtype === "bank" ? Banknote : subtype === "mobile_money" ? Smartphone : Wallet;

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-heading">{dict.finance.accounts.title}</h1>
          <p className="mt-1 text-sm text-muted">{dict.finance.accounts.subtitle}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/${locale}/transactions/new?kind=transfer`}
            className={buttonVariants({ variant: "secondary", size: "md" })}
          >
            <ArrowLeftRight className="h-4 w-4" aria-hidden />
            {dict.finance.accounts.transfer}
          </Link>
          {canManage ? <NewAccountForm currency={currency} /> : null}
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        <Card className="p-5">
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.1em] text-muted">
            {dict.finance.accounts.totalBalance}
          </p>
          <p className="kpi-value mt-2 text-2xl font-semibold text-heading">{money(total)}</p>
        </Card>
        <Card className="p-5">
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.1em] text-muted">
            {dict.finance.accounts.activeAccounts}
          </p>
          <p className="kpi-value mt-2 text-2xl font-semibold text-heading">{active.length}</p>
        </Card>
        <Card className="p-5">
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.1em] text-muted">
            {dict.finance.accounts.history}
          </p>
          <Link
            href={`/${locale}/transactions?kind=transfer`}
            className="mt-2 inline-flex text-sm font-semibold text-accent hover:underline"
          >
            {dict.common.viewAll}
          </Link>
        </Card>
      </section>

      {accounts.length === 0 ? (
        <Card className="p-6">
          <EmptyState icon={Coins} title={dict.finance.accounts.empty} description={dict.finance.accounts.emptyHint} />
        </Card>
      ) : (
        <div className="space-y-4">
          <ul className="grid gap-3 sm:grid-cols-2">
            {active.map((account) => {
              const Icon = subtypeIcon(account.subtype);
              const balance = toMinorUnits(account.balance_minor);
              return (
                <li key={account.account_id} className="surface p-4">
                  <div className="flex items-start gap-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
                      <Icon className="h-4 w-4" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="truncate text-sm font-bold text-heading">{account.name}</p>
                        {account.is_system ? (
                          <Badge tone="outline" className="text-[0.6rem]">
                            {dict.finance.accounts.system}
                          </Badge>
                        ) : null}
                      </div>
                      <p className="mt-0.5 text-xs text-muted">
                        {subtypeLabel(account.subtype)}
                        {account.institution ? ` · ${account.institution}` : ""}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="kpi-value text-base font-semibold text-heading">{money(balance)}</p>
                      <p className="mt-0.5 text-[0.65rem] text-muted">
                        {dict.finance.accounts.movement}: {money(toMinorUnits(account.movement_minor))}
                      </p>
                    </div>
                  </div>
                  {canManage && !account.is_system ? (
                    <form action={archiveAccountAction} className="mt-3 flex justify-end">
                      <input type="hidden" name="locale" value={locale} />
                      <input type="hidden" name="accountId" value={account.account_id} />
                      <input type="hidden" name="archived" value="true" />
                      <button
                        type="submit"
                        className="inline-flex items-center gap-1 text-xs font-semibold text-muted hover:text-danger"
                      >
                        <Archive className="h-3.5 w-3.5" aria-hidden />
                        {dict.finance.accounts.archive}
                      </button>
                    </form>
                  ) : null}
                </li>
              );
            })}
          </ul>

          {archived.length > 0 ? (
            <Card className="p-5">
              <h2 className="text-sm font-bold text-heading">{dict.finance.accounts.archived}</h2>
              <ul className="mt-3 divide-y divide-line/70">
                {archived.map((account) => (
                  <li key={account.account_id} className="flex items-center gap-3 py-2.5 text-sm">
                    <span className="min-w-0 flex-1 truncate text-muted">{account.name}</span>
                    <span className="kpi-value text-muted">{money(toMinorUnits(account.balance_minor))}</span>
                    {canManage ? (
                      <form action={archiveAccountAction}>
                        <input type="hidden" name="locale" value={locale} />
                        <input type="hidden" name="accountId" value={account.account_id} />
                        <input type="hidden" name="archived" value="false" />
                        <button
                          type="submit"
                          className="inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline"
                        >
                          <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                          {dict.finance.accounts.restore}
                        </button>
                      </form>
                    ) : null}
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </div>
      )}

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-4 sm:px-5">
          <div>
            <h2 className="text-base font-bold text-heading">{dict.finance.accounts.history}</h2>
            <p className="mt-0.5 text-sm text-muted">{dict.finance.accounts.transferHint}</p>
          </div>
          <Link href={`/${locale}/transactions?kind=transfer`} className="text-xs font-semibold text-accent hover:underline">
            {dict.common.viewAll}
          </Link>
        </div>
        <TransactionList
          showChannel={false}
          items={transfers.map((row) => ({
            id: row.id,
            kind: row.kind,
            status: row.status,
            amountMinor: String(row.amount_minor),
            currency: row.currency,
            occurredOn: row.occurred_on,
            description: row.description,
            categoryName: pickTranslation(row.category_translations, locale) ?? row.category_name,
            contactName: row.contact_name,
            channel: row.channel,
            accountName: row.account_name,
          }))}
        />
      </Card>
    </div>
  );
}
