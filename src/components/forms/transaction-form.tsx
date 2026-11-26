"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { AlertTriangle, Loader2, Save, WifiOff } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Button, buttonVariants } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { SuccessCheck } from "@/components/motion/success-check";
import { useI18n } from "@/components/layout/i18n-provider";
import { parseMoneyToMinor } from "@/lib/money";
import { getCurrency } from "@/lib/currency";
import { newClientId, queueItem, flushOutbox } from "@/lib/offline/outbox";
import { cn } from "@/lib/utils";
import type { AccountSubtype, CategoryKind, TransactionKind } from "@/types/database";

type Option = { id: string; name: string; translations?: Record<string, string> | null };
type AccountOption = Option & { subtype: AccountSubtype };
type CategoryOption = Option & { kind: CategoryKind; color: string };
type ContactOption = Option & { kind: "customer" | "supplier" | "both" };

export function TransactionForm({
  workspaceId,
  currency,
  defaultDate,
  defaultKind,
  accounts,
  categories,
  contacts,
}: {
  workspaceId: string;
  currency: string;
  defaultDate: string;
  defaultKind: TransactionKind;
  accounts: AccountOption[];
  categories: CategoryOption[];
  contacts: ContactOption[];
}) {
  const { locale, dict } = useI18n();
  const { toast } = useToast();
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);

  const [kind, setKind] = useState<TransactionKind>(defaultKind);
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "warning" | "error"; text: string } | null>(null);

  const currencyMeta = getCurrency(currency);
  const visibleCategories = useMemo(
    () => categories.filter((category) => category.kind === (kind === "income" ? "income" : "expense")),
    [categories, kind],
  );
  const visibleContacts = useMemo(
    () =>
      contacts.filter((contact) =>
        kind === "income"
          ? contact.kind === "customer" || contact.kind === "both"
          : contact.kind === "supplier" || contact.kind === "both",
      ),
    [contacts, kind],
  );

  const kinds: TransactionKind[] = ["income", "expense", "transfer"];

  const kindLabel = (value: TransactionKind) =>
    value === "income"
      ? dict.transactions.income
      : value === "expense"
        ? dict.transactions.expense
        : dict.transactions.transfer;

  const localised = (option: Option) => option.translations?.[locale] ?? option.name;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);

    setMessage(null);

    try {
      const minor = parseMoneyToMinor(amount, currency);
      if (minor <= 0n) throw new Error("amount");
    } catch {
      setMessage({ tone: "error", text: dict.errors.amountInvalid });
      return;
    }

    if (kind !== "transfer" && !categoryId) {
      setMessage({ tone: "error", text: dict.transactions.categoryLabel });
      return;
    }

    const item = {
      clientGeneratedId: newClientId(),
      workspaceId,
      currency,
      kind,
      amount,
      description: String(data.get("description") ?? "").trim(),
      occurredOn: String(data.get("occurredOn") ?? defaultDate),
      categoryId: kind === "transfer" ? null : categoryId,
      accountId: String(data.get("accountId") ?? ""),
      counterAccountId: kind === "transfer" ? String(data.get("counterAccountId") ?? "") : null,
      contactId: String(data.get("contactId") ?? "") || null,
      paymentMethod: String(data.get("paymentMethod") ?? "cash") as
        | "cash"
        | "mobile_money"
        | "bank_transfer"
        | "card"
        | "cheque"
        | "other",
      reference: String(data.get("reference") ?? "").trim() || null,
      createdAt: Date.now(),
      attempts: 0,
    };

    if (!item.accountId || item.description.length < 2) {
      setMessage({ tone: "error", text: dict.errors.generic });
      return;
    }

    try {
      await queueItem(item);
    } catch {
      setMessage({ tone: "error", text: dict.errors.generic });
      return;
    }

    setPending(true);
    const result = await flushOutbox();
    setPending(false);

    if (result.remaining === 0 && result.synced > 0) {
      setMessage({ tone: "success", text: dict.transactions.createSuccess });
      toast({ title: dict.transactions.createSuccess, description: dict.transactions.createSuccessHint, tone: "success" });
      form.reset();
      setAmount("");
      setCategoryId("");
      router.refresh();
      return;
    }

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setMessage({ tone: "warning", text: dict.transactions.offlineQueued });
      toast({ title: dict.transactions.offlineQueued, tone: "info" });
      return;
    }

    const errorMessage = result.errors[0] ?? dict.transactions.createError;
    setMessage({ tone: "error", text: errorMessage });
    toast({ title: dict.errors.generic, description: errorMessage, tone: "error" });
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-5" noValidate>
      {message ? (
        <Alert tone={message.tone === "success" ? "success" : message.tone === "warning" ? "warning" : "error"}>
          <span className="flex items-start gap-2">
            {message.tone === "success" ? (
              <SuccessCheck className="mt-0.5 h-4 w-4 text-accent-strong" />
            ) : message.tone === "warning" ? (
              <WifiOff className="mt-0.5 h-4 w-4" aria-hidden />
            ) : (
              <AlertTriangle className="mt-0.5 h-4 w-4" aria-hidden />
            )}
            <span>
              {message.text}
              {message.tone === "success" ? (
                <Link href={`/${locale}/transactions`} className="ml-2 font-semibold underline">
                  {dict.common.viewAll}
                </Link>
              ) : null}
            </span>
          </span>
        </Alert>
      ) : null}

      <fieldset>
        <legend className="sr-only">{dict.transactions.type}</legend>
        <div className="grid grid-cols-3 gap-1 rounded-full bg-page-soft p-1">
          {kinds.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => {
                setKind(option);
                setCategoryId("");
              }}
              aria-pressed={kind === option}
              className={cn(
                "rounded-full px-3 py-2 text-sm font-semibold transition",
                kind === option
                  ? option === "expense"
                    ? "bg-panel text-danger shadow-sm"
                    : "bg-panel text-accent shadow-sm"
                  : "text-muted hover:text-heading",
              )}
            >
              {kindLabel(option)}
            </button>
          ))}
        </div>
      </fieldset>

      <Field label={dict.transactions.amountLabel} htmlFor="amount" hint={`${currency} · ${currencyMeta.name}`}>
        <div className="relative">
          <Input
            id="amount"
            name="amount"
            inputMode="decimal"
            autoComplete="off"
            required
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="0"
            className="kpi-value h-14 pr-20 text-2xl font-semibold"
          />
          <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-muted">
            {currencyMeta.symbol}
          </span>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {["1000", "5000", "25000", "100000"].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setAmount(value)}
              className="rounded-full border border-line bg-panel px-2.5 py-1 text-xs font-semibold text-muted transition hover:border-accent-line hover:text-heading"
            >
              {new Intl.NumberFormat("fr-CM").format(Number(value))}
            </button>
          ))}
        </div>
      </Field>

      <Field
        label={dict.transactions.descriptionLabel}
        htmlFor="description"
        error={undefined}
      >
        <Textarea
          id="description"
          name="description"
          required
          maxLength={500}
          rows={2}
          placeholder={dict.transactions.descriptionPlaceholder}
          className="min-h-16"
        />
      </Field>

      {kind !== "transfer" ? (
        <fieldset>
          <legend className="mb-1.5 block text-[0.8rem] font-semibold uppercase tracking-[0.08em] text-muted">
            {dict.transactions.categoryLabel}
          </legend>
          <div className="flex flex-wrap gap-2">
            {visibleCategories.map((category) => {
              const selected = categoryId === category.id;
              return (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => setCategoryId(category.id)}
                  aria-pressed={selected}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium transition",
                    selected
                      ? "border-jade-600 bg-accent-soft text-accent"
                      : "border-line bg-panel text-muted hover:border-accent-line hover:text-heading",
                  )}
                >
                  <span
                    aria-hidden
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: category.color || "#0B7A5A" }}
                  />
                  {localised(category)}
                </button>
              );
            })}
          </div>
        </fieldset>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={kind === "income" ? dict.transactions.accountLabel : dict.transactions.accountLabel} htmlFor="accountId">
          <Select id="accountId" name="accountId" required defaultValue={accounts[0]?.id ?? ""}>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
                {account.subtype === "mobile_money" ? ` · ${dict.transactions.mobileMoney}` : ""}
              </option>
            ))}
          </Select>
        </Field>

        {kind === "transfer" ? (
          <Field label={dict.transactions.accountLabel} htmlFor="counterAccountId">
            <Select id="counterAccountId" name="counterAccountId" required defaultValue={accounts[1]?.id ?? accounts[0]?.id ?? ""}>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </Select>
          </Field>
        ) : (
          <Field label={dict.transactions.contactLabel} htmlFor="contactId">
            <Select id="contactId" name="contactId" defaultValue="">
              <option value="">{dict.common.none}</option>
              {visibleContacts.map((contact) => (
                <option key={contact.id} value={contact.id}>
                  {contact.name}
                </option>
              ))}
            </Select>
          </Field>
        )}

        <Field label={dict.transactions.dateLabel} htmlFor="occurredOn">
          <Input id="occurredOn" name="occurredOn" type="date" required defaultValue={defaultDate} max={defaultDate} />
        </Field>

        <Field label={dict.transactions.paymentMethod} htmlFor="paymentMethod">
          <Select id="paymentMethod" name="paymentMethod" defaultValue="cash">
            <option value="cash">{dict.transactions.cash}</option>
            <option value="mobile_money">{dict.transactions.mobileMoney}</option>
            <option value="bank_transfer">{dict.transactions.bankTransfer}</option>
            <option value="card">{dict.transactions.card}</option>
            <option value="cheque">{dict.transactions.cheque}</option>
            <option value="other">{dict.transactions.other}</option>
          </Select>
        </Field>
      </div>

      <Field
        label={dict.transactions.reference}
        htmlFor="reference"
        hint={dict.common.optional}
      >
        <Input id="reference" name="reference" maxLength={120} autoComplete="off" />
      </Field>

      <div className="flex flex-col gap-2 pt-1 sm:flex-row">
        <Button type="submit" size="lg" disabled={pending} className="w-full sm:w-auto">
          {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Save className="h-4 w-4" aria-hidden />}
          {pending ? dict.transactions.saving : dict.transactions.save}
        </Button>
        <Link
          href={`/${locale}/transactions`}
          className={buttonVariants({ variant: "ghost", size: "lg", className: "w-full sm:w-auto" })}
        >
          {dict.common.cancel}
        </Link>
      </div>
    </form>
  );
}
