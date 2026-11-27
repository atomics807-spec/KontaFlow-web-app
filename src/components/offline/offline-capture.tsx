"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CloudOff, Loader2, Save, WifiOff } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/components/layout/i18n-provider";
import { OfflineOutboxPanel } from "@/components/offline/offline-outbox-panel";
import { getCachedOptions, getOfflineSession, newClientId, type CachedAccount, type CachedCategory, type OfflineSession } from "@/lib/offline/db";
import { enqueueTransaction, getOutboxItem, type NewOutboxItem } from "@/lib/offline/outbox";
import { requestBackgroundSync, syncOutbox } from "@/lib/offline/sync";
import { bootstrapOffline, refreshOfflineBootstrap } from "@/lib/offline/bootstrap";
import { parseMoneyToMinor } from "@/lib/money";
import { todayInZone } from "@/lib/dates";
import type { TransactionKind } from "@/types/database";

type Message = { tone: "success" | "warning" | "error"; text: string } | null;

export function OfflineCapture() {
  const { locale, dict } = useI18n();
  const [session, setSession] = useState<OfflineSession | null>(null);
  const [accounts, setAccounts] = useState<CachedAccount[]>([]);
  const [categories, setCategories] = useState<CachedCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [kind, setKind] = useState<TransactionKind>("income");
  const [amount, setAmount] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<Message>(null);
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  useEffect(() => {
    let active = true;

    const loadOptions = async (current: OfflineSession) => {
      const cached = await getCachedOptions(current.userId, current.workspaceId);
      if (!active) return;
      setAccounts(cached.accounts);
      setCategories(cached.categories);
    };

    void (async () => {
      const current = await getOfflineSession().catch(() => null);
      if (!active) return;
      if (current) {
        setSession(current);
        await loadOptions(current);
        return;
      }
      if (typeof navigator !== "undefined" && !navigator.onLine) return;
      const created = await bootstrapOffline(locale).catch(() => null);
      if (!active || !created) return;
      setSession(created);
      await loadOptions(created);
    })().finally(() => {
      if (active) setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [locale]);

  useEffect(() => {
    if (session || loading) return;
    const onOnline = () => {
      void bootstrapOffline(locale)
        .then(async (created) => {
          if (!created) return;
          setSession(created);
          const cached = await getCachedOptions(created.userId, created.workspaceId);
          setAccounts(cached.accounts);
          setCategories(cached.categories);
        })
        .catch(() => undefined);
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [session, loading, locale]);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;

    const syncNow = async () => {
      if (typeof navigator !== "undefined" && !navigator.onLine) return;
      await syncOutbox(session).catch(() => undefined);
      if (cancelled) return;
      await refreshOfflineBootstrap(session).catch(() => undefined);
      if (cancelled) return;
      const cached = await getCachedOptions(session.userId, session.workspaceId);
      if (cancelled) return;
      setAccounts(cached.accounts);
      setCategories(cached.categories);
    };

    const onOnline = () => {
      void requestBackgroundSync();
      void syncNow();
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") void syncNow();
    };
    const onServiceWorker = (event: MessageEvent) => {
      if (event.data?.type === "KONTAFLOW_SYNC") void syncNow();
    };

    void syncNow();
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisible);
    navigator.serviceWorker?.addEventListener("message", onServiceWorker);
    const interval = window.setInterval(() => void syncNow(), 30_000);

    return () => {
      cancelled = true;
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisible);
      navigator.serviceWorker?.removeEventListener("message", onServiceWorker);
      window.clearInterval(interval);
    };
  }, [session]);

  const visibleCategories = categories.filter(
    (category) => category.kind === (kind === "income" ? "income" : "expense"),
  );

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!session || pending) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    setMessage(null);

    let minor = 0n;
    try {
      minor = parseMoneyToMinor(amount, session.currency);
    } catch {
      setMessage({ tone: "error", text: dict.errors.amountInvalid });
      return;
    }
    if (minor <= 0n) {
      setMessage({ tone: "error", text: dict.errors.amountInvalid });
      return;
    }

    const categoryId = kind === "transfer" ? null : String(data.get("categoryId") ?? "");
    const counterAccountId = kind === "transfer" ? String(data.get("counterAccountId") ?? "") : null;
    if (kind !== "transfer" && !categoryId) {
      setMessage({ tone: "error", text: dict.transactions.categoryLabel });
      return;
    }
    if (kind === "transfer" && !counterAccountId) {
      setMessage({ tone: "error", text: dict.transactions.transferTo });
      return;
    }

    const item: NewOutboxItem = {
      clientGeneratedId: newClientId(),
      workspaceId: session.workspaceId,
      currency: session.currency,
      kind,
      amount,
      description: String(data.get("description") ?? "").trim(),
      occurredOn: String(data.get("occurredOn") ?? todayInZone(session.timezone)),
      categoryId,
      accountId: String(data.get("accountId") ?? ""),
      counterAccountId,
      contactId: null,
      paymentMethod: String(data.get("paymentMethod") ?? "cash") as NewOutboxItem["paymentMethod"],
      reference: String(data.get("reference") ?? "").trim() || null,
      attachment: null,
    };

    if (!item.accountId || item.description.length < 2) {
      setMessage({ tone: "error", text: dict.errors.generic });
      return;
    }

    setPending(true);
    try {
      await enqueueTransaction(session, item);
      await requestBackgroundSync();
      await syncOutbox(session);
      const saved = await getOutboxItem(item.clientGeneratedId);
      form.reset();
      setAmount("");

      if (saved?.status === "synced") {
        setMessage({ tone: "success", text: dict.pwa.offlineSavedSynced });
      } else if (saved?.status === "attention") {
        setMessage({ tone: "error", text: dict.pwa.syncNeedsAttention });
      } else if (saved?.status === "pending" || saved?.status === "failed" || saved?.status === "syncing") {
        setMessage({ tone: "success", text: dict.pwa.offlineSaved });
      } else {
        setMessage({ tone: "error", text: dict.errors.generic });
      }
    } catch {
      setMessage({ tone: "error", text: dict.errors.generic });
    } finally {
      setPending(false);
    }
  };

  if (loading) {
    return (
      <Card className="flex items-center gap-2 p-6 text-sm text-muted">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        {dict.common.loading}
      </Card>
    );
  }

  if (!session) {
    return (
      <Alert tone="warning">
        <span>
          {dict.pwa.offlineNoSession}
          {online ? (
            <>
              {" "}
              <Link href={`/${locale}/login`} className="font-semibold underline">
                {dict.auth.signIn}
              </Link>
            </>
          ) : null}
        </span>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="flex items-center gap-2 text-sm font-bold text-heading">
              <CloudOff className="h-4 w-4 text-accent-strong" aria-hidden />
              {session.workspaceName}
            </p>
            <p className="mt-0.5 text-xs text-muted">{dict.pwa.offlineCaptureHint}</p>
          </div>
          <Badge tone="mango">
            <WifiOff className="h-3 w-3" aria-hidden />
            {dict.pwa.offlineCapture}
          </Badge>
        </div>

        {accounts.length === 0 ? (
          <Alert tone="warning" className="mt-4">
            {dict.pwa.offlineNeedsSetup}
          </Alert>
        ) : (
          <form onSubmit={handleSubmit} className="mt-5 space-y-4" noValidate>
            {message ? <Alert tone={message.tone === "error" ? "error" : message.tone}>{message.text}</Alert> : null}

            <div className="grid grid-cols-3 gap-1 rounded-full bg-page-soft p-1">
              {(["income", "expense", "transfer"] as TransactionKind[]).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setKind(option)}
                  aria-pressed={kind === option}
                  className={
                    kind === option
                      ? "rounded-full bg-panel px-3 py-2 text-sm font-semibold text-heading shadow-sm"
                      : "rounded-full px-3 py-2 text-sm font-semibold text-muted"
                  }
                >
                  {option === "income"
                    ? dict.transactions.income
                    : option === "expense"
                      ? dict.transactions.expense
                      : dict.transactions.transfer}
                </button>
              ))}
            </div>

            <Field label={dict.transactions.amountLabel} htmlFor="offline-amount" hint={session.currency}>
              <Input
                id="offline-amount"
                inputMode="decimal"
                autoComplete="off"
                required
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="0"
                className="h-14 text-2xl font-semibold"
              />
            </Field>

            <Field label={dict.transactions.descriptionLabel} htmlFor="offline-description">
              <Input
                id="offline-description"
                name="description"
                required
                minLength={2}
                maxLength={500}
                placeholder={dict.transactions.descriptionPlaceholder}
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={dict.transactions.accountLabel} htmlFor="offline-account">
                <Select id="offline-account" name="accountId" defaultValue={accounts[0]?.id} required>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </Select>
              </Field>

              {kind === "transfer" ? (
                <Field label={dict.transactions.transferTo} htmlFor="offline-counter-account">
                  <Select id="offline-counter-account" name="counterAccountId" required>
                    {accounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name}
                      </option>
                    ))}
                  </Select>
                </Field>
              ) : (
                <Field label={dict.transactions.categoryLabel} htmlFor="offline-category">
                  <Select key={kind} id="offline-category" name="categoryId" required>
                    {visibleCategories.length === 0 ? <option value="">{dict.transactions.noCategories}</option> : null}
                    {visibleCategories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </Select>
                </Field>
              )}

              <Field label={dict.transactions.dateLabel} htmlFor="offline-date">
                <Input
                  id="offline-date"
                  name="occurredOn"
                  type="date"
                  required
                  defaultValue={todayInZone(session.timezone)}
                />
              </Field>

              <Field label={dict.transactions.paymentMethod} htmlFor="offline-payment">
                <Select id="offline-payment" name="paymentMethod" defaultValue="cash">
                  {(
                    [
                      ["cash", dict.transactions.cash],
                      ["mobile_money", dict.transactions.mobileMoney],
                      ["bank_transfer", dict.transactions.bankTransfer],
                      ["card", dict.transactions.card],
                      ["cheque", dict.transactions.cheque],
                      ["other", dict.transactions.other],
                    ] as const
                  ).map(([method, label]) => (
                    <option key={method} value={method}>
                      {label}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <Field label={`${dict.transactions.reference} · ${dict.common.optional}`} htmlFor="offline-reference">
              <Input id="offline-reference" name="reference" maxLength={120} autoComplete="off" />
            </Field>

            <Button type="submit" size="lg" disabled={pending} className="w-full sm:w-auto">
              {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Save className="h-4 w-4" aria-hidden />}
              {pending ? dict.transactions.saving : dict.transactions.save}
            </Button>
          </form>
        )}
      </Card>

      <OfflineOutboxPanel session={session} />
    </div>
  );
}
