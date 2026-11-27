import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { JsonLd } from "@/components/seo/json-ld";
import { CtaBand, FaqList, PageHero, SectionHeading } from "@/components/marketing/site";
import { Reveal } from "@/components/motion/reveal";
import { getAeoContent } from "@/lib/content/aeo";
import { getSiteContent } from "@/lib/content";
import { getDictionary } from "@/lib/i18n/server";
import { intlLocale, resolveLocale } from "@/lib/i18n/config";
import { marketingMetadata } from "@/lib/seo";
import { webPageSchema } from "@/lib/structured-data";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const locale = resolveLocale((await params).locale);
  const copy = getAeoContent(locale).compare;
  return marketingMetadata({
    locale,
    path: "/compare",
    title: copy.metaTitle,
    description: copy.metaDescription,
    image: copy.image,
  });
}

export default async function ComparePage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = resolveLocale((await params).locale);
  const [content, dict, copy] = await Promise.all([
    getSiteContent(locale),
    getDictionary(locale),
    Promise.resolve(getAeoContent(locale).compare),
  ]);

  return (
    <>
      <JsonLd
        data={webPageSchema({
          locale,
          path: "/compare",
          name: copy.metaTitle,
          description: copy.metaDescription,
          dateModified: copy.lastReviewed,
        })}
      />
      <PageHero
        page={{
          eyebrow: copy.eyebrow,
          title: copy.title,
          subtitle: copy.subtitle,
          image: copy.image,
          imageAlt: copy.imageAlt,
          imageCaption: content.common.illustrativePhoto,
        }}
        locale={locale}
        primaryHref={`/${locale}/signup`}
        primaryLabel={copy.cta.primary}
        secondaryHref={`/${locale}/contact`}
        secondaryLabel={copy.cta.secondary}
        breadcrumbs={[{ label: dict.marketing.navCompare }]}
        breadcrumbLabel={content.common.breadcrumb}
        homeLabel={content.common.home}
      />

      <section className="py-16 sm:py-20">
        <div className="mx-auto w-full max-w-5xl px-4 sm:px-6 lg:px-8">
          <Reveal>
            <h2 className="text-2xl font-extrabold tracking-tight text-heading sm:text-3xl">{copy.introTitle}</h2>
            <p className="mt-4 text-base leading-relaxed text-muted">{copy.introBody}</p>
            <p className="mt-3 text-xs text-muted">
              <time dateTime={copy.lastReviewed}>{dict.marketing.lastReviewed}: {new Intl.DateTimeFormat(intlLocale(locale), { day: "numeric", month: "long", year: "numeric" }).format(new Date(copy.lastReviewed))}</time>
            </p>
          </Reveal>
        </div>
      </section>

      <section className="border-y border-line bg-panel py-16 sm:py-20">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
          <SectionHeading eyebrow={copy.eyebrow} title={copy.table.title} subtitle={copy.table.subtitle} />
          <Reveal>
            <div className="mt-8 overflow-x-auto rounded-2xl border border-line bg-page shadow-sm">
              <table className="w-full min-w-[44rem] border-collapse text-left text-sm">
                <caption className="sr-only">{copy.table.title}</caption>
                <thead>
                  <tr className="border-b border-line bg-page-soft/70">
                    <th scope="col" className="px-4 py-3 font-bold text-heading">
                      {dict.marketing.compareCapability}
                    </th>
                    {copy.table.columns.map((column) => (
                      <th key={column} scope="col" className="px-4 py-3 font-bold text-heading">
                        {column}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {copy.table.rows.map((row) => (
                    <tr key={row.label}>
                      <th scope="row" className="px-4 py-3 font-semibold text-heading">
                        {row.label}
                      </th>
                      {row.values.map((value, index) => (
                        <td key={`${row.label}-${copy.table.columns[index]}`} className="px-4 py-3 text-muted">
                          {value}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-4 max-w-3xl text-xs leading-relaxed text-muted">{copy.table.note}</p>
          </Reveal>
        </div>
      </section>

      <section className="py-16 sm:py-20">
        <div className="mx-auto w-full max-w-4xl px-4 sm:px-6 lg:px-8">
          <SectionHeading eyebrow={copy.eyebrow} title={copy.faqTitle} />
          <div className="mt-8">
            <FaqList items={copy.faq} />
          </div>
        </div>
      </section>

      <section className="border-t border-line bg-panel py-16 sm:py-20">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
          <SectionHeading eyebrow={copy.eyebrow} title={copy.linksTitle} />
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {copy.links.map((link) => (
              <Link
                key={link.href}
                href={`/${locale}${link.href}`}
                className="rounded-2xl border border-line bg-page p-5 transition hover:border-accent-line hover:shadow-soft"
              >
                <p className="text-sm font-bold text-heading">{link.label}</p>
                <p className="mt-2 text-sm leading-relaxed text-muted">{link.description}</p>
                <span className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-accent-strong">
                  {dict.marketing.readMore}
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <CtaBand {...copy.cta} locale={locale} />
    </>
  );
}
