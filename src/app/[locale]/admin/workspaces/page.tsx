import type { Metadata } from "next";
import Link from "next/link";
import { Building2, Search } from "lucide-react";
import { WorkspacePlanForm } from "@/components/admin/workspace-plan-form";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { intlLocale, resolveLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/server";
import { formatDate } from "@/lib/dates";
import { requirePlatformAdmin, canManageAccounts } from "@/lib/platform-admin";
import { listPlatformWorkspaces } from "@/services/platform-admin";

export const metadata: Metadata = {
  title: "Businesses",
  robots: { index: false, follow: false },
};

const STATUS_TONE: Record<string, "jade" | "mango" | "clay" | "neutral"> = {
  active: "jade",
  trialing: "mango",
  past_due: "clay",
  canceled: "neutral",
  paused: "neutral",
};

export default async function AdminWorkspacesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const locale = resolveLocale((await params).locale);
  const dict = await getDictionary(locale);
  const copy = dict.admin;
  const { admin } = await requirePlatformAdmin(locale);
  const query = (await searchParams).q?.slice(0, 120) ?? "";
  const workspaces = await listPlatformWorkspaces(query);
  const canManage = canManageAccounts(admin.role);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[0.65rem] font-bold uppercase tracking-[0.16em] text-[#3f6b52]">{copy.workspaces}</p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-[#151c19]">
            {copy.workspacesTitle}
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-[#151c19]/55">{copy.workspacesLead}</p>
        </div>
        <Badge tone="mango">
          <Building2 className="h-3 w-3" aria-hidden />
          {workspaces.length.toLocaleString(intlLocale(locale))}
        </Badge>
      </header>

      <form
        action={`/${locale}/admin/workspaces`}
        method="get"
        className="flex flex-wrap gap-2 rounded-2xl border border-black/8 bg-white p-3"
      >
        <label htmlFor="admin-workspace-search" className="sr-only">
          {copy.searchWorkspaces}
        </label>
        <Input
          id="admin-workspace-search"
          name="q"
          defaultValue={query}
          placeholder={copy.searchWorkspaces}
          className="h-10 min-w-0 flex-1 basis-60"
          maxLength={120}
        />
        <Button type="submit" size="sm" variant="dark">
          <Search className="h-4 w-4" aria-hidden />
          {copy.search}
        </Button>
        {query ? (
          <Link href={`/${locale}/admin/workspaces`} className={buttonVariants({ size: "sm", variant: "ghost" })}>
            {copy.clear}
          </Link>
        ) : null}
      </form>

      {workspaces.length === 0 ? (
        <p className="rounded-2xl border border-black/8 bg-white px-5 py-10 text-center text-sm text-[#151c19]/50">
          {copy.noWorkspaces}
        </p>
      ) : (
        <div className="space-y-2">
          {workspaces.map((workspace) => (
            <article
              key={workspace.id}
              className="rounded-2xl border border-black/8 bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)]"
            >
              <div className="flex flex-wrap items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate text-sm font-extrabold text-[#151c19]">{workspace.name}</h2>
                    <Badge tone="forest">{dict.plans[workspace.plan]}</Badge>
                    <Badge tone={STATUS_TONE[workspace.subscription_status ?? ""] ?? "neutral"}>
                      {workspace.subscription_status ?? "—"}
                    </Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-[#151c19]/55">
                    {workspace.slug} · {workspace.currency} · {workspace.timezone}
                  </p>
                  <div className="mt-2 grid gap-x-5 gap-y-1 text-[0.68rem] text-[#151c19]/50 sm:grid-cols-2">
                    <span>
                      {copy.owner}: {workspace.owner_name || "—"} {workspace.owner_email ? `· ${workspace.owner_email}` : ""}
                    </span>
                    <span>
                      {copy.members}: {workspace.member_count.toLocaleString(intlLocale(locale))}
                    </span>
                    <span>
                      {copy.transactions}: {workspace.transaction_count.toLocaleString(intlLocale(locale))}
                    </span>
                    <span>
                      {copy.created}: {formatDate(workspace.created_at, intlLocale(locale))}
                    </span>
                  </div>
                </div>
                <p className="font-mono text-[0.6rem] text-[#151c19]/30">{workspace.id.slice(0, 8)}</p>
              </div>
              <WorkspacePlanForm workspace={workspace} canManage={canManage} />
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
