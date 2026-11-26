import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ShieldCheck, UserCog } from "lucide-react";
import { CreatePlatformAdminForm } from "@/components/admin/create-platform-admin-form";
import { PlatformAdminStatusForm } from "@/components/admin/platform-admin-status-form";
import { Badge } from "@/components/ui/badge";
import { intlLocale, resolveLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/server";
import { formatDate } from "@/lib/dates";
import { requirePlatformAdmin, canManagePlatformAdmins } from "@/lib/platform-admin";
import { listPlatformAdmins } from "@/services/platform-admin";

export const metadata: Metadata = {
  title: "Platform admins",
  robots: { index: false, follow: false },
};

export default async function AdminTeamPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const locale = resolveLocale((await params).locale);
  const dict = await getDictionary(locale);
  const copy = dict.admin;
  const { admin, user } = await requirePlatformAdmin(locale);
  if (!canManagePlatformAdmins(admin.role)) redirect(`/${locale}/admin`);
  const accounts = await listPlatformAdmins();

  const roleLabel = (role: string) =>
    role === "super_admin" ? copy.superAdmin : role === "admin" ? copy.admin : copy.support;

  return (
    <div className="space-y-5">
      <header>
        <p className="text-[0.65rem] font-bold uppercase tracking-[0.16em] text-[#3f6b52]">{copy.admins}</p>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-[#151c19]">{copy.adminsTitle}</h1>
        <p className="mt-1 max-w-2xl text-sm text-[#151c19]/55">{copy.adminsLead}</p>
      </header>

      <CreatePlatformAdminForm />

      <section className="overflow-hidden rounded-2xl border border-black/8 bg-white">
        <div className="flex items-center gap-2 border-b border-black/8 px-4 py-3">
          <UserCog className="h-4 w-4 text-[#3f6b52]" aria-hidden />
          <h2 className="text-sm font-extrabold text-[#151c19]">{copy.adminsTitle}</h2>
          <Badge tone="neutral" className="ml-auto">
            {accounts.length.toLocaleString(intlLocale(locale))}
          </Badge>
        </div>

        {accounts.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-[#151c19]/50">{copy.noAdmins}</p>
        ) : (
          <ul className="divide-y divide-black/8">
            {accounts.map((account) => (
              <li key={account.user_id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-bold text-[#151c19]">
                    {account.full_name || account.email || account.user_id}
                    <Badge tone={account.role === "super_admin" ? "forest" : "jade"}>
                      <ShieldCheck className="h-3 w-3" aria-hidden />
                      {roleLabel(account.role)}
                    </Badge>
                    {!account.is_active ? <Badge tone="clay">{copy.deactivate}</Badge> : null}
                  </p>
                  <p className="mt-0.5 text-xs text-[#151c19]/55">{account.email}</p>
                  <p className="mt-0.5 text-[0.65rem] text-[#151c19]/40">
                    {copy.created}: {formatDate(account.created_at, intlLocale(locale))}
                  </p>
                </div>
                <PlatformAdminStatusForm account={account} currentUserId={user.id} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
