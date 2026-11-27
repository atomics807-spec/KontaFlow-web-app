import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { JsonLd } from "@/components/seo/json-ld";
import { CtaBand, PageHero, SectionHeading } from "@/components/marketing/site";
import { Reveal } from "@/components/motion/reveal";
import { getAeoContent } from "@/lib/content/aeo";
import { getSiteContent } from "@/lib/content";
import { getDictionary } from "@/lib/i18n/server";
import { intlLocale, resolveLocale } from "@/lib/i18n/config";
import { marketingMetadata } from "@/lib/seo";
import { definedTermSetSchema, webPageSchema } from "@/lib/structured-data";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const locale = resolveLocale((await params).locale);
  const copy = getAeoContent(locale).glossary;
  return marketingMetadata({
    locale,
    path: "/glossary",
    title: copy.metaTitle,
    description: copy.metaDescription,
    image: copy.image,
  });
}

export default async function GlossaryPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = resolveLocale((await params).locale);
  const [content, dict, copy] = await Promise.all([
    getSiteContent(locale),
    getDictionary(locale),
    Promise.resolve(getAeoContent(locale).glossary),
  ]);

  return (
    <>
      <JsonLd
        data={[
          webPageSchema({
            locale,
            path: "/glossary",
            name: copy.metaTitle,
            description: copy.metaDescription,
            dateModified: copy.lastReviewed,
          }),
          definedTermSetSchema({
            locale,
            path: "/glossary",
            name: copy.title,
            description: copy.metaDescription,
            terms: copy.terms,
          }),
        ]}
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
        secondaryHref={`/${locale}/compare`}
        secondaryLabel={dict.marketing.navCompare}
        breadcrumbs={[{ label: dict.marketing.navGlossary }]}
        breadcrumbLabel={content.common.breadcrumb}
        homeLabel={content.common.home}
      />

      <section className="py-16 sm:py-20">
        <div className="mx-auto w-full max-w-4xl px-4 sm:px-6 lg:px-8">
          <Reveal>
            <h2 className="text-2xl font-extrabold tracking-tight text-heading sm:text-3xl">{copy.introTitle}</h2>
            <p className="mt-4 text-base leading-relaxed text-muted">{copy.introBody}</p>
            <p className="mt-3 text-xs text-muted">
              <time dateTime={copy.lastReviewed}>{dict.marketing.lastReviewed}: {new Intl.DateTimeFormat(intlLocale(locale), { day: "numeric", month: "long", year: "numeric" }).format(new Date(copy.lastReviewed))}</time>
            </p>
          </Reveal>

          <Reveal>
            <dl className="mt-10 divide-y divide-line rounded-2xl border border-line bg-panel">
              {copy.terms.map((item) => (
                <div key={item.term} className="p-5 sm:p-6">
                  <dt className="text-lg font-extrabold tracking-tight text-heading">{item.term}</dt>
                  <dd className="mt-2 text-sm leading-relaxed text-muted">{item.definition}</dd>
                </div>
              ))}
            </dl>
          </Reveal>
        </div>
      </section>

      <section className="border-y border-line bg-panel py-16 sm:py-20">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
          <SectionHeading eyebrow={copy.eyebrow} title={copy.linksTitle} />
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
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
