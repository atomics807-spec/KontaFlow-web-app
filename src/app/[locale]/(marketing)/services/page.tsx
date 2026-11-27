import type { Metadata } from "next";
import { DetailPage } from "@/components/marketing/detail-page";
import { getSiteContent } from "@/lib/content";
import { getDictionary } from "@/lib/i18n/server";
import { resolveLocale } from "@/lib/i18n/config";
import { marketingMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const locale = resolveLocale((await params).locale);
  const content = await getSiteContent(locale);
  return marketingMetadata({
    locale,
    path: "/services",
    title: content.services.metaTitle,
    description: content.services.metaDescription,
    image: content.services.image,
  });
}

export default async function ServicesPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = resolveLocale((await params).locale);
  const [content, dict] = await Promise.all([getSiteContent(locale), getDictionary(locale)]);
  return (
    <DetailPage
      page={content.services}
      locale={locale}
      primaryHref={`/${locale}/contact`}
      primaryLabel={content.common.talkToUs}
      breadcrumbs={[{ label: dict.marketing.navServices }]}
      breadcrumbLabel={content.common.breadcrumb}
      homeLabel={content.common.home}
      secondaryHref={`/${locale}/pricing`}
      secondaryLabel={dict.marketing.navPricing}
    />
  );
}
