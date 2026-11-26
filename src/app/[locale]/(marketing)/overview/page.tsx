import type { Metadata } from "next";
import { Hero } from "@/components/marketing/hero";
import { CtaSection, FeaturesSection, HowSection, ShowcaseSection } from "@/components/marketing/sections";
import { getDictionary } from "@/lib/i18n/server";
import { resolveLocale } from "@/lib/i18n/config";
import { marketingMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const locale = resolveLocale((await params).locale);
  const dict = await getDictionary(locale);
  return marketingMetadata({
    locale,
    path: "/overview",
    title: dict.pages.overview.eyebrow,
    description: dict.marketing.heroSubtitle,
  });
}

export default function OverviewPage() {
  return (
    <>
      <Hero />
      <FeaturesSection />
      <ShowcaseSection />
      <HowSection />
      <CtaSection />
    </>
  );
}
