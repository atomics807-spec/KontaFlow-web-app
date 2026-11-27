"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDownLeft, ArrowUpRight, Plus } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { useI18n } from "@/components/layout/i18n-provider";
import { initialFormState } from "@/lib/action-utils";
import { pickTranslation } from "@/lib/i18n/config";
import { recordQuickTransactionAction } from "@/app/[locale]/(dashboard)/transactions/actions";
import type { CategoryKind } from "@/types/database";

type Option = { id: string; name: string; translations?: Record<string, string> | null };
type CategoryOption = Option & { kind: CategoryKind };

export function QuickTransactionForm({
  defaultDate,
  accounts,
  categories,
}: {
  defaultDate: string;
  accounts: Option[];
  categories: CategoryOption[];
}) {
  const { locale, dict } = useI18n();
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const clientIdInput = useRef<HTMLInputElement>(null);
  const [state, action, pending] = useActionState(recordQuickTransactionAction, initialFormState);
  const [kind, setKind] = useState<"income" | "expense">("income");

  const visibleCategories = useMemo(
    () => categories.filter((category) => category.kind === kind),
    [categories, kind],
  );

  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
    if (clientIdInput.current && !clientIdInput.current.value) {
      clientIdInput.current.value = globalThis.crypto.randomUUID();
    }
    if (state.status === "success") router.refresh();
  }, [state.status, router]);

  if (accounts.length === 0) {
    return <p className="text-sm text-muted">{dict.errors.generic}</p>;
  }

  return (
    <form ref={formRef} action={action} className="space-y-3" noValidate>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="occurredOn" value={defaultDate} />
      <input ref={clientIdInput} type="hidden" name="clientGeneratedId" defaultValue="" />

      <div className="grid grid-cols-2 gap-1.5 rounded-xl bg-page-soft p-1">
        <button
          type="button"
          onClick={() => setKind("income")}
          aria-pressed={kind === "income"}
          className={`flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition ${
            kind === "income" ? "bg-panel text-accent shadow-sm" : "text-muted"
          }`}
        >
          <ArrowDownLeft className="h-3.5 w-3.5" aria-hidden />
          {dict.transactions.income}
        </button>
        <button
          type="button"
          onClick={() => setKind("expense")}
          aria-pressed={kind === "expense"}
          className={`flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition ${
            kind === "expense" ? "bg-panel text-warn shadow-sm" : "text-muted"
          }`}
        >
          <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
          {dict.transactions.expense}
        </button>
      </div>

      {state.status === "error" && state.message ? <Alert tone="error">{state.message}</Alert> : null}
      {state.status === "success" && state.message ? <Alert tone="success">{state.message}</Alert> : null}

      <div className="grid gap-2 sm:grid-cols-2">
        <Input
          name="amount"
          inputMode="decimal"
          placeholder={dict.transactions.amountLabel}
          aria-label={dict.transactions.amountLabel}
          required
        />
        <Select name="accountId" defaultValue={accounts[0]?.id ?? ""} aria-label={dict.transactions.accountLabel} required>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>{account.name}</option>
          ))}
        </Select>
      </div>

      <Input
        name="description"
        placeholder={dict.transactions.descriptionPlaceholder}
        aria-label={dict.transactions.descriptionLabel}
        maxLength={500}
        required
      />

      <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
        <Select key={kind} name="categoryId" defaultValue={visibleCategories[0]?.id ?? ""} aria-label={dict.transactions.categoryLabel} required>
          {visibleCategories.map((category) => (
            <option key={category.id} value={category.id}>
              {pickTranslation(category.translations, locale) ?? category.name}
            </option>
          ))}
        </Select>
        <Button type="submit" size="sm" disabled={pending || visibleCategories.length === 0}>
          <Plus className="h-4 w-4" aria-hidden />
          {pending ? dict.transactions.saving : dict.common.save}
        </Button>
      </div>

      {state.status === "error" && state.fieldErrors?.amount?.[0] ? (
        <p className="text-xs text-danger">{state.fieldErrors.amount[0]}</p>
      ) : null}
    </form>
  );
}
