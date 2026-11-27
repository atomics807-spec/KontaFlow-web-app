"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Logo } from "./logo";
import { LocaleSwitcher } from "./locale-switcher";
import { useI18n } from "./i18n-provider";

export function MarketingHeader() {
  const { locale, dict } = useI18n();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const links = [
    { href: `/${locale}`, label: dict.marketing.navHome },
    { href: `/${locale}/about`, label: dict.marketing.navAbout },
    { href: `/${locale}/features`, label: dict.marketing.navFeatures },
    { href: `/${locale}/services`, label: dict.marketing.navServices },
    { href: `/${locale}/how-it-works`, label: dict.marketing.navHow },
    { href: `/${locale}/pricing`, label: dict.marketing.navPricing },
    { href: `/${locale}/resources`, label: dict.marketing.navResources },
    { href: `/${locale}/contact`, label: dict.marketing.contact },
  ];

  const isActive = (href: string) => {
    const home = `/${locale}`;
    return href === home ? pathname === home : pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-page/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <Link href={`/${locale}`} aria-label={dict.common.appName} className="flex shrink-0 items-center">
          <Logo />
        </Link>

        <nav aria-label={dict.common.mainNavigation} className="hidden items-center gap-3 xl:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={isActive(link.href) ? "page" : undefined}
              className={
                isActive(link.href)
                  ? "whitespace-nowrap text-[0.77rem] font-bold text-accent-strong"
                  : "whitespace-nowrap text-[0.77rem] font-semibold text-muted transition-colors duration-200 hover:text-heading"
              }
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 whitespace-nowrap xl:flex">
          <LocaleSwitcher />
          <ThemeToggle />
          <Link href={`/${locale}/login`} className={buttonVariants({ variant: "ghost", size: "sm" })}>
            {dict.marketing.signIn}
          </Link>
          <Link href={`/${locale}/signup`} className={buttonVariants({ size: "sm" })}>
            {dict.marketing.getStarted}
          </Link>
        </div>

        <div className="flex items-center gap-2 xl:hidden">
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="grid h-10 w-10 place-items-center rounded-full border border-line bg-panel text-heading"
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? dict.common.close : dict.common.menu}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open ? (
        <div
          id="mobile-menu"
          onClick={() => setOpen(false)}
          className="animate-rise max-h-[calc(100dvh-4rem)] overflow-y-auto border-t border-line bg-page px-4 pb-5 pt-3 xl:hidden"
        >
            <nav aria-label={dict.common.mobileNavigation} className="grid grid-cols-2 gap-1">
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  aria-current={isActive(link.href) ? "page" : undefined}
                  className={
                    isActive(link.href)
                      ? "rounded-lg bg-accent-soft px-3 py-3 text-sm font-semibold text-accent-strong"
                      : "rounded-lg px-3 py-3 text-sm font-semibold text-heading transition hover:bg-panel"
                  }
                >
                  {link.label}
                </Link>
              ))}
            </nav>
            <div className="mt-4 border-t border-line pt-4">
              <div className="flex items-center justify-between gap-3">
                <LocaleSwitcher />
                <ThemeToggle />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Link href={`/${locale}/login`} className={buttonVariants({ variant: "secondary", size: "sm" })}>
                  {dict.marketing.signIn}
                </Link>
                <Link href={`/${locale}/signup`} className={buttonVariants({ size: "sm" })}>
                  {dict.marketing.getStarted}
                </Link>
              </div>
            </div>
        </div>
      ) : null}
    </header>
  );
}
