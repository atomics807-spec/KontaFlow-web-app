import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/admin-shell";
import { OfflineUserGuard } from "@/components/offline/offline-identity-provider";
import { resolveLocale } from "@/lib/i18n/config";
import { requirePlatformAdmin } from "@/lib/platform-admin";

export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
};

export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const locale = resolveLocale((await params).locale);
  const { user, profile, admin } = await requirePlatformAdmin(locale);

  return (
    <AdminShell
      role={admin.role}
      user={{ name: profile?.full_name || user.email || "", email: user.email ?? "" }}
    >
      <OfflineUserGuard userId={user.id} />
      {children}
    </AdminShell>
  );
}
