"use client";

import Link from "next/link";
import { ArrowUpRight, Mail } from "lucide-react";
import { ThemeToggle } from "./theme-toggle";
import { Logo } from "./logo";
import { useI18n } from "./i18n-provider";

export function MarketingFooter() {
  const { locale, dict } = useI18n();
  const year = new Date().getFullYear();

  const columns = [
    {
      title: dict.marketing.footerProduct,
      links: [
        { label: dict.marketing.navFeatures, href: `/${locale}/features` },
        { label: dict.marketing.navServices, href: `/${locale}/services` },
        { label: dict.marketing.navHow, href: `/${locale}/how-it-works` },
        { label: dict.marketing.navPricing, href: `/${locale}/pricing` },
        { label: dict.marketing.navSecurity, href: `/${locale}/security` },
      ],
    },
    {
      title: dict.marketing.footerCompany,
      links: [
        { label: dict.marketing.navAbout, href: `/${locale}/about` },
        { label: dict.marketing.navResources, href: `/${locale}/resources` },
        { label: dict.marketing.navFaq, href: `/${locale}/faq` },
        { label: dict.marketing.contact, href: `/${locale}/contact` },
        { label: dict.marketing.photoCredits, href: `/${locale}/photo-credits` },
      ],
    },
    {
      title: dict.marketing.footerLegal,
      links: [
        { label: dict.marketing.terms, href: `/${locale}/legal/terms` },
        { label: dict.marketing.privacy, href: `/${locale}/legal/privacy` },
        { label: dict.marketing.cookies, href: `/${locale}/legal/cookies` },
        { label: dict.marketing.dataProcessing, href: `/${locale}/legal/data-processing` },
        { label: dict.marketing.refunds, href: `/${locale}/legal/refunds` },
        { label: dict.marketing.acceptableUse, href: `/${locale}/legal/acceptable-use` },
      ],
    },
  ];

  return (
    <footer className="border-t border-line bg-page-soft/60">
      <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.2fr_repeat(3,1fr)] lg:px-8">
        <div>
          <Logo />
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted">{dict.marketing.footerTagline}</p>
          <p className="mt-5 text-xs text-muted/80">{dict.marketing.footerLocation}</p>
          <a
            href="mailto:hello@kontaflow.com"
            className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-accent-strong hover:underline"
          >
            <Mail className="h-4 w-4" aria-hidden />
            hello@kontaflow.com
          </a>
        </div>
        {columns.map((column) => (
          <div key={column.title}>
            <p className="text-[0.68rem] font-bold uppercase tracking-[0.12em] text-heading">{column.title}</p>
            <ul className="mt-3 space-y-2">
              {column.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-sm text-muted transition hover:text-heading">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-line/70">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-4 py-5 text-xs text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>
            © {year} KontaFlow. {dict.marketing.rights}
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <Link href={`/${locale}/signup`} className="inline-flex items-center gap-1 font-semibold text-heading hover:text-accent-strong">
              {dict.marketing.getStarted}
              <ArrowUpRight className="h-3 w-3" aria-hidden />
            </Link>
            <p className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-jade-500 pulse-dot" aria-hidden />
              {dict.common.tagline}
            </p>
            <ThemeToggle />
          </div>
        </div>
      </div>
    </footer>
  );
}
