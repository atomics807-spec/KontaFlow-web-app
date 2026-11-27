"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, LockKeyhole, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { formatMoney, moneyLocale } from "@/lib/money";
import type { Locale } from "@/lib/i18n/config";
import type { PaymentProviderId } from "@/lib/payments/types";
import type { PaymentCheckout, PaymentCopy, PaymentPublicStatus, PaymentProviderOption } from "@/types/payments";

type Props = {
  planCode: string;
  planName: string;
  amountMinor: number;
  currency: string;
  providers: PaymentProviderOption[];
  defaultPhone: string | null;
  locale: Locale;
  copy: PaymentCopy;
};

function statusText(status: PaymentPublicStatus["status"], copy: PaymentCopy): string {
  switch (status) {
    case "succeeded":
      return copy.statusSucceeded;
    case "failed":
      return copy.statusFailed;
    case "expired":
      return copy.statusExpired;
    case "refunded":
      return copy.statusRefunded;
    case "reversed":
      return copy.statusReversed;
    case "processing":
      return copy.statusProcessing;
    default:
      return copy.statusPending;
  }
}

export function PaymentCheckout({
  planCode,
  planName,
  amountMinor,
  currency,
  providers,
  defaultPhone,
  locale,
  copy,
}: Props) {
  const router = useRouter();
  const [provider, setProvider] = useState<PaymentProviderId | null>(providers[0]?.id ?? null);
  const [phone, setPhone] = useState(defaultPhone ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkout, setCheckout] = useState<PaymentCheckout | null>(null);
  const [status, setStatus] = useState<PaymentPublicStatus | null>(null);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attemptsRef = useRef(0);
  const idempotencyRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearTimeout(pollRef.current);
    };
  }, []);

  useEffect(() => {
    const checkoutTerminal =
      checkout?.status === "succeeded" ||
      checkout?.status === "failed" ||
      checkout?.status === "expired" ||
      checkout?.status === "refunded" ||
      checkout?.status === "reversed";
    const statusTerminal =
      status?.status === "succeeded" ||
      status?.status === "failed" ||
      status?.status === "expired" ||
      status?.status === "refunded" ||
      status?.status === "reversed";
    if (!checkout || checkout.checkoutUrl || checkoutTerminal || statusTerminal) {
      return;
    }

    let cancelled = false;
    const poll = async () => {
      attemptsRef.current += 1;
      try {
        const response = await fetch(`/api/payments/${checkout.paymentId}`, { cache: "no-store" });
        const body = (await response.json().catch(() => null)) as { payment?: PaymentPublicStatus } | null;
        if (!cancelled && body?.payment) {
          setStatus(body.payment);
          if (body.payment.status === "succeeded") {
            router.refresh();
            return;
          }
          if (body.payment.status === "failed" || body.payment.status === "expired") return;
        }
      } catch {
        // Keep the pending state; the reconciliation job is the fallback.
      }
      if (!cancelled && attemptsRef.current < 120) {
        pollRef.current = setTimeout(poll, 5_000);
      }
    };
    pollRef.current = setTimeout(poll, 3_000);
    return () => {
      cancelled = true;
      if (pollRef.current) clearTimeout(pollRef.current);
    };
  }, [checkout, router, status?.status]);

  if (providers.length === 0) {
    return <p className="text-xs text-muted">{copy.noProviders}</p>;
  }

  const submit = async () => {
    if (!provider) return;
    setError(null);
    setStatus(null);
    setBusy(true);
    idempotencyRef.current ??= crypto.randomUUID();
    try {
      const response = await fetch("/api/payments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          planCode,
          provider,
          payerMsisdn: phone || null,
          idempotencyKey: idempotencyRef.current,
        }),
      });
      const body = (await response.json().catch(() => null)) as
        | { payment?: PaymentCheckout; message?: string }
        | null;
      if (!response.ok || !body?.payment) {
        setError(body?.message ?? copy.errorGeneric);
        return;
      }
      setCheckout(body.payment);
      if (["succeeded", "failed", "expired", "refunded", "reversed"].includes(body.payment.status)) {
        setStatus({
          id: body.payment.paymentId,
          merchantReference: body.payment.merchantReference,
          provider: body.payment.provider,
          planCode: body.payment.planCode,
          amountMinor: body.payment.amountMinor,
          currency: body.payment.currency,
          status: body.payment.status,
          checkoutUrl: null,
          failureCode: null,
          failureMessage: null,
          paidAt: null,
          expiresAt: body.payment.expiresAt,
          refundedAmountMinor: 0,
          createdAt: new Date().toISOString(),
        });
        if (body.payment.status === "succeeded") router.refresh();
      }
      if (body.payment.checkoutUrl) {
        window.location.assign(body.payment.checkoutUrl);
      }
    } catch {
      setError(copy.errorGeneric);
    } finally {
      setBusy(false);
    }
  };

  const terminal =
    status?.status === "succeeded" ||
    status?.status === "failed" ||
    status?.status === "expired" ||
    status?.status === "refunded" ||
    status?.status === "reversed" ||
    (!status &&
      (checkout?.status === "succeeded" ||
        checkout?.status === "failed" ||
        checkout?.status === "expired" ||
        checkout?.status === "refunded" ||
        checkout?.status === "reversed"));

  return (
    <div className="space-y-3">
      {!checkout ? (
        <>
          <fieldset>
            <legend className="mb-2 text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-muted">
              {copy.payWith}
            </legend>
            <div className="grid gap-2">
              {providers.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => {
                    setProvider(option.id);
                    idempotencyRef.current = null;
                  }}
                  aria-pressed={provider === option.id}
                  className={`flex items-center justify-between rounded-xl border px-3 py-2.5 text-left text-sm font-semibold transition ${
                    provider === option.id
                      ? "border-accent-strong bg-accent-soft text-heading ring-2 ring-accent-strong/20"
                      : "border-line bg-panel text-heading hover:border-accent-line"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Smartphone className="h-4 w-4 text-accent-strong" aria-hidden />
                    {option.label}
                  </span>
                  {provider === option.id ? <CheckCircle2 className="h-4 w-4 text-accent-strong" aria-hidden /> : null}
                </button>
              ))}
            </div>
          </fieldset>

          <Field
            label={copy.phone}
            htmlFor={`payment-phone-${planCode}`}
            hint={copy.phoneHint}
          >
            <Input
              id={`payment-phone-${planCode}`}
              name="payerMsisdn"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="6 71 23 45 67"
              value={phone}
              onChange={(event) => {
                setPhone(event.target.value);
                idempotencyRef.current = null;
              }}
              required={provider === "mtn_momo"}
            />
          </Field>

          {error ? (
            <p className="text-xs font-medium text-danger" role="alert">
              {error}
            </p>
          ) : null}

          <Button
            type="button"
            className="w-full"
            onClick={submit}
            disabled={busy || !provider}
            aria-label={`${copy.payButton} ${planName}`}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <LockKeyhole className="h-4 w-4" aria-hidden />}
            {busy ? copy.starting : `${copy.payButton} · ${formatMoney(BigInt(amountMinor), currency, moneyLocale(locale, currency))}`}
          </Button>
          <p className="text-center text-[0.68rem] text-muted">{copy.secure}</p>
        </>
      ) : (
        <div className="space-y-3" aria-live="polite">
          <div className="rounded-xl border border-line bg-page px-3 py-3 text-xs text-muted">
            <div className="flex items-center justify-between gap-2">
              <span>{copy.reference}</span>
              <span className="font-mono text-[0.68rem] text-heading">{checkout.merchantReference}</span>
            </div>
            <div className="mt-1.5 flex items-center justify-between gap-2">
              <span>{copy.providerLabel}</span>
              <span className="font-semibold text-heading">
                {providers.find((entry) => entry.id === checkout.provider)?.label ?? checkout.provider}
              </span>
            </div>
            <div className="mt-1.5 flex items-center justify-between gap-2">
              <span>{copy.statusLabel}</span>
              <span className="font-semibold text-heading">
                {status ? statusText(status.status, copy) : statusText(checkout.status, copy)}
              </span>
            </div>
          </div>

          {checkout.instructions ? <p className="text-xs text-muted">{checkout.instructions}</p> : null}
          {!terminal ? (
            <p className="flex items-center gap-2 text-xs text-muted">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              {copy.pending}
            </p>
          ) : null}

          {checkout.checkoutUrl ? (
            <a
              href={checkout.checkoutUrl}
              className="block rounded-full bg-jade-600 px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-jade-700"
            >
              {copy.openProvider}
            </a>
          ) : null}

          {status?.status === "succeeded" ? (
            <p className="flex items-center gap-2 text-xs font-semibold text-accent-strong">
              <CheckCircle2 className="h-4 w-4" aria-hidden />
              {copy.success}
            </p>
          ) : null}
          {status?.status === "failed" || status?.status === "expired" ? (
            <div className="space-y-2">
              <p className="text-xs font-medium text-danger">{statusText(status.status, copy)}</p>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="w-full"
                onClick={() => {
                  setCheckout(null);
                  setStatus(null);
                  setError(null);
                  attemptsRef.current = 0;
                  idempotencyRef.current = null;
                }}
              >
                {copy.retry}
              </Button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

export function PaymentReturnPoller({
  paymentId,
  copy,
}: {
  paymentId: string;
  copy: PaymentCopy;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<PaymentPublicStatus | null>(null);
  const [attempts, setAttempts] = useState(0);
  const attemptsRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const poll = async () => {
      attemptsRef.current += 1;
      setAttempts(attemptsRef.current);
      try {
        const response = await fetch(`/api/payments/${paymentId}`, { cache: "no-store" });
        const body = (await response.json().catch(() => null)) as { payment?: PaymentPublicStatus } | null;
        if (cancelled || !body?.payment) return;
        setStatus(body.payment);
        if (body.payment.status === "succeeded") {
          router.refresh();
          return;
        }
        if (["failed", "expired", "refunded", "reversed"].includes(body.payment.status)) return;
      } catch {
        // Keep polling; the reconciliation job will eventually settle the row.
      }
      if (!cancelled && attemptsRef.current < 120) {
        timer = setTimeout(poll, 5_000);
      }
    };
    timer = setTimeout(poll, 1_000);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [paymentId, router]);

  if (!status) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted" aria-live="polite">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        {copy.pending}
      </div>
    );
  }

  return (
    <div className="space-y-1" aria-live="polite">
      <p className="text-sm font-semibold text-heading">{statusText(status.status, copy)}</p>
      <p className="text-xs text-muted">
        {copy.reference}: <span className="font-mono">{status.merchantReference}</span>
      </p>
      {status.status === "failed" || status.status === "expired" ? (
        <p className="text-xs text-danger">{status.failureMessage ?? copy.failed}</p>
      ) : null}
      {attempts > 60 && status.status === "pending" ? (
        <p className="text-xs text-muted">{copy.pending}</p>
      ) : null}
    </div>
  );
}
