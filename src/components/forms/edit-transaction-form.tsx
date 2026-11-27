"use client";

import { useActionState, useMemo, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { useI18n } from "@/components/layout/i18n-provider";
import { initialFormState } from "@/lib/action-utils";
import { pickTranslation } from "@/lib/i18n/config";
import { getCurrency } from "@/lib/currency";
import { amendTransactionAction } from "@/app/[locale]/(dashboard)/transactions/actions";
import type { CategoryKind, PaymentMethod, TransactionKind } from "@/types/database";

type Option = { id: string; name: string; translations?: Record<string, string> | null };
type CategoryOption = Option & { kind: CategoryKind };
type AccountOption = Option & { subtype: string };

export function EditTransactionForm({
  transaction,
  currency,
  accounts,
  categories,
  contacts,
}: {
  transaction: {
    id: string;
    kind: TransactionKind;
    amount_minor: number;
    description: string;
    occurred_on: string;
    category_id: string | null;
    account_id: string;
    counter_account_id: string | null;
    contact_id: string | null;
    payment_method: PaymentMethod;
    reference: string | null;
  };
  currency: string;
  accounts: AccountOption[];
  categories: CategoryOption[];
  contacts: Option[];
}) {
  const { locale, dict } = useI18n();
  const [state, action, pending] = useActionState(amendTransactionAction, initialFormState);
  const [kind, setKind] = useState<TransactionKind>(transaction.kind);

  const decimals = getCurrency(currency).decimals;
  const initialAmount = useMemo(() => {
    const divisor = 10 ** decimals;
    return (transaction.amount_minor / divisor).toFixed(decimals);
  }, [transaction.amount_minor, decimals]);

  const visibleCategories = categories.filter((category) => category.kind === kind);
  const paymentMethods: PaymentMethod[] = ["cash", "mobile_money", "bank_transfer", "card", "cheque", "other"];

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="transactionId" value={transaction.id} />

      {state.status === "error" && state.message ? <Alert tone="error">{state.message}</Alert> : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={dict.transactions.type} htmlFor="edit-kind">
          <Select id="edit-kind" name="kind" value={kind} onChange={(event) => setKind(event.target.value as TransactionKind)}>
            <option value="income">{dict.transactions.income}</option>
            <option value="expense">{dict.transactions.expense}</option>
            <option value="transfer">{dict.transactions.transfer}</option>
          </Select>
        </Field>
        <Field label={dict.transactions.amountLabel} htmlFor="edit-amount">
          <Input id="edit-amount" name="amount" inputMode="decimal" defaultValue={initialAmount} required />
        </Field>
      </div>

      <Field label={dict.transactions.descriptionLabel} htmlFor="edit-description">
        <Input id="edit-description" name="description" defaultValue={transaction.description} maxLength={500} required />
      </Field>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={dict.transactions.dateLabel} htmlFor="edit-date">
          <Input id="edit-date" name="occurredOn" type="date" defaultValue={transaction.occurred_on} required />
        </Field>
        <Field label={dict.transactions.paymentMethod} htmlFor="edit-method">
          <Select id="edit-method" name="paymentMethod" defaultValue={transaction.payment_method}>
            {paymentMethods.map((method) => (
              <option key={method} value={method}>{method.replace(/_/g, " ")}</option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={kind === "transfer" ? dict.transactions.transferFrom : dict.transactions.accountLabel} htmlFor="edit-account">
          <Select id="edit-account" name="accountId" defaultValue={transaction.account_id} required>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>{account.name}</option>
            ))}
          </Select>
        </Field>
        {kind === "transfer" ? (
          <Field label={dict.transactions.transferTo} htmlFor="edit-counter-account">
            <Select id="edit-counter-account" name="counterAccountId" defaultValue={transaction.counter_account_id ?? ""} required>
              <option value="" disabled>—</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>{account.name}</option>
              ))}
            </Select>
          </Field>
        ) : (
          <Field label={dict.transactions.categoryLabel} htmlFor="edit-category">
            <Select id="edit-category" name="categoryId" defaultValue={transaction.category_id ?? ""} required>
              <option value="" disabled>—</option>
              {visibleCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {pickTranslation(category.translations, locale) ?? category.name}
                </option>
              ))}
            </Select>
          </Field>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={dict.transactions.contactLabel} htmlFor="edit-contact">
          <Select id="edit-contact" name="contactId" defaultValue={transaction.contact_id ?? ""}>
            <option value="">—</option>
            {contacts.map((contact) => (
              <option key={contact.id} value={contact.id}>{contact.name}</option>
            ))}
          </Select>
        </Field>
        <Field label={dict.transactions.reference} htmlFor="edit-reference">
          <Input id="edit-reference" name="reference" defaultValue={transaction.reference ?? ""} maxLength={120} />
        </Field>
      </div>

      <Field label={dict.transactions.voidNote} htmlFor="edit-reason">
        <Input id="edit-reason" name="reason" maxLength={240} placeholder={dict.transactions.voidNote} />
      </Field>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? dict.transactions.saving : dict.common.saveChanges}
        </Button>
      </div>
    </form>
  );
}
