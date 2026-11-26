import type { Metadata } from "next";
import Link from "next/link";
import { Search, ShieldCheck, Users } from "lucide-react";
import { RestrictUserForm } from "@/components/admin/restrict-user-form";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { intlLocale, resolveLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/server";
import { formatDate, formatDateTime } from "@/lib/dates";
import { requirePlatformAdmin, canManageAccounts } from "@/lib/platform-admin";
import { listPlatformUsers } from "@/services/platform-admin";

export const metadata: Metadata = {
  title: "Accounts",
  robots: { index: false, follow: false },
};

export default async function AdminUsersPage({
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
  const users = await listPlatformUsers(query);
  const canManage = canManageAccounts(admin.role);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[0.65rem] font-bold uppercase tracking-[0.16em] text-[#3f6b52]">{copy.users}</p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-[#151c19]">{copy.usersTitle}</h1>
          <p className="mt-1 max-w-2xl text-sm text-[#151c19]/55">{copy.usersLead}</p>
        </div>
        <Badge tone="mango">
          <Users className="h-3 w-3" aria-hidden />
          {users.length.toLocaleString(intlLocale(locale))}
        </Badge>
      </header>

      <form action={`/${locale}/admin/users`} method="get" className="flex flex-wrap gap-2 rounded-2xl border border-black/8 bg-white p-3">
        <label htmlFor="admin-user-search" className="sr-only">
          {copy.searchUsers}
        </label>
        <Input
          id="admin-user-search"
          name="q"
          defaultValue={query}
          placeholder={copy.searchUsers}
          className="h-10 min-w-0 flex-1 basis-60"
          maxLength={120}
        />
        <Button type="submit" size="sm" variant="dark">
          <Search className="h-4 w-4" aria-hidden />
          {copy.search}
        </Button>
        {query ? (
          <Link href={`/${locale}/admin/users`} className={buttonVariants({ size: "sm", variant: "ghost" })}>
            {copy.clear}
          </Link>
        ) : null}
      </form>

      {users.length === 0 ? (
        <p className="rounded-2xl border border-black/8 bg-white px-5 py-10 text-center text-sm text-[#151c19]/50">
          {copy.noUsers}
        </p>
      ) : (
        <div className="space-y-2">
          {users.map((user) => {
            const restricted = Boolean(user.restriction_id);
            return (
              <article
                key={user.id}
                className="rounded-2xl border border-black/8 bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)]"
              >
                <div className="flex flex-wrap items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate text-sm font-extrabold text-[#151c19]">
                        {user.full_name || user.email || user.id}
                      </h2>
                      {user.is_platform_admin ? (
                        <Badge tone="forest">
                          <ShieldCheck className="h-3 w-3" aria-hidden />
                          {copy.platformStaff}
                        </Badge>
                      ) : null}
                      {restricted ? (
                        <span className="rounded-full bg-[#fbeee9] px-2 py-1 text-[0.65rem] font-bold text-[#8b2d18]">
                          {user.severity === "suspended" ? copy.suspendedState : copy.restrictedState}
                        </span>
                      ) : (
                        <span className="rounded-full bg-[#e9f1e5] px-2 py-1 text-[0.65rem] font-bold text-[#31553a]">
                          {copy.active}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-[#151c19]/60">{user.email ?? user.id}</p>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[0.68rem] text-[#151c19]/45">
                      <span>
                        {copy.joined}: {formatDate(user.created_at, intlLocale(locale))}
                      </span>
                      <span>
                        {copy.lastSignIn}:{" "}
                        {user.last_sign_in_at ? formatDateTime(user.last_sign_in_at, intlLocale(locale)) : "—"}
                      </span>
                      <span>
                        {copy.memberships}: {user.membership_count}
                      </span>
                    </div>
                    {user.workspaces.length ? (
                      <p className="mt-1 truncate text-[0.68rem] text-[#151c19]/50">
                        {user.workspaces.map((workspace) => `${workspace.name} (${workspace.role})`).join(" · ")}
                      </p>
                    ) : (
                      <p className="mt-1 text-[0.68rem] text-[#151c19]/40">
                        {user.is_platform_admin ? copy.seedNote : copy.noMemberships}
                      </p>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-mono text-[0.6rem] text-[#151c19]/30">{user.id.slice(0, 8)}</p>
                  </div>
                </div>
                <RestrictUserForm user={user} canManage={canManage && !user.is_platform_admin} />
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
