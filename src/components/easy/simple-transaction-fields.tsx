"use client";

import Link from "next/link";
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpRight,
  Delete,
  Banknote,
  CheckCircle2,
  ChevronRight,
  Landmark,
  Loader2,
  Smartphone,
} from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/layout/i18n-provider";
import { categoryGlyph } from "@/components/easy/category-glyph";
import { SpeakButton } from "@/components/easy/speak-button";
import { VoiceAmountButton } from "@/components/easy/voice-amount-button";
import { getCurrency } from "@/lib/currency";
import { pickTranslation } from "@/lib/i18n/config";
import { interpolate } from "@/lib/i18n/interpolate";
import { cn } from "@/lib/utils";
import type { AccountSubtype, CategoryKind, TransactionKind } from "@/types/database";

type CategoryOption = {
  id: string;
  name: string;
  kind: CategoryKind;
  color: string;
  icon?: string | null;
  translations?: Record<string, string> | null;
};

type AccountOption = {
  id: string;
  name: string;
  subtype: AccountSubtype;
};

export type EasyStep = "amount" | "category" | "review";

type Message = { tone: "success" | "warning" | "error"; text: string };

export function SimpleTransactionFields({
  kind,
  onKindChange,
  amount,
  onAmountChange,
  categoryId,
  onCategoryChange,
  accountId,
  onAccountChange,
  categories,
  accounts,
  step,
  onStepChange,
  onNext,
  pending,
  message,
  onReset,
  onVoiceError,
  currency,
}: {
  kind: TransactionKind;
  onKindChange: (kind: TransactionKind) => void;
  amount: string;
  onAmountChange: (amount: string) => void;
  categoryId: string;
  onCategoryChange: (id: string) => void;
  accountId: string;
  onAccountChange: (id: string) => void;
  categories: CategoryOption[];
  accounts: AccountOption[];
  step: EasyStep;
  onStepChange: (step: EasyStep) => void;
  onNext: () => void;
  pending: boolean;
  message: Message | null;
  onReset: () => void;
  onVoiceError: () => void;
  currency: string;
}) {
  const { locale, dict } = useI18n();
  const currencyMeta = getCurrency(currency);
  const category = categories.find((item) => item.id === categoryId) ?? null;
  const account = accounts.find((item) => item.id === accountId) ?? accounts[0] ?? null;
  const categoryName = category ? pickTranslation(category.translations, locale) ?? category.name : "";
  const actionLabel = kind === "income" ? dict.easy.youSold : dict.easy.youSpent;
  const isSaved = message?.tone === "success" || message?.tone === "warning";

  function append(value: string) {
    if (value === "00" && !amount) return;
    const next = `${amount}${value}`.replace(/^0+(?=\d)/, "");
    if (next.length <= 12) onAmountChange(next);
  }

  if (isSaved) {
    return (
      <div role="status" aria-live="polite" className="rounded-3xl border-2 border-accent-line bg-accent-soft p-6 text-center sm:p-8">
        <span className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-jade-600 text-white">
          <CheckCircle2 className="h-12 w-12" aria-hidden />
        </span>
        <h2 className="mt-4 text-3xl font-black text-heading">
          {message.tone === "success" ? dict.easy.savedTitle : dict.easy.savedOfflineTitle}
        </h2>
        <p className="mx-auto mt-2 max-w-sm text-lg font-medium text-muted">
          {message.tone === "success" ? dict.easy.savedHint : dict.easy.savedOfflineHint}
        </p>
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <Button type="button" size="lg" onClick={onReset} className="min-h-14 text-lg">
            {dict.easy.recordAnother}
          </Button>
          <Link
            href={`/${locale}/easy?recorded=1`}
            className="inline-flex min-h-14 items-center justify-center rounded-full border-2 border-line bg-panel px-6 text-lg font-bold text-heading transition hover:bg-page-soft"
          >
            {dict.easy.seeMyMoney}
          </Link>
        </div>
        <SpeakButton
          text={message.tone === "success" ? dict.easy.savedSpoken : dict.easy.savedOfflineSpoken}
          label={dict.easy.listen}
          className="mt-4"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => onKindChange("income")}
          aria-pressed={kind === "income"}
          className={cn(
            "flex min-h-24 flex-col items-center justify-center gap-1 rounded-3xl border-4 px-3 py-4 text-center transition",
            kind === "income"
              ? "border-jade-700 bg-jade-600 text-white shadow-lg"
              : "border-line bg-panel text-muted hover:border-jade-400",
          )}
        >
          <ArrowDownLeft className="h-8 w-8" aria-hidden />
          <span className="text-lg font-black leading-tight">{dict.easy.iSold}</span>
        </button>
        <button
          type="button"
          onClick={() => onKindChange("expense")}
          aria-pressed={kind === "expense"}
          className={cn(
            "flex min-h-24 flex-col items-center justify-center gap-1 rounded-3xl border-4 px-3 py-4 text-center transition",
            kind === "expense"
              ? "border-danger bg-danger text-white shadow-lg"
              : "border-line bg-panel text-muted hover:border-danger/50",
          )}
        >
          <ArrowUpRight className="h-8 w-8" aria-hidden />
          <span className="text-lg font-black leading-tight">{dict.easy.iSpent}</span>
        </button>
      </div>

      {message?.tone === "error" ? <Alert tone="error">{message.text}</Alert> : null}

      <div className="flex items-center justify-center gap-2" aria-label={dict.easy.progressLabel}>
        {(["amount", "category", "review"] as const).map((value, index) => (
          <span
            key={value}
            aria-current={step === value ? "step" : undefined}
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-full border-2 text-base font-black",
              step === value
                ? "border-forest bg-forest text-white"
                : index < ["amount", "category", "review"].indexOf(step)
                  ? "border-jade-600 bg-accent-soft text-accent"
                  : "border-line bg-panel text-muted",
            )}
          >
            {index + 1}
          </span>
        ))}
      </div>

      {step === "amount" ? (
        <section aria-labelledby="easy-amount-title" className="space-y-4">
          <div className="text-center">
            <h2 id="easy-amount-title" className="text-2xl font-black text-heading">{dict.easy.amountTitle}</h2>
            <p className="mt-1 text-base text-muted">{dict.easy.amountHint}</p>
          </div>

          <div className="rounded-3xl border-4 border-forest bg-panel p-5 text-center">
            <p className="text-sm font-bold uppercase tracking-[0.14em] text-muted">{currencyMeta.symbol}</p>
            <input
              id="amount"
              name="amount"
              inputMode="decimal"
              autoComplete="off"
              required
              value={amount}
              onChange={(event) => onAmountChange(event.currentTarget.value.replace(/[^\d.,]/g, ""))}
              placeholder="0"
              aria-label={dict.easy.amountTitle}
              className="mt-1 w-full bg-transparent text-center text-5xl font-black tracking-tight text-heading outline-none placeholder:text-muted/30 sm:text-6xl"
            />
            <p className="mt-1 text-sm font-semibold text-muted">{currencyMeta.name}</p>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9", "00", "0", "back"].map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => (key === "back" ? onAmountChange(amount.slice(0, -1)) : append(key))}
                aria-label={key === "back" ? dict.easy.deleteDigit : key}
                className="grid h-16 place-items-center rounded-2xl border-2 border-line bg-panel text-2xl font-black text-heading transition active:scale-95 hover:border-forest hover:bg-accent-soft"
              >
                {key === "back" ? <Delete className="h-7 w-7" aria-hidden /> : key}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap justify-center gap-2">
            {["500", "1000", "5000", "10000"].map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => onAmountChange(value)}
                className="min-h-11 rounded-full border-2 border-line bg-panel px-4 text-sm font-bold text-muted hover:border-forest hover:text-heading"
              >
                {new Intl.NumberFormat(locale === "fr" ? "fr-CM" : "en-CM").format(Number(value))}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <VoiceAmountButton onAmount={onAmountChange} onError={onVoiceError} className="min-h-14 flex-1 text-lg" />
            <Button type="button" size="lg" onClick={onNext} className="min-h-14 flex-1 text-lg">
              {dict.easy.continue}
              <ChevronRight className="h-5 w-5" aria-hidden />
            </Button>
          </div>
          <SpeakButton text={dict.easy.amountHint} label={dict.easy.listen} className="w-full" />
        </section>
      ) : null}

      {step === "category" ? (
        <section aria-labelledby="easy-category-title" className="space-y-4">
          <div className="text-center">
            <h2 id="easy-category-title" className="text-2xl font-black text-heading">{dict.easy.categoryTitle}</h2>
            <p className="mt-1 text-base text-muted">{dict.easy.categoryHint}</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {categories.map((item) => {
              const selected = categoryId === item.id;
              const label = pickTranslation(item.translations, locale) ?? item.name;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onCategoryChange(item.id)}
                  aria-pressed={selected}
                  className={cn(
                    "flex min-h-32 flex-col items-center justify-center gap-2 rounded-3xl border-4 px-3 py-4 text-center transition",
                    selected
                      ? "border-forest bg-accent-soft shadow-md"
                      : "border-line bg-panel hover:border-forest/50",
                  )}
                >
                  <span className="text-4xl" aria-hidden>{categoryGlyph(item.name, item.kind, item.icon)}</span>
                  <span className="text-base font-black leading-tight text-heading">{label}</span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button type="button" variant="secondary" size="lg" onClick={() => onStepChange("amount")} className="min-h-14 flex-1 text-lg">
              <ArrowLeft className="h-5 w-5" aria-hidden />
              {dict.easy.back}
            </Button>
            <Button type="button" size="lg" onClick={onNext} disabled={!categoryId} className="min-h-14 flex-1 text-lg">
              {dict.easy.continue}
              <ChevronRight className="h-5 w-5" aria-hidden />
            </Button>
          </div>
          <SpeakButton
            text={category ? interpolate(dict.easy.categorySpoken, { category: categoryName }, { locale }) : dict.easy.categoryHint}
            label={dict.easy.listen}
            className="w-full"
          />
        </section>
      ) : null}

      {step === "review" ? (
        <section aria-labelledby="easy-review-title" className="space-y-4">
          <div className="text-center">
            <h2 id="easy-review-title" className="text-2xl font-black text-heading">{dict.easy.reviewTitle}</h2>
            <p className="mt-1 text-base text-muted">{dict.easy.reviewHint}</p>
          </div>

          <div className="rounded-3xl border-4 border-forest bg-panel p-6 text-center">
            <p className="text-base font-bold text-muted">{actionLabel}</p>
            <p className="mt-1 text-5xl font-black text-heading">
              {amount || "0"} <span className="text-2xl text-muted">{currencyMeta.symbol}</span>
            </p>
            {category ? (
              <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-accent-soft px-4 py-2">
                <span className="text-2xl" aria-hidden>{categoryGlyph(category.name, category.kind, category.icon)}</span>
                <span className="text-lg font-black text-heading">{categoryName}</span>
              </div>
            ) : null}
          </div>

          <div>
            <p className="mb-2 text-base font-bold text-heading">
              {kind === "income" ? dict.easy.intoLabel : dict.easy.fromLabel}
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {accounts.map((item) => {
                const selected = account?.id === item.id;
                const Icon = item.subtype === "mobile_money" ? Smartphone : item.subtype === "bank" ? Landmark : Banknote;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onAccountChange(item.id)}
                    aria-pressed={selected}
                    className={cn(
                      "flex min-h-20 flex-col items-center justify-center gap-1 rounded-2xl border-2 px-3 py-2 text-center transition",
                      selected
                        ? "border-forest bg-accent-soft text-heading"
                        : "border-line bg-panel text-muted hover:border-forest/50",
                    )}
                  >
                    <Icon className="h-6 w-6" aria-hidden />
                    <span className="text-sm font-bold leading-tight">{item.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button type="button" variant="secondary" size="lg" onClick={() => onStepChange("category")} className="min-h-14 flex-1 text-lg">
              <ArrowLeft className="h-5 w-5" aria-hidden />
              {dict.easy.change}
            </Button>
            <Button type="submit" size="lg" disabled={pending} className="min-h-16 flex-[1.4] text-xl">
              {pending ? <Loader2 className="h-6 w-6 animate-spin" aria-hidden /> : <CheckCircle2 className="h-6 w-6" aria-hidden />}
              {pending ? dict.easy.saving : dict.easy.yesSave}
            </Button>
          </div>
          <SpeakButton
            text={interpolate(
              dict.easy.reviewSpoken,
              { kind: actionLabel, amount: `${amount || "0"} ${currencyMeta.symbol}`, category: categoryName },
              { locale },
            )}
            label={dict.easy.listen}
            className="w-full"
          />
        </section>
      ) : null}
    </div>
  );
}
