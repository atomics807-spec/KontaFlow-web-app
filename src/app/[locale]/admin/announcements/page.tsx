import type { Metadata } from "next";
import Link from "next/link";
import { Megaphone } from "lucide-react";
import { AdminEmpty, AdminPageHeader } from "@/components/admin/admin-ui";
import { AnnouncementForm } from "@/components/admin/announcement-form";
import { AnnouncementToggle } from "@/components/admin/announcement-toggle";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { intlLocale, resolveLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/server";
import { formatDateTime } from "@/lib/dates";
import { canManageAccounts, requirePlatformAdmin } from "@/lib/platform-admin";
import { listPlatformAnnouncements } from "@/services/platform-admin";

export const metadata: Metadata = {
  title: "Announcements",
  robots: { index: false, follow: false },
};

const TONE: Record<string, "jade" | "mango" | "clay" | "neutral"> = {
  info: "jade",
  success: "jade",
  warning: "mango",
  critical: "clay",
};

export default async function AdminAnnouncementsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ edit?: string }>;
}) {
  const locale = resolveLocale((await params).locale);
  const dict = await getDictionary(locale);
  const copy = dict.admin;
  const { admin } = await requirePlatformAdmin(locale);
  const canManage = canManageAccounts(admin.role);
  const announcements = await listPlatformAnnouncements();
  const editId = (await searchParams).edit;
  const editing = announcements.find((item) => item.id === editId);

  return (
    <div className="space-y-5">
      <AdminPageHeader eyebrow={copy.announcements} title={copy.announcementsTitle} lead={copy.announcementsLead} icon={Megaphone} badge={announcements.length} />

      <AnnouncementForm announcement={editing} canManage={canManage} />

      <section className="space-y-2">
        <h2 className="text-sm font-extrabold text-[#151c19]">{copy.activeAnnouncements}</h2>
        {announcements.length === 0 ? (
          <AdminEmpty>{copy.noAnnouncements}</AdminEmpty>
        ) : (
          announcements.map((announcement) => (
            <article key={announcement.id} className="rounded-2xl border border-black/8 bg-white p-4">
              <div className="flex flex-wrap items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-extrabold text-[#151c19]">{announcement.title}</h3>
                    <Badge tone={TONE[announcement.tone] ?? "neutral"}>{announcement.tone}</Badge>
                    <Badge tone={announcement.is_active ? "jade" : "neutral"}>
                      {announcement.is_active ? copy.publish : copy.pause}
                    </Badge>
                    <Badge tone="outline">
                      {announcement.audience === "workspace_admins" ? copy.workspaceAdmins : copy.allUsers}
                    </Badge>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-[#151c19]/65">{announcement.body}</p>
                  <p className="mt-2 text-[0.65rem] text-[#151c19]/40">
                    {copy.startsAt}: {formatDateTime(announcement.starts_at, intlLocale(locale))}
                    {announcement.ends_at ? ` · ${copy.endsAt}: ${formatDateTime(announcement.ends_at, intlLocale(locale))}` : ""}
                    {announcement.created_by_email ? ` · ${announcement.created_by_email}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap items-start gap-2">
                  <Link href={`/${locale}/admin/announcements?edit=${announcement.id}`} className={buttonVariants({ size: "sm", variant: "secondary" })}>
                    {dict.common.edit}
                  </Link>
                  <AnnouncementToggle id={announcement.id} active={announcement.is_active} canManage={canManage} />
                </div>
              </div>
            </article>
          ))
        )}
      </section>
    </div>
  );
}
