import type { Metadata } from "next";
import { MarketingHeader } from "@/components/layout/marketing-header";
import { MarketingFooter } from "@/components/layout/marketing-footer";
import { Hero } from "@/components/marketing/hero";
import {
  ChannelsSection,
  CtaSection,
  FeaturesSection,
  HowSection,
  PricingSection,
  SecuritySection,
} from "@/components/marketing/sections";
import { getDictionary } from "@/lib/i18n/server";
import { resolveLocale } from "@/lib/i18n/config";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const locale = resolveLocale((await params).locale);
  const dict = await getDictionary(locale);
  return {
    title: `${dict.common.appName} — ${dict.common.tagline}`,
    description: dict.marketing.heroSubtitle,
  };
}

export default async function LandingPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = resolveLocale((await params).locale);
  const dict = await getDictionary(locale);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "KontaFlow",
    applicationCategory: "FinanceApplication",
    operatingSystem: "Web, Android, iOS",
    inLanguage: [locale],
    description: dict.marketing.heroSubtitle,
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "XAF",
    },
    areaServed: ["CM", "CI", "SN", "GA", "NG"],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <MarketingHeader />
      <main id="main">
        <Hero />
        <ChannelsSection />
        <FeaturesSection />
        <HowSection />
        <SecuritySection />
        <PricingSection />
        <CtaSection />
      </main>
      <MarketingFooter />
    </>
  );
}
