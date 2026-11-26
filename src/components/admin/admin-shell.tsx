"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  LayoutDashboard,
  ScrollText,
  ShieldCheck,
  UserCog,
  Users,
} from "lucide-react";
import { LogoMark } from "@/components/layout/logo";
import { LocaleSwitcher } from "@/components/layout/locale-switcher";
import { SignOutButton } from "@/components/forms/sign-out-button";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/components/layout/i18n-provider";
import type { PlatformAdminRole } from "@/types/platform-admin";

type AdminShellProps = {
  role: PlatformAdminRole;
  user: { name: string; email: string };
  children: React.ReactNode;
};

export function AdminShell({ role, user, children }: AdminShellProps) {
  const { locale, dict } = useI18n();
  const pathname = usePathname();
  const copy = dict.admin;

  const items = [
    { href: `/${locale}/admin`, label: copy.overview, icon: LayoutDashboard },
    { href: `/${locale}/admin/users`, label: copy.users, icon: Users },
    { href: `/${locale}/admin/workspaces`, label: copy.workspaces, icon: Building2 },
    ...(role === "super_admin"
      ? [{ href: `/${locale}/admin/admins`, label: copy.admins, icon: UserCog }]
      : []),
    { href: `/${locale}/admin/audit`, label: copy.audit, icon: ScrollText },
  ];

  const roleLabel =
    role === "super_admin" ? copy.superAdmin : role === "admin" ? copy.admin : copy.support;

  const isActive = (href: string) => {
    if (href === `/${locale}/admin`) return pathname === href;
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <div className="min-h-dvh bg-[#f4f2ec]">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[16.5rem] flex-col bg-[#151c19] px-3 py-5 lg:flex">
        <Link href={`/${locale}/admin`} className="flex items-center gap-2.5 px-1">
          <LogoMark className="h-9 w-9" />
          <span>
            <span className="block text-[1.05rem] font-extrabold tracking-tight text-white">
              Konta<span className="text-[#c9e46a]">Flow</span>
            </span>
            <span className="block text-[0.6rem] font-bold uppercase tracking-[0.18em] text-white/40">
              {copy.console}
            </span>
          </span>
        </Link>

        <div className="mt-5 rounded-xl border border-[#c9e46a]/20 bg-[#c9e46a]/10 px-3 py-2.5">
          <p className="flex items-center gap-1.5 text-[0.6rem] font-bold uppercase tracking-[0.16em] text-[#c9e46a]/75">
            <ShieldCheck className="h-3 w-3" aria-hidden />
            {copy.badge}
          </p>
          <p className="mt-1 text-xs font-semibold text-white">{roleLabel}</p>
          <p className="mt-0.5 truncate text-[0.65rem] text-white/45">{user.email}</p>
        </div>

        <nav aria-label={copy.console} className="mt-5 space-y-1">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive(item.href) ? "page" : undefined}
              className={
                isActive(item.href)
                  ? "flex items-center gap-3 rounded-xl bg-white/12 px-3 py-2.5 text-sm font-semibold text-white"
                  : "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-white/60 transition hover:bg-white/10 hover:text-white"
              }
            >
              <item.icon className="h-[1.1rem] w-[1.1rem]" aria-hidden />
              {item.label}
              {isActive(item.href) ? (
                <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#c9e46a]" aria-hidden />
              ) : null}
            </Link>
          ))}
        </nav>

        <div className="mt-auto border-t border-white/10 pt-4">
          <div className="flex items-center gap-2.5">
            <Avatar name={user.name || user.email} tone="jade" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white">{user.name || roleLabel}</p>
              <p className="truncate text-[0.65rem] text-white/45">{copy.signedInAs}</p>
            </div>
            <SignOutButton label={dict.common.signOut} compact />
          </div>
          <div className="mt-3 rounded-xl bg-white/5 px-3 py-2">
            <LocaleSwitcher compact />
          </div>
          <p className="mt-3 px-1 text-[0.6rem] leading-relaxed text-white/35">{copy.seedNote}</p>
        </div>
      </aside>

      <div className="lg:pl-[16.5rem]">
        <header className="sticky top-0 z-20 border-b border-black/10 bg-[#f4f2ec]/90 backdrop-blur-md">
          <div className="flex min-h-16 flex-wrap items-center gap-2 px-4 py-2 sm:px-6">
            <Link href={`/${locale}/admin`} className="flex items-center gap-2 lg:hidden">
              <LogoMark className="h-8 w-8" />
              <span className="text-sm font-extrabold tracking-tight text-[#151c19]">
                Konta<span className="text-[#3f6b52]">Flow</span>
              </span>
            </Link>
            <Badge tone="mango" className="hidden sm:inline-flex">
              {copy.console}
            </Badge>
            <div className="ml-auto flex items-center gap-2 lg:hidden">
              <LocaleSwitcher compact />
              <SignOutButton
                label={dict.common.signOut}
                compact
                className="text-[#151c19] hover:bg-black/5"
              />
            </div>
          </div>
          <nav aria-label={copy.console} className="flex gap-1 overflow-x-auto px-3 pb-2 lg:hidden">
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive(item.href) ? "page" : undefined}
                className={
                  isActive(item.href)
                    ? "whitespace-nowrap rounded-full bg-[#151c19] px-3 py-1.5 text-xs font-semibold text-white"
                    : "whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium text-[#151c19]/65"
                }
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </header>

        <main id="main" className="mx-auto w-full max-w-[92rem] px-4 py-6 sm:px-6 sm:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
