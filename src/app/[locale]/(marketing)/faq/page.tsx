import type { Metadata } from "next";
import { CtaBand, FaqList, PageHero } from "@/components/marketing/site";
import { getSiteContent } from "@/lib/content";
import { getDictionary } from "@/lib/i18n/server";
import { resolveLocale } from "@/lib/i18n/config";
import { marketingMetadata } from "@/lib/seo";
import { JsonLd } from "@/components/seo/json-ld";
import { webPageSchema } from "@/lib/structured-data";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const locale = resolveLocale((await params).locale);
  const content = await getSiteContent(locale);
  return marketingMetadata({
    locale,
    path: "/faq",
    title: content.faq.metaTitle,
    description: content.faq.metaDescription,
    image: content.faq.image,
  });
}

export default async function FaqPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = resolveLocale((await params).locale);
  const [content, dict] = await Promise.all([getSiteContent(locale), getDictionary(locale)]);
  const page = content.faq;

  const jsonLd = webPageSchema({
    locale,
    path: "/faq",
    name: page.metaTitle,
    description: page.metaDescription,
  });

  return (
    <>
      <JsonLd data={jsonLd} />
      <PageHero
        page={{ ...page, imageCaption: content.common.illustrativePhoto }}
        locale={locale}
        primaryHref={`/${locale}/contact`}
        primaryLabel={content.common.talkToUs}
        secondaryHref={`/${locale}/pricing`}
        secondaryLabel={dict.marketing.navPricing}
        breadcrumbs={[{ label: dict.marketing.navFaq }]}
        breadcrumbLabel={content.common.breadcrumb}
        homeLabel={content.common.home}
      />
      <section className="py-16 sm:py-20">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="space-y-10">
            {page.groups.map((group) => (
              <div key={group.title} className="grid gap-5 lg:grid-cols-[0.35fr_1fr] lg:gap-10">
                <h2 className="text-lg font-extrabold tracking-tight text-heading">{group.title}</h2>
                <FaqList items={group.items} />
              </div>
            ))}
          </div>
        </div>
      </section>
      <CtaBand {...page.cta} locale={locale} href="contact" secondaryHref="security" />
    </>
  );
}
