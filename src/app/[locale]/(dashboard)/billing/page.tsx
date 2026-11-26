import type { Metadata } from "next";
import { Check, CreditCard, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { getSubscription, listPaymentTransactions } from "@/services/workspaces";
import { requireWorkspaceContext } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { resolveLocale, intlLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/server";
import { formatMoney, moneyLocale } from "@/lib/money";
import { formatDate, monthBounds } from "@/lib/dates";
import { PLAN_DEFINITIONS, planFor } from "@/lib/plans";
import { getServerEnv } from "@/lib/env";
import { cn } from "@/lib/utils";
import type { WorkspacePlan } from "@/types/database";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const dict = await getDictionary(resolveLocale((await params).locale));
  return { title: dict.nav.billing, robots: { index: false, follow: false } };
}

export default async function BillingPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = resolveLocale((await params).locale);
  const dict = await getDictionary(locale);
  const context = await requireWorkspaceContext(locale);
  const { workspace } = context;
  const supabase = await createClient();

  const { start } = monthBounds(new Date(), workspace.timezone);
  const [{ count: aiUsed }, subscription, payments] = await Promise.all([
    supabase
      .from("usage_events")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspace.id)
      .eq("kind", "ai_message")
      .gte("created_at", `${start}T00:00:00Z`),
    getSubscription(workspace.id),
    listPaymentTransactions(workspace.id),
  ]);

  const plan = planFor(workspace.plan);
  const supportEmail = getServerEnv().EMAIL_REPLY_TO;

  return (
    <div className="space-y-5">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight text-heading">
          <CreditCard className="h-6 w-6 text-accent-strong" aria-hidden />
          {dict.nav.billing}
        </h1>
        <p className="mt-1 text-sm text-muted">{dict.settings.currentPlan}</p>
      </header>

      <Card className="p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.1em] text-muted">
              {dict.settings.currentPlan}
            </p>
            <p className="mt-1 text-2xl font-extrabold text-heading">{dict.plans[workspace.plan]}</p>
            <p className="mt-1 text-sm text-muted">{dict.plans[workspace.plan === "scale" ? "scaleDesc" : workspace.plan === "growth" ? "growthDesc" : "starterDesc"]}</p>
          </div>
          <Badge tone="jade">{subscription?.status ?? "trialing"}</Badge>
        </div>

        <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-3">
          <div className="rounded-xl bg-page px-4 py-3">
            <dt className="text-[0.7rem] uppercase tracking-[0.08em] text-muted">{dict.settings.usage}</dt>
            <dd className="kpi-value mt-1 font-semibold text-heading">
              {aiUsed ?? 0} / {plan.aiMessagesPerMonth}
            </dd>
          </div>
          <div className="rounded-xl bg-page px-4 py-3">
            <dt className="text-[0.7rem] uppercase tracking-[0.08em] text-muted">{dict.settings.members}</dt>
            <dd className="kpi-value mt-1 font-semibold text-heading">{plan.seats}</dd>
          </div>
          <div className="rounded-xl bg-page px-4 py-3">
            <dt className="text-[0.7rem] uppercase tracking-[0.08em] text-muted">{dict.plans.current}</dt>
            <dd className="kpi-value mt-1 font-semibold text-heading">
              {plan.priceMinor === 0 ? dict.common.free : formatMoney(BigInt(plan.priceMinor), "XAF", moneyLocale(locale, "XAF"))}
            </dd>
          </div>
        </dl>

        {subscription?.trial_ends_at ? (
          <p className="mt-3 text-xs text-muted">
            {formatDate(subscription.trial_ends_at, intlLocale(locale), workspace.timezone)}
          </p>
        ) : null}
      </Card>

      <section className="grid gap-3 md:grid-cols-3" aria-label={dict.nav.billing}>
        {(Object.keys(PLAN_DEFINITIONS) as WorkspacePlan[]).map((planId) => {
          const definition = PLAN_DEFINITIONS[planId];
          const current = planId === workspace.plan;
          return (
            <Card key={planId} className={cn("flex flex-col p-5", current && "border-jade-400 ring-2 ring-jade-200")}>
              <div className="flex items-center justify-between">
                <p className="text-sm font-extrabold text-heading">{dict.plans[planId]}</p>
                {current ? <Badge tone="jade">{dict.plans.current}</Badge> : null}
              </div>
              <p className="mt-1 text-xs text-muted">
                {dict.plans[planId === "scale" ? "scaleDesc" : planId === "growth" ? "growthDesc" : "starterDesc"]}
              </p>
              <p className="kpi-value mt-4 text-xl font-semibold text-heading">
                {definition.priceMinor === 0
                  ? dict.common.free
                  : formatMoney(BigInt(definition.priceMinor), "XAF", moneyLocale(locale, "XAF"))}
                {definition.priceMinor > 0 ? (
                  <span className="text-xs font-medium text-muted">{dict.common.perMonth}</span>
                ) : null}
              </p>
              <ul className="mt-4 space-y-2 text-xs text-muted">
                <li className="flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-accent-strong" aria-hidden />
                  {definition.aiMessagesPerMonth} {dict.settings.usage.toLowerCase()}
                </li>
                <li className="flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-accent-strong" aria-hidden />
                  {definition.seats} {dict.settings.members.toLowerCase()}
                </li>
                <li className="flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-mango-500" aria-hidden />
                  {dict.assistant.title}
                </li>
              </ul>
              <div className="mt-auto pt-4">
                {supportEmail && !current ? (
                  <a
                    href={`mailto:${supportEmail}?subject=${encodeURIComponent(`Plan change: ${workspace.name}`)}`}
                    className={buttonVariants({ variant: "secondary", size: "sm", className: "w-full justify-center" })}
                  >
                    {dict.plans.contactUs}
                  </a>
                ) : (
                  <span className="text-[0.7rem] text-muted">{current ? dict.plans.current : dict.plans.contactUs}</span>
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
                    <Badge tone="outline" className="text-[0.6rem]">
                      {payment.status}
                    </Badge>
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
