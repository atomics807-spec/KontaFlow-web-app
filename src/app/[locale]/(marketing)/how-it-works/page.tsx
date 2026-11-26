import type { Metadata } from "next";
import { Check } from "lucide-react";
import { CtaBand, PageHero, ProseSections, SectionHeading } from "@/components/marketing/site";
import { Reveal } from "@/components/motion/reveal";
import { getSiteContent } from "@/lib/content";
import { getDictionary } from "@/lib/i18n/server";
import { resolveLocale } from "@/lib/i18n/config";
import { marketingMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const locale = resolveLocale((await params).locale);
  const content = await getSiteContent(locale);
  return marketingMetadata({
    locale,
    path: "/how-it-works",
    title: content.how.metaTitle,
    description: content.how.metaDescription,
    image: content.how.image,
  });
}

export default async function HowItWorksPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = resolveLocale((await params).locale);
  const [content, dict] = await Promise.all([getSiteContent(locale), getDictionary(locale)]);
  const page = content.how;

  return (
    <>
      <PageHero
        page={page}
        locale={locale}
        primaryHref={`/${locale}/signup`}
        primaryLabel={content.common.startTrial}
        secondaryHref={`/${locale}/features`}
        secondaryLabel={dict.marketing.navFeatures}
      />

      <section className="py-16 sm:py-20">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-14 max-w-3xl">
            <h2 className="text-2xl font-extrabold tracking-tight text-heading sm:text-3xl">{page.introTitle}</h2>
            <p className="mt-4 text-base leading-relaxed text-muted">{page.introBody}</p>
          </div>

          <ol className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {page.steps.map((step, index) => (
              <li key={step.title} className="relative">
                <Reveal delay={index * 0.05}>
                  <div className="h-full rounded-2xl border border-line bg-panel p-6">
                    <span className="kpi-value grid h-10 w-10 place-items-center rounded-full bg-forest text-xs font-bold text-white">
                      0{index + 1}
                    </span>
                    <h3 className="mt-5 text-base font-bold text-heading">{step.title}</h3>
                    <p className="mt-2 text-sm font-medium leading-relaxed text-heading/80">{step.body}</p>
                    <p className="mt-3 text-sm leading-relaxed text-muted">{step.detail}</p>
                  </div>
                </Reveal>
                {index < page.steps.length - 1 ? (
                  <span
                    aria-hidden
                    className="absolute -bottom-2 left-1/2 hidden h-4 w-px bg-line-strong xl:left-auto xl:-right-2 xl:top-1/2 xl:block xl:h-px xl:w-4"
                  />
                ) : null}
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="border-y border-line bg-panel py-16 sm:py-20">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
          <SectionHeading eyebrow={page.eyebrow} title={page.matrixTitle} subtitle={page.matrixSubtitle} />
          <Reveal>
            <div className="mt-10 overflow-x-auto rounded-2xl border border-line bg-page">
              <table className="w-full min-w-[38rem] text-left text-sm">
                <thead className="border-b border-line bg-page-soft/70 text-[0.65rem] uppercase tracking-[0.08em] text-muted">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-semibold">Channel</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Data</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Smartphone</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Offline</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {page.matrix.map((row) => (
                    <tr key={row.channel}>
                      <th scope="row" className="px-4 py-3 font-bold text-heading">{row.channel}</th>
                      <td className="px-4 py-3 text-muted">{row.data}</td>
                      <td className="px-4 py-3 text-muted">{row.smartphone}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5 text-muted">
                          <Check className="h-3.5 w-3.5 text-accent-strong" aria-hidden />
                          {row.offline}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="py-16 sm:py-20">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
          <ProseSections sections={page.sections} />
        </div>
      </section>

      <CtaBand {...page.cta} locale={locale} />
    </>
  );
}
