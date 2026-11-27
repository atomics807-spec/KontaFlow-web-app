import { JsonLd } from "@/components/seo/json-ld";
import { MarketingFooter } from "@/components/layout/marketing-footer";
import { MarketingHeader } from "@/components/layout/marketing-header";
import { getSiteContent } from "@/lib/content";
import { resolveLocale } from "@/lib/i18n/config";
import { organizationSchema, websiteSchema } from "@/lib/structured-data";

export default async function MarketingLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const locale = resolveLocale((await params).locale);
  const content = await getSiteContent(locale);

  return (
    <>
      <JsonLd
        data={[
          organizationSchema(locale, content.home.metaDescription),
          websiteSchema(),
        ]}
      />
      <MarketingHeader />
      <main id="main">{children}</main>
      <MarketingFooter />
    </>
  );
}
