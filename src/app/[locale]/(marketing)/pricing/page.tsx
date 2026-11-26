import type { Metadata } from "next";
import Link from "next/link";
import { Check } from "lucide-react";
import { FaqList, PageHero, PricingTiers, SectionHeading } from "@/components/marketing/site";
import { buttonVariants } from "@/components/ui/button";
import { getSiteContent } from "@/lib/content";
import { getDictionary } from "@/lib/i18n/server";
import { resolveLocale } from "@/lib/i18n/config";
import { marketingMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const locale = resolveLocale((await params).locale);
  const content = await getSiteContent(locale);
  return marketingMetadata({
    locale,
    path: "/pricing",
    title: `${content.home.subscription.title} — KontaFlow`,
    description: content.home.subscription.subtitle,
    image: "/images/marketing/cafe-owner.webp",
  });
}

export default async function PricingPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = resolveLocale((await params).locale);
  const [content, dict] = await Promise.all([getSiteContent(locale), getDictionary(locale)]);
  const pricing = content.home.subscription;
  const faqItems = content.home.faq.items.slice(0, 6);
  const refundTitle = content.legal.find((doc) => doc.slug === "refunds")?.title ?? content.legal[0].title;

  return (
    <>
      <PageHero
        page={{
          eyebrow: pricing.eyebrow,
          title: pricing.title,
          subtitle: pricing.subtitle,
          image: "/images/marketing/cafe-owner.webp",
          imageAlt: content.common.illustrativePhotoAlt,
          imageCaption: content.common.illustrativePhoto,
        }}
        locale={locale}
        primaryHref={`/${locale}/signup`}
        primaryLabel={content.common.startTrial}
        secondaryHref={`/${locale}/contact`}
        secondaryLabel={content.common.talkToUs}
      />
      <section className="py-16 sm:py-20">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <PricingTiers tiers={pricing.tiers} locale={locale} footnote={pricing.footnote} headingLevel={2} />
          <div className="mt-12 rounded-2xl border border-line bg-panel p-6 sm:p-8">
            <h2 className="text-lg font-extrabold text-heading">{pricing.includedTitle}</h2>
            <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {pricing.included.map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-muted">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent-strong" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
            <p className="mt-6 max-w-2xl text-xs leading-relaxed text-muted">
              {dict.pages.pricing.refundPrefix}{" "}
              <Link href={`/${locale}/legal/refunds`} className="font-semibold text-accent-strong hover:underline">
                {refundTitle}
              </Link>
              {dict.pages.pricing.refundSuffix}
            </p>
          </div>
        </div>
      </section>
      <section className="border-y border-line bg-panel py-16 sm:py-20">
        <div className="mx-auto w-full max-w-4xl px-4 sm:px-6 lg:px-8">
          <SectionHeading eyebrow={content.home.faq.eyebrow} title={dict.pages.pricing.faqTitle} />
          <div className="mt-8">
            <FaqList items={faqItems} />
          </div>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href={`/${locale}/signup`} className={buttonVariants({ size: "lg" })}>
              {content.common.startTrial}
            </Link>
            <Link href={`/${locale}/contact`} className={buttonVariants({ variant: "secondary", size: "lg" })}>
              {content.common.talkToUs}
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
