import type { Metadata } from "next";
import Link from "next/link";
import { LifeBuoy } from "lucide-react";
import { AdminEmpty, AdminPageHeader, AdminSection, AdminStat } from "@/components/admin/admin-ui";
import { SupportAccessActions } from "@/components/admin/support-access-actions";
import { SupportAccessRequestForm } from "@/components/admin/support-access-request-form";
import { SupportRequestActions } from "@/components/admin/support-request-actions";
import { Badge } from "@/components/ui/badge";
import { intlLocale, resolveLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/server";
import { formatDateTime } from "@/lib/dates";
import { canManageAccounts, requirePlatformAdmin } from "@/lib/platform-admin";
import {
  listPlatformSupportAccess,
  listPlatformSupportRequests,
  listPlatformWorkspaces,
} from "@/services/platform-admin";

export const metadata: Metadata = {
  title: "Support",
  robots: { index: false, follow: false },
};

const REQUEST_STATUSES = ["all", "new", "read", "replied", "closed", "spam"] as const;
function isGrantExpired(grant: { status: string; expires_at: string | null }): boolean {
  return Boolean(grant.expires_at && new Date(grant.expires_at).getTime() <= Date.now());
}

function countActiveGrants(grants: { status: string; expires_at: string | null }[]): number {
  return grants.filter((grant) => grant.status === "approved" && !isGrantExpired(grant)).length;
}

const ACCESS_TONE: Record<string, "jade" | "mango" | "clay" | "neutral"> = {
  pending: "mango",
  approved: "jade",
  denied: "clay",
  revoked: "neutral",
  expired: "neutral",
};

export default async function AdminSupportPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const locale = resolveLocale((await params).locale);
  const dict = await getDictionary(locale);
  const copy = dict.admin;
  const { admin } = await requirePlatformAdmin(locale);
  const requested = (await searchParams).status ?? "all";
  const status = REQUEST_STATUSES.includes(requested as (typeof REQUEST_STATUSES)[number])
    ? requested
    : "all";

  const [requests, grants, workspaces] = await Promise.all([
    listPlatformSupportRequests(status),
    listPlatformSupportAccess(),
    listPlatformWorkspaces(),
  ]);

  const newCount = requests.filter((request) => request.status === "new").length;
  const pendingCount = grants.filter((grant) => grant.status === "pending").length;
  const canDecide = canManageAccounts(admin.role);
  const activeGrants = countActiveGrants(grants);

  return (
    <div className="space-y-5">
      <AdminPageHeader eyebrow={copy.support} title={copy.supportTitle} lead={copy.supportLead} icon={LifeBuoy} badge={newCount} />

      <section className="grid gap-3 sm:grid-cols-3">
        <AdminStat label={copy.supportRequests} value={requests.length} detail={`${newCount} ${copy.newRequest.toLowerCase()}`} tone={newCount ? "accent" : "neutral"} />
        <AdminStat label={copy.supportAccess} value={grants.length} detail={`${pendingCount} ${copy.pending.toLowerCase()}`} tone={pendingCount ? "warning" : "neutral"} />
        <AdminStat label={copy.activeGrants} value={activeGrants} detail={copy.snapshotLead} tone="success" />
      </section>

      <div className="flex flex-wrap gap-2">
        {REQUEST_STATUSES.map((value) => (
          <Link key={value} href={value === "all" ? `/${locale}/admin/support` : `/${locale}/admin/support?status=${value}`}>
            <Badge tone={status === value ? "jade" : "outline"} className="px-3 py-1.5 text-xs">
              {value === "all" ? copy.allStatuses : value}
            </Badge>
          </Link>
        ))}
      </div>

      <AdminSection title={copy.supportRequests} description={copy.supportLead}>
        {requests.length === 0 ? (
          <AdminEmpty>{copy.noSupportRequests}</AdminEmpty>
        ) : (
          <div className="space-y-2">
            {requests.map((request) => (
              <article key={request.id} className="rounded-xl border border-black/8 p-3.5">
                <div className="flex flex-wrap items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-extrabold text-[#151c19]">{request.name}</h3>
                      <Badge tone={request.status === "new" ? "mango" : "neutral"}>{request.status}</Badge>
                      <Badge tone="outline">{request.topic}</Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-[#151c19]/55">
                      {request.email}
                      {request.company ? ` · ${request.company}` : ""} · {formatDateTime(request.created_at, intlLocale(locale))}
                    </p>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-[#151c19]/70">{request.message}</p>
                    {request.handled_by_email ? (
                      <p className="mt-2 text-[0.65rem] text-[#151c19]/40">
                        {copy.requester}: {request.handled_by_email}
                        {request.handled_at ? ` · ${formatDateTime(request.handled_at, intlLocale(locale))}` : ""}
                      </p>
                    ) : null}
                  </div>
                  <SupportRequestActions id={request.id} />
                </div>
              </article>
            ))}
          </div>
        )}
      </AdminSection>

      <SupportAccessRequestForm workspaces={workspaces.map((workspace) => ({ id: workspace.id, name: workspace.name }))} />

      <AdminSection title={copy.supportAccess} description={copy.snapshotLead}>
        {grants.length === 0 ? (
          <AdminEmpty>{copy.noSupportAccess}</AdminEmpty>
        ) : (
          <div className="space-y-2">
            {grants.map((grant) => {
              const expired = grant.status === "approved" && isGrantExpired(grant);
              return (
                <article key={grant.id} className="rounded-xl border border-black/8 p-3.5">
                  <div className="flex flex-wrap items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-extrabold text-[#151c19]">{grant.workspace_name}</h3>
                        <Badge tone={ACCESS_TONE[expired ? "expired" : grant.status] ?? "neutral"}>
                          {expired ? copy.expired : grant.status}
                        </Badge>
                        <Badge tone="outline">{grant.requested_hours}h</Badge>
                      </div>
                      <p className="mt-1 text-xs text-[#151c19]/55">{grant.justification}</p>
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[0.65rem] text-[#151c19]/40">
                        <span>{copy.requester}: {grant.requested_by_email ?? "—"}</span>
                        <span>{copy.approver}: {grant.approved_by_email ?? "—"}</span>
                        <span>{copy.accessCount}: {grant.access_count}</span>
                        {grant.expires_at ? <span>{copy.grantExpires}: {formatDateTime(grant.expires_at, intlLocale(locale))}</span> : null}
                      </div>
                      {grant.status === "approved" && !expired ? (
                        <Link href={`/${locale}/admin/support/${grant.workspace_id}`} className="mt-2 inline-block text-xs font-bold text-[#3f6b52] underline underline-offset-2">
                          {copy.openSnapshot}
                        </Link>
                      ) : null}
                    </div>
                    <SupportAccessActions grant={grant} canDecide={canDecide} />
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </AdminSection>
    </div>
  );
}
