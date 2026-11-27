import type { Metadata } from "next";
import Link from "next/link";
import { BarChart3, ChevronRight, Download, FileText, History, MessageCircle, ShieldCheck, Smartphone, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { LinkChannelForm, WorkspaceSettingsForm } from "@/components/forms/workspace-settings-form";
import { AiSettingsForm } from "@/components/forms/ai-settings-form";
import { AiAdvisorSettingsForm } from "@/components/forms/ai-advisor-settings-form";
import { ReportPreferencesForm } from "@/components/forms/report-preferences-form";
import { getAiSettings } from "@/services/ai-commands";
import { getAiPreferences } from "@/services/ai-preferences";
import { getSubscription, listAuditLogs, listChannelIdentities } from "@/services/workspaces";
import { requireWorkspaceContext } from "@/lib/supabase/auth";
import { resolveLocale, intlLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/server";
import { interpolate } from "@/lib/i18n/interpolate";
import { formatDateTime, addDays, formatDate, todayInZone } from "@/lib/dates";
import { getServerEnv } from "@/lib/env";
import { getWorkspaceEntitlements } from "@/lib/entitlements/service";
import { getReportPreferences, getVerifiedWhatsappAddress, listReportDeliveries } from "@/services/report-preferences";
import { unlinkChannelAction } from "./actions";

function trialDaysRemaining(endsAt: string | null): number | null {
  if (!endsAt) return null;
  return Math.max(0, Math.ceil((new Date(endsAt).getTime() - Date.now()) / 86_400_000));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const dict = await getDictionary(resolveLocale((await params).locale));
  return { title: dict.settings.title, robots: { index: false, follow: false } };
}

export default async function SettingsPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = resolveLocale((await params).locale);
  const dict = await getDictionary(locale);
  const context = await requireWorkspaceContext(locale);
  const { workspace } = context;
  const whatsappNumber = getServerEnv().WHATSAPP_DISPLAY_PHONE_NUMBER ?? null;
  const ussdServiceCode = getServerEnv().USSD_SERVICE_CODE ?? null;

  const canEdit = context.can("workspace:update");
  const canIntegrate = context.can("integrations:manage");
  const canAudit = context.can("audit:read");
  const canExport = context.can("reports:export");
  const isOwner = context.role === "owner";

  const [identities, audit, aiSettings, aiPreferences, reportPreferences, whatsappAddress, reportDeliveries, entitlements, subscription] =
    await Promise.all([
      canIntegrate ? listChannelIdentities(workspace.id) : Promise.resolve([]),
      canAudit ? listAuditLogs(workspace.id, 25) : Promise.resolve([]),
      getAiSettings(workspace.id),
      getAiPreferences(workspace.id),
      getReportPreferences(workspace.id, context.user.id),
      getVerifiedWhatsappAddress(workspace.id, context.user.id).catch(() => null),
      listReportDeliveries(workspace.id, 8).catch(() => []),
      getWorkspaceEntitlements(workspace.id, context.user.id),
      getSubscription(workspace.id),
    ]);

  const analysisToDate = todayInZone(workspace.timezone);
  const analysisFromDate = addDays(analysisToDate, -(aiPreferences.analysisWindowDays - 1));
  const analysisFrom = formatDate(analysisFromDate, intlLocale(locale), workspace.timezone, {
    day: "2-digit",
    month: "short",
    year: undefined,
  });
  const analysisTo = formatDate(analysisToDate, intlLocale(locale), workspace.timezone, {
    day: "2-digit",
    month: "short",
    year: undefined,
  });

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-heading">{dict.settings.title}</h1>
          <p className="mt-1 text-sm text-muted">{dict.settings.subtitle}</p>
        </div>
        <Badge tone="outline">{dict.plans[workspace.plan]}</Badge>
      </header>

      <Link
        href={`/${locale}/settings/security`}
        className="surface flex items-center gap-3 p-4 transition hover:border-accent-strong/40 sm:p-5"
      >
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-strong">
          <ShieldCheck className="h-5 w-5" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold text-heading">{dict.identity.securityTitle}</span>
          <span className="mt-0.5 block text-xs text-muted">{dict.identity.securitySubtitle}</span>
        </span>
        <ChevronRight className="h-4 w-4 text-muted" aria-hidden />
      </Link>

      <Card className="p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-heading">{dict.dashboard.subscriptionTitle}</h2>
            <p className="mt-0.5 text-xs text-muted">{dict.dashboard.planLabel}: {dict.plans[workspace.plan]}</p>
          </div>
          <Badge tone={subscription?.status === "active" || subscription?.status === "trialing" ? "jade" : "clay"}>
            {subscription?.status ?? "—"}
          </Badge>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted">
          {subscription?.trial_ends_at ? (
            <span>
              {interpolate(
                dict.dashboard.trialRemaining,
                { days: trialDaysRemaining(subscription.trial_ends_at) ?? 0 },
                { locale: intlLocale(locale) },
              )}
            </span>
          ) : subscription?.current_period_end ? (
            <span>{dict.dashboard.manageSubscription}: {formatDate(subscription.current_period_end, intlLocale(locale))}</span>
          ) : null}
          <Link href={`/${locale}/billing`} className="font-bold text-accent hover:underline">
            {dict.dashboard.manageSubscription}
          </Link>
        </div>
      </Card>

      <Card className="p-5 sm:p-6">
        <h2 className="text-base font-bold text-heading">{dict.settings.businessProfile}</h2>
        <div className="mt-4">
          <WorkspaceSettingsForm
            name={workspace.name}
            legalName={workspace.legal_name ?? ""}
            currency={workspace.currency}
            country={workspace.country_code}
            timezone={workspace.timezone}
            disabled={!canEdit}
          />
        </div>
      </Card>

      {canExport ? (
        <Card className="p-5 sm:p-6">
          <div className="flex items-start gap-2">
            <Download className="mt-0.5 h-4 w-4 shrink-0 text-accent-strong" aria-hidden />
            <div>
              <h2 className="text-sm font-bold text-heading">{dict.settings.dataTitle}</h2>
              <p className="mt-0.5 text-xs text-muted">{dict.settings.dataSubtitle}</p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <a href={`/api/transactions/export?locale=${locale}`} className={buttonVariants({ variant: "secondary", size: "sm" })}>
              <Download className="h-4 w-4" aria-hidden />
              {dict.settings.downloadCsv}
            </a>
            <a href={`/api/transactions/export/pdf?locale=${locale}`} className={buttonVariants({ variant: "secondary", size: "sm" })}>
              <FileText className="h-4 w-4" aria-hidden />
              {dict.settings.downloadPdf}
            </a>
          </div>
          <p className="mt-3 text-[0.7rem] text-muted">{dict.settings.dataNote}</p>
        </Card>
      ) : null}

      {canEdit ? (
        <Card className="p-5 sm:p-6">
          <div className="flex items-start gap-2">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-accent-strong" aria-hidden />
            <div>
              <h2 className="text-sm font-bold text-heading">{dict.settings.aiTitle}</h2>
              <p className="mt-0.5 text-xs text-muted">{dict.settings.aiSubtitle}</p>
            </div>
          </div>
          <div className="mt-4">
            <AiSettingsForm
              autoPost={aiSettings.autoPost}
              maxMinor={aiSettings.autoPostMaxMinor}
              currency={workspace.currency}
              disabled={!canEdit}
            />
          </div>
        </Card>
      ) : null}

      {canEdit ? (
        <Card id="ai-advisor" className="p-5 sm:p-6">
          <div className="flex items-start gap-2">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent-strong" aria-hidden />
            <div>
              <h2 className="text-sm font-bold text-heading">{dict.settings.aiAdvisorTitle}</h2>
              <p className="mt-0.5 text-xs text-muted">{dict.settings.aiAdvisorSubtitle}</p>
            </div>
          </div>
          <div className="mt-4">
            <AiAdvisorSettingsForm
              preferences={aiPreferences}
              analysisFrom={analysisFrom}
              analysisTo={analysisTo}
              disabled={!isOwner}
              isOwner={isOwner}
            />
          </div>
        </Card>
      ) : null}

      <Card id="reports" className="p-5 sm:p-6">
        <div className="flex items-start gap-2">
          <BarChart3 className="mt-0.5 h-4 w-4 shrink-0 text-accent-strong" aria-hidden />
          <div>
            <h2 className="text-sm font-bold text-heading">{dict.settings.reportsTitle}</h2>
            <p className="mt-0.5 text-xs text-muted">{dict.settings.reportsSubtitle}</p>
          </div>
        </div>
        <div className="mt-4">
          <ReportPreferencesForm
            preferences={reportPreferences}
            whatsappLinked={Boolean(whatsappAddress)}
            whatsappAllowed={entitlements.features.whatsapp_integration.included}
          />
        </div>

        <div className="mt-6 border-t border-line/70 pt-4">
          <h3 className="text-xs font-bold uppercase tracking-[0.08em] text-muted">
            {dict.settings.reportsDeliveryLog}
          </h3>
          <p className="mt-1 text-xs text-muted">{dict.settings.reportsDeliveryLogHelp}</p>
          {reportDeliveries.length === 0 ? (
            <p className="mt-3 text-sm text-muted">{dict.settings.reportsNoDeliveries}</p>
          ) : (
            <ul className="mt-3 divide-y divide-line/70">
              {reportDeliveries.map((delivery) => (
                <li key={delivery.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-xs">
                  <span className="font-semibold text-heading">
                    {delivery.kind === "daily"
                      ? dict.settings.reportsKindDaily
                      : delivery.kind === "weekly"
                        ? dict.settings.reportsKindWeekly
                        : dict.settings.reportsKindMonthly}
                  </span>
                  <span className="text-muted">
                    {formatDate(delivery.report_date, intlLocale(locale), workspace.timezone)}
                  </span>
                  <span className="text-muted">
                    {delivery.channel === "email"
                      ? dict.settings.reportsChannelEmail
                      : delivery.channel === "whatsapp"
                        ? dict.settings.reportsChannelWhatsapp
                        : dict.settings.reportsChannelInApp}
                  </span>
                  <span className="ml-auto font-semibold">
                    {delivery.status === "sent"
                      ? dict.settings.reportsStatusSent
                      : delivery.status === "failed"
                        ? dict.settings.reportsStatusFailed
                        : delivery.status === "skipped"
                          ? dict.settings.reportsStatusSkipped
                          : dict.settings.reportsStatusSending}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>

      <Card className="p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-heading">{dict.settings.channels}</h2>
            <p className="mt-0.5 text-xs text-muted">{dict.settings.channelsSubtitle}</p>
          </div>
          <Badge tone="jade">{dict.dashboard.channels}</Badge>
        </div>

        <div className="mt-4">
          <LinkChannelForm disabled={!canIntegrate} businessNumber={whatsappNumber} ussdServiceCode={ussdServiceCode} />
        </div>

        {identities.length > 0 ? (
          <ul className="mt-4 divide-y divide-line/70">
            {identities.map((identity) => (
              <li key={identity.id} className="flex items-center gap-3 py-2.5">
                {identity.channel === "whatsapp" ? (
                  <MessageCircle className="h-4 w-4 text-accent-strong" aria-hidden />
                ) : (
                  <Smartphone className="h-4 w-4 text-accent-strong" aria-hidden />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-heading">{identity.address}</p>
                  <p className="text-[0.7rem] text-muted">
                    {identity.channel === "whatsapp" ? dict.transactions.channelWhatsapp : dict.transactions.channelUssd}
                    {` · ${identity.verified_at ? dict.settings.channelVerified : dict.settings.channelPending}`}
                    {identity.verified_at
                      ? ` · ${formatDateTime(identity.verified_at, intlLocale(locale), workspace.timezone)}`
                      : ""}
                  </p>
                </div>
                {!identity.verified_at ? (
                  <Badge tone="mango">{dict.settings.channelPending}</Badge>
                ) : null}
                {canIntegrate ? (
                  <form action={unlinkChannelAction}>
                    <input type="hidden" name="locale" value={locale} />
                    <input type="hidden" name="channelId" value={identity.id} />
                    <Button type="submit" variant="ghost" size="sm" className="text-xs text-danger">
                      {dict.settings.removeMember}
                    </Button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
      </Card>

      {canAudit ? (
        <Card className="p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-accent-strong" aria-hidden />
            <div>
              <h2 className="text-sm font-bold text-heading">{dict.settings.audit}</h2>
              <p className="text-xs text-muted">{dict.settings.auditSubtitle}</p>
            </div>
          </div>

          {audit.length === 0 ? (
            <p className="mt-4 text-sm text-muted">{dict.settings.noAudit}</p>
          ) : (
            <ul className="mt-4 divide-y divide-line/70">
              {audit.map((entry) => (
                <li key={entry.id} className="flex items-start justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-heading">
                      {entry.action} · {entry.entity}
                    </p>
                    <p className="text-[0.7rem] text-muted">
                      {formatDateTime(entry.created_at, intlLocale(locale), workspace.timezone)} · {entry.actor_type}
                    </p>
                  </div>
                  <Badge tone="outline" className="shrink-0 text-[0.6rem]">
                    {entry.actor_type}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : null}

      <Card className="p-5">
        <h2 className="text-sm font-bold text-heading">{dict.settings.billing}</h2>
        <p className="mt-1 text-xs text-muted">
          {dict.nav.billing} · {dict.plans[workspace.plan]}
        </p>
        <Link
          href={`/${locale}/billing`}
          className="mt-3 inline-flex text-sm font-semibold text-accent hover:underline"
        >
          {dict.settings.currentPlan} →
        </Link>
      </Card>
    </div>
  );
}
