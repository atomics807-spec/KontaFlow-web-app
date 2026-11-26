import type { Metadata } from "next";
import { Globe2, MessageCircle, Phone, Sparkles } from "lucide-react";
import { PageHero } from "@/components/marketing/page-hero";
import { ChannelsSection, CtaSection } from "@/components/marketing/sections";
import { Reveal } from "@/components/motion/reveal";
import { getDictionary } from "@/lib/i18n/server";
import { resolveLocale } from "@/lib/i18n/config";
import { marketingMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const locale = resolveLocale((await params).locale);
  const dict = await getDictionary(locale);
  return marketingMetadata({
    locale,
    path: "/channels",
    title: dict.marketing.channelsTitle,
    description: dict.marketing.channelsSubtitle,
  });
}

export default async function ChannelsPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = resolveLocale((await params).locale);
  const dict = await getDictionary(locale);
  const m = dict.marketing;
  const p = dict.pages.channels;

  const rows = [
    { channel: m.channelWebTitle, icon: Globe2, data: p.yes, phone: p.yes, offline: p.partial },
    { channel: m.channelUssdTitle, icon: Phone, data: p.noData, phone: p.anyPhone, offline: p.yes },
    { channel: m.channelWhatsappTitle, icon: MessageCircle, data: p.yes, phone: p.yes, offline: p.no },
    { channel: m.channelAiTitle, icon: Sparkles, data: p.yes, phone: p.yes, offline: p.no },
  ];

  const integrations = [
    { title: p.integration1Title, description: p.integration1Desc },
    { title: p.integration2Title, description: p.integration2Desc },
    { title: p.integration3Title, description: p.integration3Desc },
  ];

  return (
    <>
      <PageHero
        eyebrow={p.eyebrow}
        title={m.channelsTitle}
        subtitle={m.channelsSubtitle}
        primaryHref={`/${locale}/signup`}
        primaryLabel={m.getStarted}
        secondaryHref={`/${locale}/contact`}
        secondaryLabel={m.contact}
      />
      <ChannelsSection />

      <section className="py-16 sm:py-20">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
          <Reveal>
            <h2 className="text-2xl font-extrabold tracking-tight text-heading sm:text-3xl">{p.tableTitle}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">{p.tableSubtitle}</p>
          </Reveal>
          <Reveal delay={0.05}>
            <div className="mt-6 overflow-x-auto rounded-2xl border border-line bg-panel shadow-sm">
              <table className="w-full min-w-[34rem] border-collapse text-left text-sm">
                <caption className="sr-only">{p.tableTitle}</caption>
                <thead>
                  <tr className="border-b border-line bg-panel-muted/60">
                    <th scope="col" className="px-4 py-3 font-bold text-heading">
                      {p.colChannel}
                    </th>
                    <th scope="col" className="px-4 py-3 font-bold text-heading">
                      {p.colData}
                    </th>
                    <th scope="col" className="px-4 py-3 font-bold text-heading">
                      {p.colSmartphone}
                    </th>
                    <th scope="col" className="px-4 py-3 font-bold text-heading">
                      {p.colOffline}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.channel} className="border-b border-line/70 last:border-0">
                      <th scope="row" className="flex items-center gap-2 px-4 py-3 font-semibold text-heading">
                        <row.icon className="h-4 w-4 text-accent-strong" aria-hidden />
                        {row.channel}
                      </th>
                      <td className="px-4 py-3 text-muted">{row.data}</td>
                      <td className="px-4 py-3 text-muted">{row.phone}</td>
                      <td className="px-4 py-3 text-muted">{row.offline}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="border-y border-line bg-panel py-16 sm:py-20">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
          <Reveal>
            <h2 className="text-2xl font-extrabold tracking-tight text-heading sm:text-3xl">{p.integrationTitle}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">{p.integrationSubtitle}</p>
          </Reveal>
          <div className="mt-7 grid gap-4 md:grid-cols-3">
            {integrations.map((item, index) => (
              <Reveal key={item.title} delay={index * 0.05}>
                <div className="h-full rounded-2xl border border-line bg-panel p-5">
                  <p className="text-sm font-bold text-heading">{item.title}</p>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{item.description}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <CtaSection />
    </>
  );
}
