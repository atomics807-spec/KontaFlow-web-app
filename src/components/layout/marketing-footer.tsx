"use client";

import Link from "next/link";
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
        { label: dict.marketing.navProduct, href: `/${locale}/overview` },
        { label: dict.marketing.navChannels, href: `/${locale}/channels` },
        { label: dict.marketing.navFeatures, href: `/${locale}/product` },
        { label: dict.marketing.navPricing, href: `/${locale}/pricing` },
      ],
    },
    {
      title: dict.marketing.footerCompany,
      links: [
        { label: dict.marketing.about, href: `/${locale}/overview` },
        { label: dict.marketing.docs, href: "/docs/architecture/overview.md" },
        { label: dict.marketing.contact, href: `/${locale}/contact` },
      ],
    },
    {
      title: dict.marketing.footerLegal,
      links: [
        { label: dict.marketing.navSecurity, href: `/${locale}/security` },
        { label: dict.marketing.privacy, href: `/${locale}/security` },
        { label: dict.marketing.terms, href: `/${locale}/security` },
      ],
    },
  ];

  return (
    <footer className="border-t border-line bg-page-soft/60">
      <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_repeat(3,1fr)] lg:px-8">
        <div>
          <Logo />
          <p className="mt-3 max-w-xs text-sm text-muted">{dict.marketing.footerTagline}</p>
          <p className="mt-6 text-xs text-muted/80">Douala · Yaoundé · Cameroon</p>
        </div>
        {columns.map((column) => (
          <div key={column.title}>
            <p className="text-[0.7rem] font-bold uppercase tracking-[0.12em] text-heading">{column.title}</p>
            <ul className="mt-3 space-y-2">
              {column.links.map((link) => (
                <li key={link.label}>
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
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-2 px-4 py-5 text-xs text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>
            © {year} KontaFlow. {dict.marketing.rights}
          </p>
          <div className="flex items-center gap-4">
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
