"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { HandCoins } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { useI18n } from "@/components/layout/i18n-provider";
import { initialFormState } from "@/lib/action-utils";
import { formatMoney, moneyLocale, toMinorUnits } from "@/lib/money";
import { recordDebtPaymentAction } from "@/app/[locale]/(dashboard)/finance/actions";

type AccountOption = { id: string; name: string };

export function DebtPaymentForm({
  debtId,
  remainingMinor,
  currency,
  today,
  accounts,
}: {
  debtId: string;
  remainingMinor: string;
  currency: string;
  today: string;
  accounts: AccountOption[];
}) {
  const { locale, dict } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(recordDebtPaymentAction, initialFormState);
  const remaining = toMinorUnits(remainingMinor);

  useEffect(() => {
    if (state.status === "success") router.refresh();
  }, [state.status, router]);

  if (remaining <= 0n) return null;

  if (!open) {
    return (
      <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <HandCoins className="h-3.5 w-3.5" aria-hidden />
        {dict.finance.debts.newRepayment}
      </Button>
    );
  }

  return (
    <form action={action} className="mt-3 rounded-xl border border-line bg-page-soft/60 p-3.5" noValidate>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="debtId" value={debtId} />

      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-bold text-heading">{dict.finance.debts.newRepayment}</p>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs font-semibold text-muted hover:text-heading"
        >
          {dict.common.cancel}
        </button>
      </div>

      {state.status === "error" && state.message ? (
        <Alert tone="error" className="mt-2">
          {state.message}
        </Alert>
      ) : null}
      {state.status === "success" && state.message ? (
        <Alert tone="success" className="mt-2">
          {state.message}
        </Alert>
      ) : null}

      <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
        <Field label={dict.finance.debts.amount} htmlFor={`payment-amount-${debtId}`} hint={currency}>
          <Input
            id={`payment-amount-${debtId}`}
            name="amount"
            inputMode="decimal"
            required
            autoComplete="off"
            placeholder={formatMoney(remaining, currency, moneyLocale(locale, currency))}
          />
        </Field>
        <Field label={dict.finance.debts.date} htmlFor={`payment-date-${debtId}`}>
          <Input id={`payment-date-${debtId}`} name="paidOn" type="date" required defaultValue={today} max={today} />
        </Field>
        <Field label={dict.finance.debts.account} htmlFor={`payment-account-${debtId}`}>
          <Select id={`payment-account-${debtId}`} name="accountId" defaultValue="">
            <option value="">{dict.common.none}</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={dict.finance.debts.paymentMethod} htmlFor={`payment-method-${debtId}`}>
          <Select id={`payment-method-${debtId}`} name="paymentMethod" defaultValue="cash">
            <option value="cash">{dict.transactions.cash}</option>
            <option value="mobile_money">{dict.transactions.mobileMoney}</option>
            <option value="bank_transfer">{dict.transactions.bankTransfer}</option>
            <option value="card">{dict.transactions.card}</option>
            <option value="cheque">{dict.transactions.cheque}</option>
            <option value="other">{dict.transactions.other}</option>
          </Select>
        </Field>
      </div>

      <div className="mt-2.5 grid gap-2.5 sm:grid-cols-2">
        <Field label={dict.finance.debts.reference} htmlFor={`payment-ref-${debtId}`}>
          <Input id={`payment-ref-${debtId}`} name="reference" maxLength={120} autoComplete="off" />
        </Field>
        <Field label={dict.finance.debts.notes} htmlFor={`payment-notes-${debtId}`}>
          <Input id={`payment-notes-${debtId}`} name="notes" maxLength={1000} autoComplete="off" />
        </Field>
      </div>

      <Button type="submit" size="sm" className="mt-3" disabled={pending}>
        <HandCoins className="h-3.5 w-3.5" aria-hidden />
        {pending ? dict.common.saving : dict.finance.debts.recordPayment}
      </Button>
    </form>
  );
}
