"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useTransition } from "react";
import {
  ArrowLeftRight,
  BrainCircuit,
  ChevronDown,
  Coins,
  CreditCard,
  FileBarChart2,
  FileText,
  Handshake,
  LayoutDashboard,
  LayoutGrid,
  Menu,
  Plus,
  Settings,
  Smile,
  Sparkles,
  Target,
  UserCog,
  Users,
} from "lucide-react";
import { LogoMark } from "@/components/layout/logo";
import { useI18n } from "@/components/layout/i18n-provider";
import { SyncStatus } from "@/components/layout/sync-status";
import { LocaleSwitcher } from "@/components/layout/locale-switcher";
import { SignOutButton } from "@/components/forms/sign-out-button";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { DataSaverToggle } from "@/components/pwa/data-saver-toggle";
import { UserMenu } from "@/components/layout/user-menu";
import { NotificationBell } from "@/components/layout/notification-bell";
import { EasyBottomNav } from "@/components/easy/easy-bottom-nav";
import { EasySoundToggle } from "@/components/easy/easy-sound-toggle";
import { SupportLinks } from "@/components/support/support-links";
import { PageTransition } from "@/components/motion/page-transition";
import { Avatar } from "@/components/ui/avatar";
import { Drawer } from "@/components/ui/drawer";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { switchWorkspaceFormAction } from "@/app/[locale]/onboarding/actions";
import { setEasyModeAction } from "@/app/[locale]/(dashboard)/easy/actions";
import { interpolate } from "@/lib/i18n/interpolate";
import type { NotificationRow, WorkspacePlan } from "@/types/database";

export type ShellWorkspace = {
  id: string;
  name: string;
  currency: string;
  plan: WorkspacePlan;
  logoUrl: string | null;
};

export type ShellBilling = {
  readOnly: boolean;
  trialActive: boolean;
  trialDays: number | null;
  planName: string;
};

type ShellProps = {
  workspaces: ShellWorkspace[];
  activeWorkspaceId: string;
  role: string;
  user: { name: string; email: string };
  canRecord: boolean;
  notifications: NotificationRow[];
  unreadNotifications: number;
  timezone: string;
  billing?: ShellBilling;
  children: React.ReactNode;
};

