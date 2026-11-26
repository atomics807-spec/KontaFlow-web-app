import type { Metadata } from "next";
import { Clock, Mail, MapPin, Timer } from "lucide-react";
import { PageHero } from "@/components/marketing/page-hero";
import { ContactForm } from "@/components/marketing/contact-form";
import { Reveal } from "@/components/motion/reveal";
import { getDictionary } from "@/lib/i18n/server";
import { resolveLocale } from "@/lib/i18n/config";
import { marketingMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const locale = resolveLocale((await params).locale);
  const dict = await getDictionary(locale);
  return marketingMetadata({
    locale,
    path: "/contact",
    title: dict.pages.contact.title,
    description: dict.pages.contact.subtitle,
  });
}

export default async function ContactPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = resolveLocale((await params).locale);
  const dict = await getDictionary(locale);
  const copy = dict.pages.contact;

  const details = [
    { icon: Mail, label: copy.infoEmailLabel, value: "hello@kontaflow.com", href: "mailto:hello@kontaflow.com" },
    { icon: MapPin, label: copy.infoOfficeLabel, value: copy.infoOfficeValue },
    { icon: Clock, label: copy.infoHoursLabel, value: copy.infoHoursValue },
    { icon: Timer, label: copy.infoResponseLabel, value: copy.infoResponseValue },
  ];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ContactPage",
    name: copy.title,
    description: copy.subtitle,
    inLanguage: locale,
    mainEntity: {
      "@type": "Organization",
      name: "KontaFlow",
      email: "hello@kontaflow.com",
      areaServed: "CM",
    },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <PageHero
        eyebrow={copy.eyebrow}
        title={copy.title}
        subtitle={copy.subtitle}
        primaryHref="#contact-form"
        primaryLabel={copy.formTitle}
        secondaryHref={`/${locale}/pricing`}
        secondaryLabel={dict.marketing.navPricing}
      />

      <section id="contact-form" className="scroll-mt-24 py-16 sm:py-20">
        <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 sm:px-6 lg:grid-cols-[1.25fr_0.75fr] lg:px-8">
          <Reveal>
            <ContactForm />
          </Reveal>

          <Reveal delay={0.06}>
            <div className="space-y-4">
              <div className="rounded-2xl border border-line bg-panel p-5">
                <p className="text-sm font-bold text-heading">{copy.directTitle}</p>
                <p className="mt-2 text-sm leading-relaxed text-muted">{copy.directSubtitle}</p>
                <a
                  href="mailto:hello@kontaflow.com"
                  className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-accent-strong hover:underline"
                >
                  <Mail className="h-4 w-4" aria-hidden />
                  hello@kontaflow.com
                </a>
              </div>

              <ul className="divide-y divide-line rounded-2xl border border-line bg-panel">
                {details.map((item) => (
                  <li key={item.label} className="flex items-start gap-3 p-4">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-panel-muted text-accent-strong">
                      <item.icon className="h-4 w-4" aria-hidden />
                    </span>
                    <div>
                      <p className="text-[0.7rem] font-bold uppercase tracking-[0.12em] text-muted">{item.label}</p>
                      {item.href ? (
                        <a href={item.href} className="mt-1 block text-sm font-semibold text-heading hover:underline">
                          {item.value}
                        </a>
                      ) : (
                        <p className="mt-1 text-sm font-semibold text-heading">{item.value}</p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>

              <p className="px-1 text-xs leading-relaxed text-muted">{copy.privacyNote}</p>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
