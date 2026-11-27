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
    path: "/about",
    title: content.about.metaTitle,
    description: content.about.metaDescription,
    image: content.about.image,
  });
}

export default async function AboutPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = resolveLocale((await params).locale);
  const [content, dict] = await Promise.all([getSiteContent(locale), getDictionary(locale)]);
  return (
    <DetailPage
      page={content.about}
      locale={locale}
      primaryHref={`/${locale}/signup`}
      primaryLabel={content.common.startTrial}
      breadcrumbs={[{ label: dict.marketing.navAbout }]}
      breadcrumbLabel={content.common.breadcrumb}
      homeLabel={content.common.home}
      secondaryHref={`/${locale}/features`}
      secondaryLabel={dict.marketing.navFeatures}
    />
  );
}
