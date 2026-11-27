import { AppShell } from "@/components/layout/app-shell";
import { OfflineIdentityProvider } from "@/components/offline/offline-identity-provider";
import { requireWorkspaceContext } from "@/lib/supabase/auth";
import { resolveLocale } from "@/lib/i18n/config";
import { getWorkspaceEntitlements } from "@/lib/entitlements/service";
import { countUnreadNotifications, listNotifications } from "@/services/notifications";

export default async function DashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const locale = resolveLocale((await params).locale);
  const context = await requireWorkspaceContext(locale);
  const [entitlements, notifications, unreadNotifications] = await Promise.all([
    getWorkspaceEntitlements(context.workspace.id, context.user.id),
    listNotifications(context.workspace.id, context.user.id, 12).catch(() => []),
    countUnreadNotifications(context.workspace.id, context.user.id).catch(() => 0),
  ]);

  return (
    <OfflineIdentityProvider
      identity={{
        userId: context.user.id,
        workspaceId: context.workspace.id,
        workspaceName: context.workspace.name,
        currency: context.workspace.currency,
        timezone: context.workspace.timezone,
        role: context.role,
        locale,
      }}
    >
      <AppShell
        workspaces={context.memberships.map((membership) => ({
          id: membership.workspaceId,
          name: membership.workspace.name,
          currency: membership.workspace.currency,
          plan: membership.workspace.plan,
        }))}
        activeWorkspaceId={context.workspace.id}
        role={context.role}
        user={{
          name: context.profile.full_name || context.user.email || "",
          email: context.user.email ?? "",
        }}
        canRecord={context.can("transactions:create")}
        notifications={notifications}
        unreadNotifications={unreadNotifications}
        timezone={context.workspace.timezone}
        billing={{
          readOnly: entitlements.readOnly,
          trialActive: entitlements.trial.active,
          trialDays: entitlements.trial.daysRemaining,
          planName: entitlements.trial.planName ?? entitlements.planName,
        }}
      >
        {children}
      </AppShell>
    </OfflineIdentityProvider>
  );
}
