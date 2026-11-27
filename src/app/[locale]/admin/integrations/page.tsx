import type { Metadata } from "next";
import { Activity, PlugZap } from "lucide-react";
import { AdminEmpty, AdminPageHeader, AdminSection } from "@/components/admin/admin-ui";
import { Badge } from "@/components/ui/badge";
import { intlLocale, resolveLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/server";
import { formatDateTime } from "@/lib/dates";
import { requirePlatformAdmin } from "@/lib/platform-admin";
import { getPlatformIntegrationStatus } from "@/services/platform-admin";

export const metadata: Metadata = {
  title: "Integrations",
  robots: { index: false, follow: false },
};

type Config = {
  key: string;
  label: string;
  env: string[];
  configured: boolean;
};

export default async function AdminIntegrationsPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = resolveLocale((await params).locale);
  const dict = await getDictionary(locale);
  const copy = dict.admin;
  await requirePlatformAdmin(locale);
  const status = await getPlatformIntegrationStatus();

  const configs: Config[] = [
    {
      key: "resend",
      label: copy.resend,
      env: ["RESEND_API_KEY", "EMAIL_FROM"],
      configured: Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM),
    },
    {
      key: "openai",
      label: copy.openai,
      env: ["OPENAI_API_KEY", "OPENAI_MODEL"],
      configured: Boolean(process.env.OPENAI_API_KEY),
    },
    {
      key: "whatsapp",
      label: copy.whatsapp,
      env: ["WHATSAPP_PHONE_NUMBER_ID", "WHATSAPP_ACCESS_TOKEN", "WHATSAPP_VERIFY_TOKEN", "WHATSAPP_APP_SECRET"],
      configured: Boolean(
        process.env.WHATSAPP_PHONE_NUMBER_ID &&
          process.env.WHATSAPP_ACCESS_TOKEN &&
          process.env.WHATSAPP_VERIFY_TOKEN &&
          process.env.WHATSAPP_APP_SECRET,
      ),
    },
    {
      key: "ussd",
      label: copy.africasTalking,
      env: ["AFRICASTALKING_USERNAME", "AFRICASTALKING_API_KEY", "USSD_SERVICE_CODE", "USSD_CALLBACK_TOKEN"],
      configured: Boolean(
        process.env.AFRICASTALKING_USERNAME &&
          process.env.AFRICASTALKING_API_KEY &&
          process.env.USSD_SERVICE_CODE &&
          process.env.USSD_CALLBACK_TOKEN,
      ),
    },
    {
      key: "payments",
      label: copy.paymentProvider,
      env: ["PAYMENT_PROVIDER", "PAYMENT_MODE", "PAYMENT_WEBHOOK_SECRET"],
      configured:
        Boolean(process.env.PAYMENT_PROVIDER && process.env.PAYMENT_PROVIDER !== "none") &&
        Boolean(process.env.PAYMENT_MODE && process.env.PAYMENT_MODE !== "disabled"),
    },
  ];

  return (
    <div className="space-y-5">
      <AdminPageHeader eyebrow={copy.integrations} title={copy.integrationsTitle} lead={copy.integrationsLead} icon={PlugZap} badge={configs.filter((item) => item.configured).length} />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {configs.map((item) => (
          <article key={item.key} className="rounded-2xl border border-black/8 bg-white p-4">
            <div className="flex items-start justify-between gap-2">
              <h2 className="text-sm font-extrabold text-[#151c19]">{item.label}</h2>
              <Badge tone={item.configured ? "jade" : "clay"}>{item.configured ? copy.configured : copy.notConfigured}</Badge>
            </div>
            <p className="mt-2 text-[0.65rem] font-bold uppercase tracking-[0.12em] text-[#151c19]/35">{copy.requiredEnv}</p>
            <p className="mt-1 break-words font-mono text-[0.65rem] leading-relaxed text-[#151c19]/55">{item.env.join(" · ")}</p>
          </article>
        ))}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <AdminSection title={copy.integrationAccounts} description={copy.environment}>
          {status.accounts.length === 0 ? (
            <AdminEmpty>—</AdminEmpty>
          ) : (
            <ul className="divide-y divide-black/8">
              {status.accounts.map((account) => (
                <li key={account.provider} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold capitalize text-[#151c19]">{account.provider}</p>
                    <p className="mt-0.5 text-xs text-[#151c19]/50">
                      {account.active_count} {copy.active.toLowerCase()} · {account.error_count} {copy.errors.toLowerCase()}
                      {account.last_synced_at ? ` · ${formatDateTime(account.last_synced_at, intlLocale(locale))}` : ""}
                    </p>
                  </div>
                  <Badge tone={account.error_count ? "clay" : "jade"}>{account.account_count}</Badge>
                </li>
              ))}
            </ul>
          )}
        </AdminSection>

        <AdminSection title={copy.webhookFailures} description={copy.messageFailures}>
          {status.webhook_failures.length === 0 && status.message_failures.length === 0 ? (
            <AdminEmpty>{copy.noIntegrationFailures}</AdminEmpty>
          ) : (
            <div className="space-y-4">
              {status.message_failures.map((failure) => (
                <div key={failure.provider} className="flex items-center justify-between rounded-xl bg-[#fbeee9] px-3 py-2">
                  <span className="text-sm font-semibold capitalize text-[#8b2d18]">{failure.provider}</span>
                  <span className="text-sm font-extrabold text-[#8b2d18]">{failure.failed_count}</span>
                </div>
              ))}
              {status.webhook_failures.length > 0 ? (
                <ul className="divide-y divide-black/8">
                  {status.webhook_failures.map((failure, index) => (
                    <li key={`${failure.provider}-${failure.external_id ?? index}`} className="py-2.5">
                      <p className="flex items-center gap-2 text-xs font-bold capitalize text-[#151c19]">
                        <Activity className="h-3.5 w-3.5 text-[#b4552d]" aria-hidden />
                        {failure.provider}
                      </p>
                      <p className="mt-1 break-words text-[0.68rem] text-[#8b2d18]">{failure.error ?? "—"}</p>
                      <p className="mt-0.5 text-[0.62rem] text-[#151c19]/40">{formatDateTime(failure.received_at, intlLocale(locale))}</p>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          )}
        </AdminSection>
      </div>
    </div>
  );
}
