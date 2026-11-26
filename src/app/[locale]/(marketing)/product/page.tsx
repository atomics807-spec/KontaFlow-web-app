import type { Metadata } from "next";
import { PageHero } from "@/components/marketing/page-hero";
import { CtaSection, FeaturesSection, HowSection, ShowcaseSection } from "@/components/marketing/sections";
import { getDictionary } from "@/lib/i18n/server";
import { resolveLocale } from "@/lib/i18n/config";
import { marketingMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const locale = resolveLocale((await params).locale);
  const dict = await getDictionary(locale);
  return marketingMetadata({
    locale,
    path: "/product",
    title: dict.marketing.featuresTitle,
    description: dict.marketing.featuresSubtitle,
  });
}

export default async function ProductPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = resolveLocale((await params).locale);
  const dict = await getDictionary(locale);
  const m = dict.marketing;

  return (
    <>
      <PageHero
        eyebrow={dict.pages.product.eyebrow}
        title={m.featuresTitle}
        subtitle={m.featuresSubtitle}
        primaryHref={`/${locale}/signup`}
        primaryLabel={m.getStarted}
        secondaryHref={`/${locale}/pricing`}
        secondaryLabel={m.navPricing}
      />
      <FeaturesSection />
      <ShowcaseSection />
      <HowSection />
      <CtaSection />
    </>
  );
}
