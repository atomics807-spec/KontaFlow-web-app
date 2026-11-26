import type { Metadata } from "next";
import { BookOpenCheck, HardDrive, KeyRound, Lock, ScrollText, Webhook } from "lucide-react";
import { PageHero } from "@/components/marketing/page-hero";
import { CtaSection, SecuritySection } from "@/components/marketing/sections";
import { Reveal } from "@/components/motion/reveal";
import { getDictionary } from "@/lib/i18n/server";
import { resolveLocale } from "@/lib/i18n/config";
import { marketingMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const locale = resolveLocale((await params).locale);
  const dict = await getDictionary(locale);
  return marketingMetadata({
    locale,
    path: "/security",
    title: dict.pages.security.title,
    description: dict.pages.security.subtitle,
  });
}

export default async function SecurityPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = resolveLocale((await params).locale);
  const dict = await getDictionary(locale);
  const p = dict.pages.security;

  const controls = [
    { icon: Lock, title: p.control1Title, description: p.control1Desc },
    { icon: KeyRound, title: p.control2Title, description: p.control2Desc },
    { icon: BookOpenCheck, title: p.control3Title, description: p.control3Desc },
    { icon: ScrollText, title: p.control4Title, description: p.control4Desc },
    { icon: HardDrive, title: p.control5Title, description: p.control5Desc },
    { icon: Webhook, title: p.control6Title, description: p.control6Desc },
  ];

  return (
    <>
      <PageHero
        eyebrow={p.eyebrow}
        title={p.title}
        subtitle={p.subtitle}
        primaryHref={`/${locale}/signup`}
        primaryLabel={dict.marketing.getStarted}
        secondaryHref={`/${locale}/contact`}
        secondaryLabel={dict.marketing.contact}
      />
      <SecuritySection />

      <section className="py-16 sm:py-20">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
          <Reveal>
            <h2 className="text-2xl font-extrabold tracking-tight text-heading sm:text-3xl">{p.controlsTitle}</h2>
          </Reveal>
          <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {controls.map((control, index) => (
              <Reveal key={control.title} delay={index * 0.04}>
                <div className="h-full rounded-2xl border border-line bg-panel p-5">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent-soft text-accent-strong">
                    <control.icon className="h-5 w-5" aria-hidden />
                  </span>
                  <p className="mt-4 text-sm font-bold text-heading">{control.title}</p>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{control.description}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section id="privacy" className="scroll-mt-24 border-t border-line py-16 sm:py-20">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
          <Reveal>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-accent-strong">{p.privacyEyebrow}</p>
            <h2 className="mt-3 text-2xl font-extrabold tracking-tight text-heading sm:text-3xl">{p.privacyTitle}</h2>
            <p className="mt-2 text-sm text-muted">{p.privacyUpdated}</p>
          </Reveal>
          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <Reveal>
              <div className="space-y-5 text-sm leading-relaxed text-muted">
                <p>{p.privacyIntro}</p>
                <div>
                  <h3 className="font-bold text-heading">{p.privacyDataTitle}.</h3>
                  <p className="mt-1">{p.privacyData}</p>
                </div>
                <div>
                  <h3 className="font-bold text-heading">{p.privacyUseTitle}.</h3>
                  <p className="mt-1">{p.privacyUse}</p>
                </div>
              </div>
            </Reveal>
            <Reveal delay={0.05}>
              <div className="space-y-5 text-sm leading-relaxed text-muted">
                <div>
                  <h3 className="font-bold text-heading">{p.privacyRetentionTitle}.</h3>
                  <p className="mt-1">{p.privacyRetention}</p>
                </div>
                <div>
                  <h3 className="font-bold text-heading">{p.privacyRightsTitle}.</h3>
                  <p className="mt-1">{p.privacyRights}</p>
                </div>
                <p className="rounded-xl border border-line bg-panel p-4 font-medium text-ink">
                  {p.privacyContact}
                </p>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      <CtaSection />
    </>
  );
}
