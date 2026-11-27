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
    path: "/features",
    title: content.features.metaTitle,
    description: content.features.metaDescription,
    image: content.features.image,
  });
}

export default async function FeaturesPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = resolveLocale((await params).locale);
  const [content, dict] = await Promise.all([getSiteContent(locale), getDictionary(locale)]);
  return (
    <DetailPage
      page={content.features}
      locale={locale}
      primaryHref={`/${locale}/signup`}
      primaryLabel={content.common.startTrial}
      breadcrumbs={[{ label: dict.marketing.navFeatures }]}
      breadcrumbLabel={content.common.breadcrumb}
      homeLabel={content.common.home}
      secondaryHref={`/${locale}/how-it-works`}
      secondaryLabel={dict.marketing.navHow}
    />
  );
}
