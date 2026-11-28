"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { Loader2, Paperclip, Save, X } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Button, buttonVariants } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useI18n } from "@/components/layout/i18n-provider";
import { SimpleTransactionFields, type EasyStep } from "@/components/easy/simple-transaction-fields";
import { moneyLocale, parseMoneyToMinor } from "@/lib/money";
import { getCurrency } from "@/lib/currency";
import { pickTranslation } from "@/lib/i18n/config";
import { enqueueTransaction, getOutboxItem, newClientId, type OutboxAttachment } from "@/lib/offline/outbox";
import { requestBackgroundSync, syncOutbox } from "@/lib/offline/sync";
import { useOfflineIdentity } from "@/components/offline/offline-identity-provider";
import { cn } from "@/lib/utils";
import type { AccountSubtype, CategoryKind, TransactionKind } from "@/types/database";

type Option = { id: string; name: string; translations?: Record<string, string> | null };
type AccountOption = Option & { subtype: AccountSubtype };
type CategoryOption = Option & { kind: CategoryKind; color: string; icon?: string | null };
type ContactOption = Option & { kind: "customer" | "supplier" | "both" };

export function TransactionForm({
  workspaceId,
  currency,
  defaultDate,
  defaultKind,
  accounts,
  categories,
  contacts,
  simple = false,
}: {
  workspaceId: string;
  currency: string;
  defaultDate: string;
  defaultKind: TransactionKind;
  accounts: AccountOption[];
  categories: CategoryOption[];
  contacts: ContactOption[];
  simple?: boolean;
}) {
  const { locale, dict } = useI18n();
  const { toast } = useToast();
  const router = useRouter();
  const identity = useOfflineIdentity();
  const formRef = useRef<HTMLFormElement>(null);

  const [kind, setKind] = useState<TransactionKind>(defaultKind);
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [simpleStep, setSimpleStep] = useState<EasyStep>("amount");
  const [simpleAccountId, setSimpleAccountId] = useState(accounts[0]?.id ?? "");
  const [receipt, setReceipt] = useState<File | null>(null);
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

  const localised = (option: Option) => pickTranslation(option.translations, locale) ?? option.name;

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

    let attachment: OutboxAttachment | null = null;
    if (receipt) {
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        setMessage({ tone: "warning", text: dict.transactions.receiptOnline });
        return;
      }
      setPending(true);
      try {
        const upload = new FormData();
        upload.append("file", receipt);
        const response = await fetch("/api/receipts/upload", { method: "POST", body: upload });
        if (!response.ok) throw new Error("upload");
        attachment = (await response.json()) as OutboxAttachment;
      } catch {
        setPending(false);
        setMessage({ tone: "error", text: dict.transactions.receiptFailed });
        return;
      }
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
      attachment,
      createdAt: Date.now(),
      attempts: 0,
    };

    if (!item.accountId || item.description.length < 2) {
      setMessage({ tone: "error", text: dict.errors.generic });
      return;
    }

    if (!identity) {
      setPending(false);
      setMessage({ tone: "error", text: dict.errors.generic });
      return;
    }

    try {
      await enqueueTransaction(identity, item);
    } catch {
      setPending(false);
      setMessage({ tone: "error", text: dict.errors.generic });
      return;
    }

    await requestBackgroundSync();
    setPending(true);
    await syncOutbox(identity);
    const saved = await getOutboxItem(item.clientGeneratedId);
    setPending(false);

    form.reset();
    setAmount("");
    setCategoryId("");
    setReceipt(null);

    // Judge this entry by its own state: an older item elsewhere in the queue
    // must not make a successful new transaction look like a failure.
    if (saved?.status === "synced") {
      setMessage({ tone: "success", text: dict.transactions.createSuccess });
      toast({ title: dict.transactions.createSuccess, description: dict.transactions.createSuccessHint, tone: "success" });
      router.refresh();
      return;
    }

    if (saved?.status === "attention") {
      setMessage({ tone: "error", text: dict.pwa.syncNeedsAttention });
      toast({ title: dict.pwa.syncNeedsAttention, tone: "error" });
      router.refresh();
      return;
    }

    if (saved?.status === "pending" || saved?.status === "failed" || saved?.status === "syncing") {
      setMessage({ tone: "warning", text: dict.transactions.offlineQueued });
      toast({ title: dict.transactions.offlineQueued, tone: "info" });
      return;
    }

    setMessage({ tone: "error", text: dict.transactions.createError });
    toast({ title: dict.errors.generic, tone: "error" });
  }

  const simpleCategory = categories.find((category) => category.id === categoryId) ?? null;
  const simpleCategoryName = simpleCategory
    ? pickTranslation(simpleCategory.translations, locale) ?? simpleCategory.name
    : "";
  const simpleAccount = accounts.find((account) => account.id === simpleAccountId) ?? accounts[0] ?? null;
  const simplePaymentMethod =
    simpleAccount?.subtype === "mobile_money"
      ? "mobile_money"
      : simpleAccount?.subtype === "bank"
        ? "bank_transfer"
        : "cash";

  function simpleAmountIsValid(): boolean {
    try {
      return parseMoneyToMinor(amount, currency) > 0n;
    } catch {
      return false;
    }
  }

  function simpleNext() {
    if (simpleStep === "amount") {
      if (!simpleAmountIsValid()) {
        setMessage({ tone: "error", text: dict.easy.amountRequired });
        return;
      }
      setMessage(null);
      setSimpleStep("category");
      return;
    }

    if (simpleStep === "category") {
      if (!categoryId) {
        setMessage({ tone: "error", text: dict.easy.categoryRequired });
        return;
      }
      setMessage(null);
      setSimpleStep("review");
    }
  }

  function simpleReset() {
    setMessage(null);
    setSimpleStep("amount");
    setAmount("");
    setCategoryId("");
  }

  if (simple) {
    return (
      <form ref={formRef} onSubmit={handleSubmit} className="space-y-5" noValidate>
        <input
          type="hidden"
          name="description"
          value={`${kind === "income" ? dict.easy.saleDescription : dict.easy.expenseDescription}: ${simpleCategoryName}`}
        />
        <input type="hidden" name="occurredOn" value={defaultDate} />
        <input type="hidden" name="accountId" value={simpleAccount?.id ?? ""} />
        <input type="hidden" name="paymentMethod" value={simplePaymentMethod} />
        <input type="hidden" name="contactId" value="" />
        <SimpleTransactionFields
          kind={kind}
          onKindChange={(nextKind) => {
            setKind(nextKind);
            setCategoryId("");
            setMessage(null);
            setSimpleStep((current) => (current === "amount" ? "amount" : "category"));
          }}
          amount={amount}
          onAmountChange={setAmount}
          categoryId={categoryId}
          onCategoryChange={setCategoryId}
          accountId={simpleAccount?.id ?? ""}
          onAccountChange={setSimpleAccountId}
          categories={visibleCategories}
          accounts={accounts}
          step={simpleStep}
          onStepChange={setSimpleStep}
          onNext={simpleNext}
          pending={pending}
          message={message}
          onReset={simpleReset}
          onVoiceError={() => setMessage({ tone: "error", text: dict.easy.voiceFailed })}
          currency={currency}
        />
      </form>
    );
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-5" noValidate>
      {message ? (
        <Alert tone={message.tone === "success" ? "success" : message.tone === "warning" ? "warning" : "error"}>
          <span>
            {message.text}
            {message.tone === "success" ? (
              <Link href={`/${locale}/transactions`} className="ml-2 font-semibold underline">
                {dict.common.viewAll}
              </Link>
            ) : null}
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
              {new Intl.NumberFormat(moneyLocale(locale, currency)).format(Number(value))}
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
        <Field
          label={kind === "transfer" ? dict.transactions.transferFrom : dict.transactions.accountLabel}
          htmlFor="accountId"
        >
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
          <Field label={dict.transactions.transferTo} htmlFor="counterAccountId">
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

      <div>
        <label htmlFor="receipt" className="mb-1.5 block text-[0.8rem] font-semibold uppercase tracking-[0.08em] text-muted">
          {dict.transactions.receipt}
        </label>
        {receipt ? (
          <div className="flex items-center gap-2 rounded-xl border border-accent-line bg-accent-soft px-3 py-2.5 text-sm text-accent">
            <Paperclip className="h-4 w-4 shrink-0" aria-hidden />
            <span className="min-w-0 flex-1 truncate">{receipt.name}</span>
            <span className="shrink-0 text-xs text-accent/70">{Math.ceil(receipt.size / 1024)} KB</span>
            <button
              type="button"
              onClick={() => {
                setReceipt(null);
                if (formRef.current) {
                  const input = formRef.current.elements.namedItem("receipt");
                  if (input instanceof HTMLInputElement) input.value = "";
                }
              }}
              className="grid h-7 w-7 place-items-center rounded-full hover:bg-panel"
              aria-label={dict.transactions.receiptRemove}
            >
              <X className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>
        ) : (
          <Input
            id="receipt"
            name="receipt"
            type="file"
            accept="application/pdf,image/jpeg,image/png,image/webp"
            onChange={(event) => setReceipt(event.currentTarget.files?.[0] ?? null)}
            className="h-auto py-2 file:mr-3 file:rounded-full file:border-0 file:bg-page-soft file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-heading"
          />
        )}
        <p className="mt-1.5 text-xs text-muted">{dict.transactions.receiptHint}</p>
      </div>

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
