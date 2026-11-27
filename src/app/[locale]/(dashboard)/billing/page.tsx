import type { Metadata } from "next";
import { Check, CreditCard, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { PaymentCheckout, PaymentReturnPoller } from "@/components/billing/payment-checkout";
import { getSubscription } from "@/services/workspaces";
import { listPaymentHistory } from "@/services/payments";
import { getPlanCatalogue } from "@/services/plans";
import { requireWorkspaceContext } from "@/lib/supabase/auth";
import { resolveLocale, intlLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/server";
import { interpolate } from "@/lib/i18n/interpolate";
import { getWorkspaceEntitlements } from "@/lib/entitlements/service";
import { formatMoney, moneyLocale } from "@/lib/money";
import { formatDate } from "@/lib/dates";
import { getServerEnv } from "@/lib/env";
import { can } from "@/lib/permissions";
import { demoPaymentEnabled } from "@/lib/payments/config";
import { getConfiguredPaymentProviders } from "@/lib/payments/registry";
import { PAYMENT_PROVIDER_LABELS, type PaymentProviderId } from "@/lib/payments/types";
import { cn } from "@/lib/utils";
import type { PlanCatalogueEntry } from "@/types/entitlements";
import type { PaymentCopy } from "@/types/payments";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const dict = await getDictionary(resolveLocale((await params).locale));
  return { title: dict.nav.billing, robots: { index: false, follow: false } };
}

function planHighlights(plan: PlanCatalogueEntry, dict: Awaited<ReturnType<typeof getDictionary>>) {
  const included = new Set(plan.features.filter((feature) => feature.included).map((feature) => feature.code));
  const rows: string[] = [];
  rows.push(
    plan.transactionLimit
      ? interpolate(dict.plans.transactionsPerMonth, { count: plan.transactionLimit.toLocaleString() })
      : dict.plans.unlimitedTransactions,
  );
  rows.push(interpolate(dict.plans.seatsIncluded, { count: plan.seats }));
  rows.push(
    included.has("ai_bookkeeping")
      ? interpolate(dict.plans.aiMessagesIncluded, { count: plan.aiMessageLimit.toLocaleString() })
      : dict.plans.noAi,
  );
  for (const feature of plan.features.filter((entry) => entry.included && entry.code !== "team_members")) {
    const label = dict.plans.featureNames[feature.code as keyof typeof dict.plans.featureNames];
    if (label && !rows.includes(label)) rows.push(label);
    if (rows.length >= 6) break;
  }
  return rows.slice(0, 6);
}

export default async function BillingPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ payment?: string | string[] }>;
}) {
  const locale = resolveLocale((await params).locale);
  const dict = await getDictionary(locale);
  const context = await requireWorkspaceContext(locale);
  const { workspace } = context;
  const requestedPayment = (await searchParams).payment;
  const paymentReturnId = typeof requestedPayment === "string" ? requestedPayment : null;

  const canPay = can(context.role, "billing:manage");
  const [entitlements, subscription, payments, plans] = await Promise.all([
    getWorkspaceEntitlements(workspace.id, context.user.id),
    getSubscription(workspace.id),
    canPay ? listPaymentHistory(workspace.id) : Promise.resolve([]),
    getPlanCatalogue(),
  ]);
  const providers = getConfiguredPaymentProviders().map((provider) => ({
    id: provider.id,
    label: provider.label,
    configured: provider.configured,
  }));

  const paymentCopy: PaymentCopy = {
    payWith: dict.plans.payWith,
    phone: dict.plans.phone,
    phoneHint: dict.plans.phoneHint,
    payButton: dict.plans.payButton,
    starting: dict.plans.starting,
    secure: dict.plans.secure,
    notConfigured: dict.plans.notConfigured,
    noProviders: dict.plans.noProviders,
    pending: dict.plans.pending,
    instructions: dict.plans.instructions,
    openProvider: dict.plans.openProvider,
    success: dict.plans.success,
    failed: dict.plans.failed,
    expired: dict.plans.expired,
    retry: dict.plans.retry,
    statusLabel: dict.plans.statusLabel,
    reference: dict.plans.reference,
    providerLabel: dict.plans.providerLabel,
    statusPending: dict.plans.statusPending,
    statusProcessing: dict.plans.statusProcessing,
    statusSucceeded: dict.plans.statusSucceeded,
    statusFailed: dict.plans.statusFailed,
    statusExpired: dict.plans.statusExpired,
    statusRefunded: dict.plans.statusRefunded,
    statusReversed: dict.plans.statusReversed,
    errorGeneric: dict.plans.errorGeneric,
  };

  const supportEmail = getServerEnv().EMAIL_REPLY_TO;
  const trialCopy = entitlements.trial.active
    ? interpolate(dict.plans.trialActive, {
        days: entitlements.trial.daysRemaining ?? 0,
        plan: entitlements.trial.planName ?? entitlements.planName,
      })
    : entitlements.trial.expired
      ? dict.plans.trialEnded
      : null;

  return (
    <div className="space-y-5">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight text-heading">
          <CreditCard className="h-6 w-6 text-accent-strong" aria-hidden />
          {dict.nav.billing}
        </h1>
        <p className="mt-1 text-sm text-muted">{dict.settings.currentPlan}</p>
      </header>

      {demoPaymentEnabled() ? (
        <Alert tone="info">{dict.plans.sandboxNotice}</Alert>
      ) : null}

      {paymentReturnId && canPay ? (
        <Card className="p-5 sm:p-6">
          <h2 className="mb-2 text-sm font-bold text-heading">{dict.nav.billing}</h2>
          <PaymentReturnPoller paymentId={paymentReturnId} copy={paymentCopy} />
        </Card>
      ) : null}

      <Card className="p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.1em] text-muted">
              {dict.settings.currentPlan}
            </p>
            <p className="mt-1 text-2xl font-extrabold text-heading">{entitlements.planName}</p>
            <p className="mt-1 text-sm text-muted">{entitlements.planDescription}</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Badge tone="jade">{entitlements.trial.active ? "trial" : entitlements.status}</Badge>
            {trialCopy ? <p className="max-w-xs text-right text-xs text-muted">{trialCopy}</p> : null}
            {entitlements.readOnly ? <p className="max-w-xs text-right text-xs text-warn">{dict.plans.readOnly}</p> : null}
          </div>
        </div>

        <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl bg-page px-4 py-3">
            <dt className="text-[0.7rem] uppercase tracking-[0.08em] text-muted">{dict.settings.usage}</dt>
            <dd className="kpi-value mt-1 font-semibold text-heading">
              {entitlements.usage.aiMessagesThisMonth} / {entitlements.limits.aiMessagesPerMonth ?? "∞"}
            </dd>
          </div>
          <div className="rounded-xl bg-page px-4 py-3">
            <dt className="text-[0.7rem] uppercase tracking-[0.08em] text-muted">{dict.settings.members}</dt>
            <dd className="kpi-value mt-1 font-semibold text-heading">
              {entitlements.usage.activeMembers} / {entitlements.limits.seats ?? "∞"}
            </dd>
          </div>
          <div className="rounded-xl bg-page px-4 py-3">
            <dt className="text-[0.7rem] uppercase tracking-[0.08em] text-muted">{dict.plans.transactions}</dt>
            <dd className="kpi-value mt-1 font-semibold text-heading">
              {entitlements.usage.transactionsThisMonth} / {entitlements.limits.transactionsPerMonth ?? "∞"}
            </dd>
          </div>
          <div className="rounded-xl bg-page px-4 py-3">
            <dt className="text-[0.7rem] uppercase tracking-[0.08em] text-muted">{dict.plans.price}</dt>
            <dd className="kpi-value mt-1 font-semibold text-heading">
              {entitlements.priceMinor === 0
                ? dict.common.free
                : formatMoney(BigInt(entitlements.priceMinor), entitlements.currency, moneyLocale(locale, entitlements.currency))}
            </dd>
          </div>
        </dl>

        {subscription?.current_period_end ? (
          <p className="mt-3 text-xs text-muted">
            {dict.plans.renewsOn}: {formatDate(subscription.current_period_end, intlLocale(locale), workspace.timezone)}
          </p>
        ) : null}
      </Card>

      <section className="grid gap-3 md:grid-cols-3" aria-label={dict.nav.billing}>
        {plans.map((plan) => {
          const current = plan.code === entitlements.planCode;
          return (
            <Card key={plan.code} className={cn("flex flex-col p-5", current && "border-jade-400 ring-2 ring-jade-200")}>
              <div className="flex items-center justify-between">
                <p className="text-sm font-extrabold text-heading">{plan.name}</p>
                {current ? <Badge tone="jade">{dict.plans.current}</Badge> : null}
              </div>
              <p className="mt-1 text-xs text-muted">{plan.description}</p>
              <p className="kpi-value mt-4 text-xl font-semibold text-heading">
                {plan.priceMinor === 0
                  ? dict.common.free
                  : formatMoney(BigInt(plan.priceMinor), plan.currency, moneyLocale(locale, plan.currency))}
                {plan.priceMinor > 0 ? (
                  <span className="text-xs font-medium text-muted">{dict.common.perMonth}</span>
                ) : null}
              </p>
              <ul className="mt-4 space-y-2 text-xs text-muted">
                {planHighlights(plan, dict).map((row) => (
                  <li key={row} className="flex items-start gap-1.5">
                    {row === dict.plans.noAi ? (
                      <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-mango-500" aria-hidden />
                    ) : (
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent-strong" aria-hidden />
                    )}
                    {row}
                  </li>
                ))}
              </ul>
              <div className="mt-auto pt-4">
                {current ? (
                  <span className="text-[0.7rem] text-muted">{dict.plans.current}</span>
                ) : canPay && plan.priceMinor > 0 ? (
                  <PaymentCheckout
                    planCode={plan.code}
                    planName={plan.name}
                    amountMinor={plan.priceMinor}
                    currency={plan.currency}
                    providers={providers}
                    defaultPhone={context.profile.phone ?? workspace.phone}
                    locale={locale}
                    copy={paymentCopy}
                  />
                ) : supportEmail ? (
                  <a
                    href={`mailto:${supportEmail}?subject=${encodeURIComponent(`Plan change: ${workspace.name} → ${plan.name}`)}`}
                    className="text-[0.7rem] text-muted underline"
                  >
                    {dict.plans.contactUs}
                  </a>
                ) : (
                  <span className="text-[0.7rem] text-muted">{dict.plans.contactUs}</span>
                )}
              </div>
            </Card>
          );
        })}
      </section>

      <Card className="overflow-hidden">
        <div className="px-4 py-4 sm:px-5">
          <h2 className="text-sm font-bold text-heading">{dict.settings.billing}</h2>
        </div>
        {payments.length === 0 ? (
          <p className="px-4 pb-4 text-sm text-muted sm:px-5">{dict.common.noData}</p>
        ) : (
          <table className="w-full text-sm">
            <caption className="sr-only">{dict.nav.billing}</caption>
            <thead className="bg-page text-left text-[0.65rem] uppercase tracking-[0.08em] text-muted">
              <tr>
                <th scope="col" className="px-4 py-2 font-semibold sm:px-5">
                  {dict.common.date}
                </th>
                <th scope="col" className="px-4 py-2 font-semibold">
                  {dict.settings.plan}
                </th>
                <th scope="col" className="px-4 py-2 font-semibold">
                  {dict.plans.providerLabel}
                </th>
                <th scope="col" className="px-4 py-2 text-right font-semibold sm:px-5">
                  {dict.common.amount}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/70">
              {payments.map((payment) => (
                <tr key={payment.id}>
                  <td className="px-4 py-2.5 text-xs text-muted sm:px-5">
                    {formatDate(payment.created_at, intlLocale(locale), workspace.timezone)}
                  </td>
                  <td className="px-4 py-2.5 text-xs">
                    <p className="font-semibold text-heading">{payment.plan_code ?? "—"}</p>
                    <Badge tone="outline" className="mt-1 text-[0.6rem]">
                      {payment.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted">
                    {PAYMENT_PROVIDER_LABELS[payment.provider as PaymentProviderId] ?? payment.provider}
                  </td>
                  <td className="kpi-value px-4 py-2.5 text-right text-xs text-heading sm:px-5">
                    {formatMoney(BigInt(payment.amount_minor), payment.currency, moneyLocale(locale, payment.currency))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
