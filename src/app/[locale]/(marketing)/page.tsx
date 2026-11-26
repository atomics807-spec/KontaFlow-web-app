import type { Metadata } from "next";
import {
  AiSection,
  AnalysisSection,
  DashboardSection,
  FaqSection,
  HomeFinalCta,
  HomeHero,
  IncomeExpenseSection,
  IntelligenceSection,
  OfflineSection,
  PositioningSection,
  ProblemSection,
  ReportsSection,
  SolutionSection,
  SubscriptionSection,
  UssdSection,
  WhatsAppSection,
  type HomeLabels,
} from "@/components/marketing/home";
import { getSiteContent } from "@/lib/content";
import { getDictionary } from "@/lib/i18n/server";
import { resolveLocale } from "@/lib/i18n/config";
import { marketingMetadata } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const locale = resolveLocale((await params).locale);
  const content = await getSiteContent(locale);
  return marketingMetadata({
    locale,
    path: "",
    title: content.home.metaTitle,
    description: content.home.metaDescription,
    image: "/images/marketing/home-hero.webp",
  });
}

export default async function LandingPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = resolveLocale((await params).locale);
  const [content, dict] = await Promise.all([getSiteContent(locale), getDictionary(locale)]);

  const labels: HomeLabels = {
    income: dict.dashboard.income,
    expenses: dict.dashboard.expenses,
    profit: dict.dashboard.profit,
    cash: dict.dashboard.cashBalance,
    thisMonth: dict.dashboard.thisMonthLabel,
    recent: dict.dashboard.recentTransactions,
    sample: content.home.analysis.chart.sample,
    team: dict.nav.team,
    dashboard: dict.nav.overview,
    transactions: dict.nav.transactions,
    reports: dict.nav.reports,
    assistant: dict.nav.assistant,
    settings: dict.nav.settings,
    saved: dict.common.synced,
  };

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "KontaFlow",
      applicationCategory: "FinanceApplication",
      operatingSystem: "Web, Android, iOS",
      inLanguage: ["en", "fr", "wes"],
      description: content.home.metaDescription,
      offers: [
        { "@type": "Offer", price: "0", priceCurrency: "XAF", name: "Starter" },
        { "@type": "Offer", price: "9900", priceCurrency: "XAF", name: "Growth" },
        { "@type": "Offer", price: "29900", priceCurrency: "XAF", name: "Scale" },
      ],
      areaServed: ["CM", "CI", "SN", "GA", "NG"],
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: content.home.faq.items.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: { "@type": "Answer", text: item.answer },
      })),
    },
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <HomeHero locale={locale} copy={content.home} labels={labels} />
      <PositioningSection copy={content.home} />
      <ProblemSection copy={content.home} />
      <SolutionSection copy={content.home} />
      <AiSection copy={content.home} />
      <DashboardSection locale={locale} copy={content.home} labels={labels} />
      <IncomeExpenseSection copy={content.home} />
      <AnalysisSection copy={content.home} />
      <OfflineSection copy={content.home} />
      <WhatsAppSection copy={content.home} />
      <UssdSection copy={content.home} />
      <ReportsSection copy={content.home} />
      <IntelligenceSection copy={content.home} />
      <SubscriptionSection locale={locale} copy={content.home} />
      <FaqSection copy={content.home} />
      <HomeFinalCta locale={locale} copy={content.home} />
    </>
  );
}
