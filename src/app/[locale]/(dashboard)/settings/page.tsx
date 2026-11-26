import type { Metadata } from "next";
import Link from "next/link";
import { History, MessageCircle, Smartphone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LinkChannelForm, WorkspaceSettingsForm } from "@/components/forms/workspace-settings-form";
import { listAuditLogs, listChannelIdentities } from "@/services/workspaces";
import { requireWorkspaceContext } from "@/lib/supabase/auth";
import { resolveLocale, intlLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/server";
import { formatDateTime } from "@/lib/dates";
import { unlinkChannelAction } from "./actions";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const dict = await getDictionary(resolveLocale((await params).locale));
  return { title: dict.settings.title, robots: { index: false, follow: false } };
}

export default async function SettingsPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = resolveLocale((await params).locale);
  const dict = await getDictionary(locale);
  const context = await requireWorkspaceContext(locale);
  const { workspace } = context;

  const canEdit = context.can("workspace:update");
  const canIntegrate = context.can("integrations:manage");
  const canAudit = context.can("audit:read");

  const [identities, audit] = await Promise.all([
    canIntegrate ? listChannelIdentities(workspace.id) : Promise.resolve([]),
    canAudit ? listAuditLogs(workspace.id, 25) : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-forest">{dict.settings.title}</h1>
          <p className="mt-1 text-sm text-muted">{dict.settings.subtitle}</p>
        </div>
        <Badge tone="outline">{dict.plans[workspace.plan]}</Badge>
      </header>

      <Card className="p-5 sm:p-6">
        <h2 className="text-base font-bold text-forest">{dict.settings.businessProfile}</h2>
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

      <Card className="p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-forest">{dict.settings.channels}</h2>
            <p className="mt-0.5 text-xs text-muted">{dict.settings.channelsSubtitle}</p>
          </div>
          <Badge tone="jade">{dict.dashboard.channels}</Badge>
        </div>

        <div className="mt-4">
          <LinkChannelForm disabled={!canIntegrate} />
        </div>

        {identities.length > 0 ? (
          <ul className="mt-4 divide-y divide-line/70">
            {identities.map((identity) => (
              <li key={identity.id} className="flex items-center gap-3 py-2.5">
                {identity.channel === "whatsapp" ? (
                  <MessageCircle className="h-4 w-4 text-jade-600" aria-hidden />
                ) : (
                  <Smartphone className="h-4 w-4 text-jade-600" aria-hidden />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-forest">{identity.address}</p>
                  <p className="text-[0.7rem] text-muted">
                    {identity.channel === "whatsapp" ? dict.transactions.channelWhatsapp : dict.transactions.channelUssd}
                    {identity.verified_at ? ` · ${formatDateTime(identity.verified_at, intlLocale(locale), workspace.timezone)}` : ""}
                  </p>
                </div>
                {canIntegrate ? (
                  <form action={unlinkChannelAction}>
                    <input type="hidden" name="locale" value={locale} />
                    <input type="hidden" name="channelId" value={identity.id} />
                    <Button type="submit" variant="ghost" size="sm" className="text-xs text-clay">
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
            <History className="h-4 w-4 text-jade-600" aria-hidden />
            <div>
              <h2 className="text-sm font-bold text-forest">{dict.settings.audit}</h2>
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
                    <p className="truncate text-sm font-medium text-forest">
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
        <h2 className="text-sm font-bold text-forest">{dict.settings.billing}</h2>
        <p className="mt-1 text-xs text-muted">
          {dict.nav.billing} · {dict.plans[workspace.plan]}
        </p>
        <Link
          href={`/${locale}/billing`}
          className="mt-3 inline-flex text-sm font-semibold text-jade-700 hover:underline"
        >
          {dict.settings.currentPlan} →
        </Link>
      </Card>
    </div>
  );
}