export function AppShell({
  workspaces,
  activeWorkspaceId,
  role,
  user,
  canRecord,
  notifications,
  unreadNotifications,
  timezone,
  billing,
  children,
}: ShellProps) {
  const { locale, dict } = useI18n();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [pending] = useTransition();

  const active = workspaces.find((workspace) => workspace.id === activeWorkspaceId) ?? workspaces[0];

  const primary = [
    { href: `/${locale}/dashboard`, label: dict.nav.overview, icon: LayoutDashboard },
    { href: `/${locale}/easy`, label: dict.nav.easy, icon: Smile },
    { href: `/${locale}/transactions`, label: dict.nav.transactions, icon: ArrowLeftRight },
    { href: `/${locale}/accounts`, label: dict.nav.accounts, icon: Coins },
    { href: `/${locale}/contacts`, label: dict.nav.contacts, icon: Users },
    { href: `/${locale}/assistant`, label: dict.nav.assistant, icon: Sparkles },
    { href: `/${locale}/insights`, label: dict.nav.insights, icon: BrainCircuit },
    { href: `/${locale}/reports`, label: dict.nav.reports, icon: FileBarChart2 },
  ];

  const secondary = [
    { href: `/${locale}/debts`, label: dict.nav.debts, icon: Handshake },
    { href: `/${locale}/budgets`, label: dict.nav.budgets, icon: Target },
    { href: `/${locale}/invoices`, label: dict.nav.invoices, icon: FileText },
    { href: `/${locale}/team`, label: dict.nav.team, icon: UserCog },
    { href: `/${locale}/settings`, label: dict.nav.settings, icon: Settings },
    { href: `/${locale}/billing`, label: dict.nav.billing, icon: CreditCard },
  ];

  const isActive = (href: string) =>
    pathname === href || (href !== `/${locale}/dashboard` && pathname.startsWith(`${href}/`));

  const workspaceSwitcher = (
    <form action={switchWorkspaceFormAction} className="relative">
      <input type="hidden" name="locale" value={locale} />
      <label className="sr-only" htmlFor="workspace-select">
        {dict.nav.workspace}
      </label>
      <select
        id="workspace-select"
        name="workspaceId"
        defaultValue={activeWorkspaceId}
        disabled={pending}
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
        className="w-full cursor-pointer appearance-none rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 pr-9 text-sm font-semibold text-white outline-none transition hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-mango-400/60"
      >
        {workspaces.map((workspace) => (
          <option key={workspace.id} value={workspace.id} className="text-heading">
            {workspace.name}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-jade-200" aria-hidden />
    </form>
  );

  const navLink = (item: { href: string; label: string; icon: typeof LayoutDashboard }) => (
    <Link
      key={item.href}
      href={item.href}
      onClick={() => setOpen(false)}
      aria-current={isActive(item.href) ? "page" : undefined}
      className={
        isActive(item.href)
          ? "group flex items-center gap-3 rounded-xl bg-white/12 px-3 py-2.5 text-sm font-semibold text-white"
          : "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-jade-100/75 transition hover:bg-white/8 hover:text-white"
      }
    >
      <item.icon className="h-[1.15rem] w-[1.15rem] shrink-0" aria-hidden />
      <span className="truncate">{item.label}</span>
      {isActive(item.href) ? <span className="ml-auto h-1.5 w-1.5 rounded-full bg-mango-400" aria-hidden /> : null}
    </Link>
  );

  const sidebarContent = (
    <>
      <div className="flex items-center justify-between px-1">
        <Link href={`/${locale}/dashboard`} aria-label={dict.common.appName}>
          <span className="inline-flex items-center gap-2.5">
            <LogoMark className="h-9 w-9" />
            <span className="text-[1.05rem] font-extrabold tracking-tight text-white">
              Konta<span className="text-jade-300">Flow</span>
            </span>
          </span>
        </Link>
      </div>

      <div className="mt-5 flex items-center gap-2">
        <Avatar
          name={active?.name ?? "K"}
          src={active?.logoUrl}
          className="h-10 w-10 rounded-xl ring-1 ring-white/15"
        />
        <div className="min-w-0 flex-1">{workspaceSwitcher}</div>
      </div>

      <div className="mt-4 flex items-center gap-2 px-1">
        <Badge tone="outline" className="border-white/15 text-jade-100/80">
          {dict.plans[active?.plan ?? "starter"]}
        </Badge>
        <Badge tone="outline" className="border-white/15 text-jade-100/80">
          {active?.currency ?? "XAF"}
        </Badge>
        <span className="ml-auto text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-jade-200/60">
          {dict.roles[role as keyof typeof dict.roles] ?? role}
        </span>
      </div>

      <nav aria-label={dict.nav.main} className="mt-6 space-y-1">
        {primary.map(navLink)}
      </nav>

      <p className="mt-6 px-3 text-[0.65rem] font-bold uppercase tracking-[0.16em] text-jade-200/45">
        {dict.nav.manage}
      </p>
      <nav aria-label={dict.nav.manage} className="mt-2 space-y-1">
        {secondary.map(navLink)}
      </nav>

      {canRecord ? (
        <Link
          href={`/${locale}/transactions/new`}
          onClick={() => setOpen(false)}
          className={buttonVariants({
            variant: "mango",
            size: "md",
            className: "mt-6 w-full justify-center",
          })}
        >
          <Plus className="h-4 w-4" aria-hidden />
          {dict.transactions.new}
        </Link>
      ) : null}

      <div className="mt-auto border-t border-white/10 pt-4">
        <div className="flex items-center gap-2.5">
          <Avatar name={user.name || user.email} tone="jade" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">{user.name || dict.roles.staff}</p>
            <p className="truncate text-xs text-jade-200/60">{user.email}</p>
          </div>
          <SignOutButton label={dict.common.signOut} compact />
        </div>
        <div className="mt-3 flex items-center justify-between rounded-xl bg-white/5 px-3 py-2">
          <LocaleSwitcher compact />
          <ThemeToggle tone="dark" />
        </div>
        <SupportLinks
          variant="dark"
          className="mt-3"
          title={dict.common.needHelp}
          call={dict.common.call}
          whatsapp={dict.common.whatsapp}
        />
        <p className="mt-2 px-1 text-[0.65rem] text-jade-200/50">{dict.marketing.footerLocation}</p>
      </div>
    </>
  );

  const easyMode = pathname === `/${locale}/easy` || pathname.startsWith(`/${locale}/easy/`);

  if (easyMode) {
    return (
      <div className="min-h-dvh bg-page">
        <header className="sticky top-0 z-20 border-b-2 border-line bg-page/95 backdrop-blur-md">
          <div className="mx-auto flex h-16 w-full max-w-4xl items-center gap-2 px-4 sm:px-6">
            <Link href={`/${locale}/easy`} aria-label={dict.easy.backToEasy} className="inline-flex items-center gap-2">
              <LogoMark className="h-9 w-9" />
              <span className="text-lg font-black tracking-tight text-heading">
                Konta<span className="text-accent">Flow</span>
              </span>
            </Link>
            <span className="ml-1 hidden rounded-full bg-accent-soft px-2.5 py-1 text-xs font-bold text-accent sm:inline">
              {dict.easy.badge}
            </span>
            <div className="ml-auto flex items-center gap-1.5">
              <EasySoundToggle />
              <LocaleSwitcher compact />
              <SignOutButton label={dict.common.signOut} compact />
              <form action={setEasyModeAction} className="ml-1">
                <input type="hidden" name="locale" value={locale} />
                <input type="hidden" name="mode" value="full" />
                <button
                  type="submit"
                  aria-label={dict.easy.backToFull}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-full border-2 border-line bg-panel px-2.5 py-2 text-xs font-bold text-heading hover:bg-accent-soft sm:px-3"
                >
                  <LayoutGrid className="h-4 w-4" aria-hidden />
                  <span className="hidden lg:inline">{dict.easy.backToFull}</span>
                </button>
              </form>
            </div>
          </div>
        </header>
        <main id="main" className="mx-auto w-full max-w-4xl px-4 py-5 pb-28 sm:px-6 sm:py-7 sm:pb-32">
          <PageTransition>{children}</PageTransition>
        </main>
        <EasyBottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-page">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[17.5rem] flex-col overflow-y-auto bg-forest px-3 py-5 lg:flex">
        {sidebarContent}
      </aside>

      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        side="left"
        title={dict.nav.main}
        closeLabel={dict.common.close}
      >
        <div className="flex flex-1 flex-col px-3 pb-5">{sidebarContent}</div>
      </Drawer>

      <div className="lg:pl-[17.5rem]">
        <header className="sticky top-0 z-20 border-b border-line/80 bg-page/85 backdrop-blur-md">
          <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="grid h-10 w-10 place-items-center rounded-full border border-line bg-panel text-heading lg:hidden"
              aria-label={dict.nav.openMenu}
              aria-expanded={open}
            >
              <Menu className="h-5 w-5" />
            </button>
            <Link href={`/${locale}/dashboard`} className="lg:hidden" aria-label={dict.common.appName}>
              <LogoMark className="h-8 w-8" />
            </Link>
            {active?.logoUrl ? (
              <Avatar
                name={active.name}
                src={active.logoUrl}
                className="h-8 w-8 rounded-lg lg:hidden"
              />
            ) : null}

            <div className="hidden min-w-0 items-center gap-2 lg:flex">
              {active?.logoUrl ? (
                <Avatar name={active.name} src={active.logoUrl} className="h-8 w-8 rounded-lg" />
              ) : null}
              <span className="truncate text-sm font-bold text-heading">{active?.name}</span>
              <span className="text-xs text-muted">·</span>
              <span className="text-xs text-muted">{dict.dashboard.thisMonthLabel}</span>
            </div>

            <div className="ml-auto flex items-center gap-2">
              <NotificationBell
                notifications={notifications}
                unread={unreadNotifications}
                locale={locale}
                timezone={timezone}
              />
              <SyncStatus />
              <DataSaverToggle />
              <ThemeToggle className="hidden sm:inline-flex" />
              <UserMenu name={user.name} email={user.email} />
              {canRecord ? (
                <Link
                  href={`/${locale}/transactions/new`}
                  className={buttonVariants({ size: "sm", className: "hidden sm:inline-flex" })}
                >
                  <Plus className="h-4 w-4" aria-hidden />
                  {dict.transactions.new}
                </Link>
              ) : null}
            </div>
          </div>
        </header>

        <main id="main" className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
          {billing && (billing.readOnly || (billing.trialActive && (billing.trialDays ?? 99) <= 3)) ? (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-mango-300/70 bg-mango-50 px-4 py-3 text-sm text-heading">
              <p className="font-medium">
                {billing.readOnly
                  ? dict.plans.readOnly
                  : interpolate(dict.plans.trialActive, {
                      days: billing.trialDays ?? 0,
                      plan: billing.planName,
                    })}
              </p>
              <Link href={`/${locale}/billing`} className={buttonVariants({ size: "sm" })}>
                {dict.plans.upgrade}
              </Link>
            </div>
          ) : null}
          <PageTransition>{children}</PageTransition>
        </main>
      </div>
    </div>
  );
}
