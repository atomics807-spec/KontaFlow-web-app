"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Logo } from "./logo";
import { LocaleSwitcher } from "./locale-switcher";
import { useI18n } from "./i18n-provider";

export function MarketingHeader() {
  const { locale, dict } = useI18n();
  const [open, setOpen] = useState(false);

  const links = [
    { href: `/${locale}#product`, label: dict.marketing.navProduct },
    { href: `/${locale}#channels`, label: dict.marketing.navChannels },
    { href: `/${locale}#features`, label: dict.marketing.navFeatures },
    { href: `/${locale}#security`, label: dict.marketing.navSecurity },
    { href: `/${locale}#pricing`, label: dict.marketing.navPricing },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-page/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link href={`/${locale}`} aria-label={dict.common.appName} className="flex items-center">
          <Logo />
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-7 md:flex">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-semibold text-muted transition-colors duration-200 hover:text-heading"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <ThemeToggle />
          <LocaleSwitcher />
          <Link href={`/${locale}/login`} className={buttonVariants({ variant: "ghost", size: "sm" })}>
            {dict.marketing.signIn}
          </Link>
          <Link href={`/${locale}/signup`} className={buttonVariants({ size: "sm" })}>
            {dict.marketing.getStarted}
          </Link>
        </div>

        <div className="flex items-center gap-2 md:hidden">
          <ThemeToggle />
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="grid h-10 w-10 place-items-center rounded-full border border-line bg-panel text-heading"
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? dict.common.close : "Menu"}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            id="mobile-menu"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="border-t border-line bg-page px-4 pb-5 pt-3 md:hidden"
          >
            <nav aria-label="Mobile" className="flex flex-col">
              {links.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-2 py-3 text-sm font-semibold text-heading transition hover:bg-panel"
                >
                  {link.label}
                </a>
              ))}
            </nav>
            <div className="mt-3 flex items-center justify-between gap-3 border-t border-line pt-4">
              <LocaleSwitcher />
              <div className="flex gap-2">
                <Link href={`/${locale}/login`} className={buttonVariants({ variant: "secondary", size: "sm" })}>
                  {dict.marketing.signIn}
                </Link>
                <Link href={`/${locale}/signup`} className={buttonVariants({ size: "sm" })}>
                  {dict.marketing.getStarted}
                </Link>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </header>
  );
}
