import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, ArrowDownLeft, ArrowUpRight, HandCoins, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { NewDebtForm } from "@/components/forms/new-debt-form";
import { DebtPaymentForm } from "@/components/forms/debt-payment-form";
import { listDebtPayments, listDebts, listFinanceContacts, listMoneyAccounts } from "@/services/finance";
import { requireWorkspaceContext } from "@/lib/supabase/auth";
import { intlLocale, resolveLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/server";
import { formatMoney, moneyLocale, toMinorUnits } from "@/lib/money";
import { formatDate, todayInZone } from "@/lib/dates";
import type { DebtDirection, DebtStatus } from "@/types/database";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const dict = await getDictionary(resolveLocale((await params).locale));
  return { title: dict.finance.debts.title, robots: { index: false, follow: false } };
}

const STATUSES: (DebtStatus | "all")[] = ["all", "open", "partially_paid", "settled", "written_off"];
const DIRECTIONS: (DebtDirection | "all")[] = ["all", "receivable", "payable"];

export default async function DebtsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ direction?: string; status?: string; q?: string }>;
}) {
  const locale = resolveLocale((await params).locale);
  const dict = await getDictionary(locale);
  const context = await requireWorkspaceContext(locale);
  const query = await searchParams;
  const currency = context.workspace.currency;
  const timezone = context.workspace.timezone;
  const today = todayInZone(timezone);
  const canManage = context.can("debts:manage");

  const direction: DebtDirection | "all" = DIRECTIONS.includes((query.direction ?? "all") as DebtDirection | "all")
    ? ((query.direction ?? "all") as DebtDirection | "all")
    : "all";
  const status: DebtStatus | "all" = STATUSES.includes((query.status ?? "all") as DebtStatus | "all")
    ? ((query.status ?? "all") as DebtStatus | "all")
    : "all";
  const search = (query.q ?? "").slice(0, 80);

  const [debts, contacts, accounts] = await Promise.all([
    listDebts(context.workspace.id, { direction, status, search }),
    listFinanceContacts(context.workspace.id),
    listMoneyAccounts(context.workspace.id),
  ]);
  const payments = await listDebtPayments(
    context.workspace.id,
    debts.map((debt) => debt.id),
  );

  const money = (value: bigint | number | string) =>
    formatMoney(toMinorUnits(value), currency, moneyLocale(locale, currency));
  const openDebts = debts.filter((debt) => debt.status === "open" || debt.status === "partially_paid");
  const totalReceivable = openDebts
    .filter((debt) => debt.direction === "receivable")
    .reduce((sum, debt) => sum + toMinorUnits(debt.remaining_minor), 0n);
  const totalPayable = openDebts
    .filter((debt) => debt.direction === "payable")
    .reduce((sum, debt) => sum + toMinorUnits(debt.remaining_minor), 0n);

  const statusLabel = (value: DebtStatus) =>
    value === "open"
      ? dict.finance.debts.open
      : value === "partially_paid"
        ? dict.finance.debts.partiallyPaid
        : value === "settled"
          ? dict.finance.debts.settled
          : dict.finance.debts.writtenOff;

  const paymentsFor = (debtId: string) => payments.filter((payment) => payment.debt_id === debtId);

  const filterHref = (nextDirection: DebtDirection | "all", nextStatus: DebtStatus | "all") => {
    const next = new URLSearchParams();
    if (nextDirection !== "all") next.set("direction", nextDirection);
    if (nextStatus !== "all") next.set("status", nextStatus);
    if (search) next.set("q", search);
    const qs = next.toString();
    return `/${locale}/debts${qs ? `?${qs}` : ""}`;
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-heading">{dict.finance.debts.title}</h1>
          <p className="mt-1 text-sm text-muted">{dict.finance.debts.subtitle}</p>
        </div>
        {canManage ? <NewDebtForm contacts={contacts} today={today} currency={currency} /> : null}
      </header>

      <section className="grid gap-3 sm:grid-cols-2">
        <Card className="p-5">
          <div className="flex items-center gap-2 text-accent">
            <ArrowDownLeft className="h-4 w-4" aria-hidden />
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.1em]">{dict.finance.debts.totalReceivable}</p>
          </div>
          <p className="kpi-value mt-2 text-2xl font-semibold text-heading">{money(totalReceivable)}</p>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-2 text-danger">
            <ArrowUpRight className="h-4 w-4" aria-hidden />
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.1em]">{dict.finance.debts.totalPayable}</p>
          </div>
          <p className="kpi-value mt-2 text-2xl font-semibold text-heading">{money(totalPayable)}</p>
        </Card>
      </section>

      <nav aria-label={dict.finance.debts.direction} className="flex flex-wrap gap-2">
        {DIRECTIONS.map((value) => (
          <Link
            key={value}
            href={filterHref(value, status)}
            aria-current={direction === value ? "page" : undefined}
            className={
              direction === value
                ? "rounded-full bg-forest px-3.5 py-1.5 text-xs font-bold text-white"
                : "rounded-full border border-line bg-panel px-3.5 py-1.5 text-xs font-semibold text-muted hover:border-accent-line hover:text-heading"
            }
          >
            {value === "all" ? dict.finance.debts.filterAll : value === "receivable" ? dict.finance.debts.receivable : dict.finance.debts.payable}
          </Link>
        ))}
      </nav>

      <Card className="p-4">
        <form method="get" className="flex flex-col gap-2 sm:flex-row sm:items-end">
          {direction !== "all" ? <input type="hidden" name="direction" value={direction} /> : null}
          <div className="min-w-0 flex-1">
            <label htmlFor="q" className="sr-only">
              {dict.common.search}
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
              <Input id="q" name="q" defaultValue={search} placeholder={dict.common.search} className="pl-9" maxLength={80} />
            </div>
          </div>
          <div>
            <label htmlFor="status" className="mb-1 block text-xs font-semibold text-muted">
              {dict.finance.debts.status}
            </label>
            <Select id="status" name="status" defaultValue={status}>
              {STATUSES.map((value) => (
                <option key={value} value={value}>
                  {value === "all" ? dict.common.all : statusLabel(value)}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex gap-2">
            <Button type="submit" variant="dark">
              {dict.common.filter}
            </Button>
            <Link href={`/${locale}/debts`} className={buttonVariants({ variant: "ghost", className: "h-11" })}>
              {dict.common.cancel}
            </Link>
          </div>
        </form>
      </Card>

      {debts.length === 0 ? (
        <Card className="p-6">
          <EmptyState icon={HandCoins} title={dict.finance.debts.empty} description={dict.finance.debts.emptyHint} />
        </Card>
      ) : (
        <ul className="space-y-3">
          {debts.map((debt) => {
            const principal = toMinorUnits(debt.principal_minor);
            const paid = toMinorUnits(debt.paid_minor);
            const remaining = toMinorUnits(debt.remaining_minor);
            const percent = principal > 0n ? Math.min(100, Number((paid * 100n) / principal)) : 0;
            const history = paymentsFor(debt.id);
            const isReceivable = debt.direction === "receivable";

            return (
              <li key={debt.id} className="surface p-4 sm:p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={
                          isReceivable
                            ? "grid h-8 w-8 place-items-center rounded-lg bg-accent-soft text-accent"
                            : "grid h-8 w-8 place-items-center rounded-lg bg-warn-soft text-warn"
                        }
                      >
                        {isReceivable ? (
                          <ArrowDownLeft className="h-3.5 w-3.5" aria-hidden />
                        ) : (
                          <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
                        )}
                      </span>
                      <p className="truncate text-sm font-bold text-heading">{debt.contact_name}</p>
                      <Badge tone={isReceivable ? "jade" : "mango"} className="text-[0.6rem]">
                        {isReceivable ? dict.finance.debts.receivable : dict.finance.debts.payable}
                      </Badge>
                      <Badge
                        tone={debt.status === "settled" ? "jade" : debt.is_overdue ? "clay" : "outline"}
                        className="text-[0.6rem]"
                      >
                        {debt.is_overdue ? dict.finance.debts.overdue : statusLabel(debt.status)}
                      </Badge>
                    </div>
                    <p className="mt-2 text-sm text-heading">{debt.description}</p>
                    <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted">
                      <span>
                        {dict.finance.debts.openedOn}: {formatDate(debt.opened_on, intlLocale(locale), timezone)}
                      </span>
                      {debt.due_on ? (
                        <span>
                          · {dict.finance.debts.dueOn}: {formatDate(debt.due_on, intlLocale(locale), timezone)}
                        </span>
                      ) : null}
                      {debt.invoice_number ? (
                        <span>
                          · {dict.finance.debts.invoiceRef}:{" "}
                          <Link href={`/${locale}/invoices/${debt.invoice_id}`} className="font-semibold text-accent hover:underline">
                            {debt.invoice_number}
                          </Link>
                        </span>
                      ) : null}
                    </p>
                  </div>

                  <div className="shrink-0 text-left sm:text-right">
                    <p className="text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-muted">
                      {dict.finance.debts.remaining}
                    </p>
                    <p className="kpi-value text-lg font-semibold text-heading">{money(remaining)}</p>
                    <p className="mt-0.5 text-[0.65rem] text-muted">
                      {dict.finance.debts.principal}: {money(principal)} · {dict.finance.debts.paid}: {money(paid)}
                    </p>
                  </div>
                </div>

                <div className="mt-3 h-2 overflow-hidden rounded-full bg-page-soft">
                  <div className="h-full rounded-full bg-accent" style={{ width: `${Math.max(percent, 2)}%` }} />
                </div>

                {canManage ? (
                  <div className="mt-3">
                    <DebtPaymentForm
                      debtId={debt.id}
                      remainingMinor={String(debt.remaining_minor)}
                      currency={debt.currency}
                      today={today}
                      accounts={accounts.map((account) => ({ id: account.id, name: account.name }))}
                    />
                  </div>
                ) : null}

                <div className="mt-3 rounded-xl bg-page-soft/60 px-3 py-2.5">
                  <p className="text-[0.65rem] font-bold uppercase tracking-[0.1em] text-muted">
                    {dict.finance.debts.repaymentHistory}
                  </p>
                  {history.length === 0 ? (
                    <p className="mt-1.5 text-xs text-muted">{dict.finance.debts.noRepayments}</p>
                  ) : (
                    <ul className="mt-1.5 divide-y divide-line/60">
                      {history.map((payment) => (
                        <li key={payment.id} className="flex items-center gap-2 py-1.5 text-xs">
                          <span className="min-w-0 flex-1 truncate text-muted">
                            {formatDate(payment.paid_on, intlLocale(locale), timezone)}
                            {payment.reference ? ` · ${payment.reference}` : ""}
                            {payment.voided_at ? ` · ${dict.transactions.voided}` : ""}
                          </span>
                          <span className="kpi-value font-semibold text-heading">{money(toMinorUnits(payment.amount_minor))}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {openDebts.some((debt) => debt.is_overdue) ? (
        <div className="flex items-start gap-2 rounded-xl border border-danger/25 bg-danger-soft px-4 py-3 text-sm text-danger">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p>
            {dict.finance.debts.overdue}: {openDebts.filter((debt) => debt.is_overdue).length}
          </p>
        </div>
      ) : null}
    </div>
  );
}
