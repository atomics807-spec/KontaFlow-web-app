import type { Metadata } from "next";
import Link from "next/link";
import { Check } from "lucide-react";
import { FaqList, PageHero, PricingTiers, SectionHeading } from "@/components/marketing/site";
import { buttonVariants } from "@/components/ui/button";
import { getSiteContent } from "@/lib/content";
import { getDictionary } from "@/lib/i18n/server";
import { interpolate } from "@/lib/i18n/interpolate";
import { resolveLocale } from "@/lib/i18n/config";
import { getPlanCatalogue } from "@/services/plans";
import { formatMoney, moneyLocale } from "@/lib/money";
import { marketingMetadata } from "@/lib/seo";
import { JsonLd } from "@/components/seo/json-ld";
import { softwareApplicationSchema } from "@/lib/structured-data";
import { getCurrency } from "@/lib/currency";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const locale = resolveLocale((await params).locale);
  const content = await getSiteContent(locale);
  return marketingMetadata({
    locale,
    path: "/pricing",
    title: `${content.home.subscription.title} — KontaFlow`,
    description: content.home.subscription.subtitle,
    image: "/images/marketing/office-gadgets.webp",
  });
}

export default async function PricingPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = resolveLocale((await params).locale);
  const [content, dict, catalogue] = await Promise.all([
    getSiteContent(locale),
    getDictionary(locale),
    getPlanCatalogue().catch(() => []),
  ]);
  const pricing = content.home.subscription;
  const tiers = catalogue.length
    ? catalogue.map((plan) => ({
        name: plan.name,
        description: plan.description,
        price: plan.priceMinor === 0 ? "0" : formatMoney(BigInt(plan.priceMinor), plan.currency, moneyLocale(locale, plan.currency)),
        period: plan.priceMinor === 0 ? "" : dict.common.perMonth,
        cta: plan.priceMinor === 0 ? content.common.startTrial : content.common.talkToUs,
        featured: plan.code === "growth",
        features: [
          plan.transactionLimit
            ? interpolate(dict.plans.transactionsPerMonth, { count: plan.transactionLimit.toLocaleString() })
            : dict.plans.unlimitedTransactions,
          interpolate(dict.plans.seatsIncluded, { count: plan.seats }),
          plan.features.some((feature) => feature.code === "ai_bookkeeping" && feature.included)
            ? interpolate(dict.plans.aiMessagesIncluded, { count: plan.aiMessageLimit.toLocaleString() })
            : dict.plans.noAi,
          ...plan.features
            .filter((feature) => feature.included && feature.code !== "team_members")
            .map((feature) => dict.plans.featureNames[feature.code as keyof typeof dict.plans.featureNames])
            .filter((label): label is string => Boolean(label))
            .slice(0, 4),
        ],
      }))
    : pricing.tiers;
  const faqItems = content.home.faq.items.slice(0, 6);
  const refundTitle = content.legal.find((doc) => doc.slug === "refunds")?.title ?? content.legal[0].title;
  const offers = catalogue
    .filter((plan) => plan.priceMinor > 0)
    .map((plan) => {
      const decimals = getCurrency(plan.currency).decimals;
      const price = (plan.priceMinor / 10 ** decimals).toFixed(decimals).replace(/\.0+$/, "");
      return {
        name: plan.name,
        price,
        priceCurrency: plan.currency,
        description: plan.description,
      };
    });

  return (
    <>
      <JsonLd
        data={softwareApplicationSchema({
          locale,
          description: content.home.metaDescription,
          offers,
          featureList: pricing.included,
        })}
      />
      <PageHero
        page={{
          eyebrow: pricing.eyebrow,
          title: pricing.title,
          subtitle: pricing.subtitle,
          image: "/images/marketing/office-gadgets.webp",
          imageAlt: content.common.illustrativePhotoAlt,
          imageCaption: content.common.illustrativePhoto,
        }}
        locale={locale}
        primaryHref={`/${locale}/signup`}
        primaryLabel={content.common.startTrial}
        secondaryHref={`/${locale}/contact`}
        secondaryLabel={content.common.talkToUs}
        breadcrumbs={[{ label: dict.marketing.navPricing }]}
        breadcrumbLabel={content.common.breadcrumb}
        homeLabel={content.common.home}
      />
      <section className="py-16 sm:py-20">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <PricingTiers tiers={tiers} locale={locale} footnote={pricing.footnote} headingLevel={2} />
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
