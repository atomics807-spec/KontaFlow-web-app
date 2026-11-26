"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { FileText, Loader2, Plus, Trash2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { useI18n } from "@/components/layout/i18n-provider";
import { initialFormState } from "@/lib/action-utils";
import { createInvoiceAction } from "@/app/[locale]/(dashboard)/finance/actions";
import { formatMoney, moneyLocale, parseMoneyToMinor } from "@/lib/money";
import { invoiceLineTotal, invoiceTaxMinor } from "@/lib/finance/calculations";
import type { ContactRow } from "@/types/database";

type Row = {
  key: number;
  description: string;
  quantity: string;
  unitPrice: string;
  taxRateBp: number;
};

const TAX_RATES = [0, 500, 1000, 1925];

function lineTotal(quantity: string, unitPrice: string, currency: string): bigint {
  let unit: bigint;
  try {
    unit = parseMoneyToMinor(unitPrice, currency);
  } catch {
    return 0n;
  }
  return invoiceLineTotal(quantity, unit);
}

function taxFor(total: bigint, basisPoints: number): bigint {
  return invoiceTaxMinor(total, basisPoints);
}

export function InvoiceForm({
  customers,
  today,
  defaultDue,
  currency,
}: {
  customers: ContactRow[];
  today: string;
  defaultDue: string;
  currency: string;
}) {
  const { locale, dict } = useI18n();
  const [state, action, pending] = useActionState(createInvoiceAction, initialFormState);
  const [rows, setRows] = useState<Row[]>([
    { key: 1, description: "", quantity: "1", unitPrice: "", taxRateBp: 0 },
  ]);
  const [nextKey, setNextKey] = useState(2);

  const addRow = () => {
    setRows((current) => [...current, { key: nextKey, description: "", quantity: "1", unitPrice: "", taxRateBp: 0 }]);
    setNextKey((value) => value + 1);
  };

  const updateRow = (key: number, patch: Partial<Row>) => {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  };

  const totals = rows.reduce(
    (sum, row) => {
      const line = lineTotal(row.quantity, row.unitPrice, currency);
      return {
        subtotal: sum.subtotal + line,
        tax: sum.tax + taxFor(line, row.taxRateBp),
      };
    },
    { subtotal: 0n, tax: 0n },
  );
  const total = totals.subtotal + totals.tax;
  const money = (value: bigint) => formatMoney(value, currency, moneyLocale(locale, currency));

  const itemsJson = JSON.stringify(
    rows.map((row) => ({
      description: row.description.trim(),
      quantity: row.quantity.trim(),
      unitPrice: row.unitPrice.trim(),
      taxRateBp: row.taxRateBp,
    })),
  );

  return (
    <form action={action} className="space-y-5" noValidate>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="items" value={itemsJson} />

      {state.status === "error" && state.message ? <Alert tone="error">{state.message}</Alert> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={dict.finance.invoices.customer} htmlFor="invoice-customer" error={state.fieldErrors?.customerId?.[0]}>
          <Select id="invoice-customer" name="customerId" required defaultValue="">
            <option value="" disabled>
              {dict.finance.invoices.selectCustomer}
            </option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={dict.finance.invoices.issueDate} htmlFor="invoice-issue">
          <Input id="invoice-issue" name="issueOn" type="date" required defaultValue={today} max={today} />
        </Field>
        <Field label={dict.finance.invoices.dueDate} htmlFor="invoice-due" error={state.fieldErrors?.dueOn?.[0]}>
          <Input id="invoice-due" name="dueOn" type="date" required defaultValue={defaultDue} min={today} />
        </Field>
      </div>

      <fieldset>
        <legend className="mb-2 text-[0.8rem] font-semibold uppercase tracking-[0.08em] text-muted">
          {dict.finance.invoices.items}
        </legend>

        <div className="space-y-3">
          {rows.map((row, index) => {
            const line = lineTotal(row.quantity, row.unitPrice, currency);
            return (
              <div key={row.key} className="rounded-xl border border-line bg-page-soft/40 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-bold text-muted">
                    {dict.finance.invoices.items} {index + 1}
                  </p>
                  <button
                    type="button"
                    onClick={() => setRows((current) => current.filter((entry) => entry.key !== row.key))}
                    disabled={rows.length === 1}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-muted hover:text-danger disabled:opacity-40"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    {dict.finance.invoices.removeItem}
                  </button>
                </div>

                <div className="mt-2 grid gap-2.5 sm:grid-cols-[1.7fr_0.7fr_0.9fr_0.8fr]">
                  <Field label={dict.finance.invoices.itemDescription} htmlFor={`invoice-desc-${row.key}`}>
                    <Input
                      id={`invoice-desc-${row.key}`}
                      value={row.description}
                      onChange={(event) => updateRow(row.key, { description: event.target.value })}
                      maxLength={300}
                      required
                      autoComplete="off"
                    />
                  </Field>
                  <Field label={dict.finance.invoices.quantity} htmlFor={`invoice-qty-${row.key}`}>
                    <Input
                      id={`invoice-qty-${row.key}`}
                      value={row.quantity}
                      onChange={(event) => updateRow(row.key, { quantity: event.target.value })}
                      inputMode="decimal"
                      required
                      autoComplete="off"
                    />
                  </Field>
                  <Field label={dict.finance.invoices.unitPrice} htmlFor={`invoice-price-${row.key}`} hint={currency}>
                    <Input
                      id={`invoice-price-${row.key}`}
                      value={row.unitPrice}
                      onChange={(event) => updateRow(row.key, { unitPrice: event.target.value })}
                      inputMode="decimal"
                      required
                      autoComplete="off"
                      placeholder="0"
                    />
                  </Field>
                  <Field label={dict.finance.invoices.taxRate} htmlFor={`invoice-tax-${row.key}`}>
                    <Select
                      id={`invoice-tax-${row.key}`}
                      value={row.taxRateBp}
                      onChange={(event) => updateRow(row.key, { taxRateBp: Number(event.target.value) })}
                    >
                      {TAX_RATES.map((rate) => (
                        <option key={rate} value={rate}>
                          {(rate / 100).toFixed(rate === 1925 ? 2 : 0)}%
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>
                <p className="mt-1.5 text-right text-xs text-muted">
                  {dict.finance.invoices.lineTotal}: <span className="kpi-value font-semibold text-heading">{money(line)}</span>
                </p>
              </div>
            );
          })}
        </div>

        <Button type="button" variant="secondary" size="sm" className="mt-3" onClick={addRow}>
          <Plus className="h-3.5 w-3.5" aria-hidden />
          {dict.finance.invoices.addItem}
        </Button>
      </fieldset>

      <div className="rounded-xl bg-page-soft px-4 py-3">
        <dl className="ml-auto max-w-xs space-y-1.5 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-muted">{dict.finance.invoices.subtotal}</dt>
            <dd className="kpi-value font-semibold text-heading">{money(totals.subtotal)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted">{dict.finance.invoices.tax}</dt>
            <dd className="kpi-value font-semibold text-heading">{money(totals.tax)}</dd>
          </div>
          <div className="flex justify-between gap-3 border-t border-line pt-1.5">
            <dt className="font-bold text-heading">{dict.finance.invoices.total}</dt>
            <dd className="kpi-value text-base font-bold text-heading">{money(total)}</dd>
          </div>
        </dl>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={dict.finance.invoices.notes} htmlFor="invoice-notes">
          <Textarea id="invoice-notes" name="notes" rows={2} maxLength={2000} />
        </Field>
        <Field label={dict.finance.invoices.terms} htmlFor="invoice-terms">
          <Textarea id="invoice-terms" name="terms" rows={2} maxLength={2000} />
        </Field>
      </div>

      {customers.length === 0 ? (
        <Alert tone="warning">
          {dict.finance.invoices.customerRequired}{" "}
          <Link href={`/${locale}/contacts`} className="font-semibold underline">
            {dict.nav.contacts}
          </Link>
        </Alert>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button type="submit" name="intent" value="issue" size="lg" disabled={pending || customers.length === 0}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <FileText className="h-4 w-4" aria-hidden />}
          {dict.finance.invoices.issueNow}
        </Button>
        <Button
          type="submit"
          name="intent"
          value="draft"
          variant="secondary"
          size="lg"
          disabled={pending || customers.length === 0}
        >
          {dict.finance.invoices.saveDraft}
        </Button>
        <Link
          href={`/${locale}/invoices`}
          className={buttonVariants({ variant: "ghost", size: "lg", className: "sm:ml-auto" })}
        >
          {dict.common.cancel}
        </Link>
      </div>
    </form>
  );
}
