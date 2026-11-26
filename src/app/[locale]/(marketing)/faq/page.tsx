import type { Metadata } from "next";
import { CtaBand, FaqList, PageHero } from "@/components/marketing/site";
import { getSiteContent } from "@/lib/content";
import { getDictionary } from "@/lib/i18n/server";
import { resolveLocale } from "@/lib/i18n/config";
import { marketingMetadata } from "@/lib/seo";

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

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: page.groups.flatMap((group) =>
      group.items.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: { "@type": "Answer", text: item.answer },
      })),
    ),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <PageHero
        page={{ ...page, imageCaption: content.common.illustrativePhoto }}
        locale={locale}
        primaryHref={`/${locale}/contact`}
        primaryLabel={content.common.talkToUs}
        secondaryHref={`/${locale}/pricing`}
        secondaryLabel={dict.marketing.navPricing}
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
