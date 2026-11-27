import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BookOpenCheck, HardDrive, KeyRound, Lock, Mail, ScrollText, Webhook } from "lucide-react";
import { PageHero, SectionHeading } from "@/components/marketing/site";
import { Reveal } from "@/components/motion/reveal";
import { getSiteContent } from "@/lib/content";
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
    image: "/images/marketing/security-home-office.webp",
  });
}

export default async function SecurityPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = resolveLocale((await params).locale);
  const [dict, content] = await Promise.all([getDictionary(locale), getSiteContent(locale)]);
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
        page={{
          eyebrow: p.eyebrow,
          title: p.title,
          subtitle: p.subtitle,
          image: "/images/marketing/security-home-office.webp",
          imageAlt: content.common.illustrativePhotoAlt,
          imageCaption: content.common.illustrativePhoto,
        }}
        locale={locale}
        primaryHref={`/${locale}/contact`}
        primaryLabel={dict.marketing.contact}
        secondaryHref={`/${locale}/legal/privacy`}
        secondaryLabel={dict.marketing.privacy}
        breadcrumbs={[{ label: dict.marketing.navSecurity }]}
        breadcrumbLabel={content.common.breadcrumb}
        homeLabel={content.common.home}
      />

      <section className="py-16 sm:py-20">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
          <SectionHeading eyebrow={dict.marketing.navSecurity} title={p.controlsTitle} />
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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

          <div className="mt-8 grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-line bg-panel p-6">
              <h2 className="text-lg font-extrabold text-heading">{p.reportTitle}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">{p.reportBody}</p>
              <a
                href="mailto:security@kontaflow.com"
                className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-accent-strong hover:underline"
              >
                <Mail className="h-4 w-4" aria-hidden />
                security@kontaflow.com
              </a>
            </div>
            <div className="rounded-2xl border border-jade-200 bg-accent-soft p-6">
              <h2 className="text-lg font-extrabold text-heading">{p.policiesTitle}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">{p.policiesBody}</p>
              <ul className="mt-4 space-y-2 text-sm font-semibold">
                {[
                  { label: dict.marketing.privacy, slug: "privacy" },
                  { label: dict.marketing.cookies, slug: "cookies" },
                  { label: dict.marketing.dataProcessing, slug: "data-processing" },
                  { label: dict.marketing.acceptableUse, slug: "acceptable-use" },
                ].map((item) => (
                  <li key={item.slug}>
                    <Link href={`/${locale}/legal/${item.slug}`} className="inline-flex items-center gap-1.5 text-accent-strong hover:underline">
                      {item.label}
                      <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
