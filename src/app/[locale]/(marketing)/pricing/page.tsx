import type { Metadata } from "next";
import { ChevronDown } from "lucide-react";
import { PageHero } from "@/components/marketing/page-hero";
import { CtaSection, PricingSection } from "@/components/marketing/sections";
import { Reveal } from "@/components/motion/reveal";
import { getDictionary } from "@/lib/i18n/server";
import { resolveLocale } from "@/lib/i18n/config";
import { marketingMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const locale = resolveLocale((await params).locale);
  const dict = await getDictionary(locale);
  return marketingMetadata({
    locale,
    path: "/pricing",
    title: dict.marketing.pricingTitle,
    description: dict.marketing.pricingSubtitle,
  });
}

export default async function PricingPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = resolveLocale((await params).locale);
  const dict = await getDictionary(locale);
  const m = dict.marketing;
  const p = dict.pages.pricing;

  const faqs = [
    { question: p.faq1Q, answer: p.faq1A },
    { question: p.faq2Q, answer: p.faq2A },
    { question: p.faq3Q, answer: p.faq3A },
  ];

  return (
    <>
      <PageHero
        eyebrow={p.eyebrow}
        title={m.pricingTitle}
        subtitle={m.pricingSubtitle}
        primaryHref={`/${locale}/signup`}
        primaryLabel={m.getStarted}
        secondaryHref={`/${locale}/contact`}
        secondaryLabel={m.contact}
      />
      <PricingSection />
      <p className="mx-auto -mt-6 w-full max-w-6xl px-4 pb-10 text-center text-xs text-muted sm:px-6 lg:px-8">
        {p.note}
      </p>

      <section className="border-y border-line bg-panel py-16 sm:py-20">
        <div className="mx-auto w-full max-w-3xl px-4 sm:px-6 lg:px-8">
          <Reveal>
            <h2 className="text-2xl font-extrabold tracking-tight text-heading sm:text-3xl">{p.faqTitle}</h2>
          </Reveal>
          <div className="mt-6 space-y-3">
            {faqs.map((faq, index) => (
              <Reveal key={faq.question} delay={index * 0.04}>
                <details className="group rounded-2xl border border-line bg-panel px-4 py-3 open:shadow-sm">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-semibold text-heading">
                    {faq.question}
                    <ChevronDown
                      className="h-4 w-4 shrink-0 text-muted transition-transform group-open:rotate-180"
                      aria-hidden
                    />
                  </summary>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{faq.answer}</p>
                </details>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <CtaSection />
    </>
  );
}
