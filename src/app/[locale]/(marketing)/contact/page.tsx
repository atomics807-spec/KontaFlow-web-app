import type { Metadata } from "next";
import { Clock, Mail, MapPin, MessageCircle, Phone, ShieldCheck, Timer } from "lucide-react";
import { CONTACT_DETAILS } from "@/lib/contact-details";
import { ContactForm } from "@/components/marketing/contact-form";
import { PageHero } from "@/components/marketing/site";
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
    path: "/contact",
    title: content.contact.metaTitle,
    description: content.contact.metaDescription,
    image: content.contact.image,
  });
}

export default async function ContactPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = resolveLocale((await params).locale);
  const [content, dict] = await Promise.all([getSiteContent(locale), getDictionary(locale)]);
  const copy = content.contact;
  const labels = dict.pages.contact;

  const details = [
    { icon: Mail, label: labels.infoEmailLabel, value: copy.email, href: `mailto:${copy.email}` },
    { icon: Phone, label: labels.infoPhoneLabel, value: CONTACT_DETAILS.phoneCalls, href: CONTACT_DETAILS.telCalls },
    {
      icon: MessageCircle,
      label: labels.infoWhatsappLabel,
      value: CONTACT_DETAILS.phoneWhatsApp,
      href: CONTACT_DETAILS.whatsappUrl,
      external: true,
    },
    { icon: MapPin, label: labels.infoOfficeLabel, value: copy.location },
    { icon: Clock, label: labels.infoHoursLabel, value: copy.hours },
    { icon: Timer, label: labels.infoResponseLabel, value: labels.infoResponseValue },
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
      email: copy.email,
      telephone: CONTACT_DETAILS.phoneCalls,
      areaServed: "CM",
    },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <PageHero
        page={{
          eyebrow: copy.eyebrow,
          title: copy.title,
          subtitle: copy.subtitle,
          image: copy.image,
          imageAlt: copy.imageAlt,
          imageCaption: content.common.illustrativePhoto,
        }}
        locale={locale}
        primaryHref="#contact-form"
        primaryLabel={labels.formTitle}
        secondaryHref={`/${locale}/pricing`}
        secondaryLabel={dict.marketing.navPricing}
      />

      <section id="contact-form" className="scroll-mt-24 py-16 sm:py-20">
        <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 sm:px-6 lg:grid-cols-[1.2fr_0.8fr] lg:px-8">
          <Reveal>
            <ContactForm />
          </Reveal>

          <Reveal delay={0.06}>
            <div className="space-y-4">
              <div className="rounded-2xl border border-line bg-panel p-5">
                <p className="text-sm font-bold text-heading">{labels.directTitle}</p>
                <p className="mt-2 text-sm leading-relaxed text-muted">{labels.directSubtitle}</p>
                <a
                  href={`mailto:${copy.email}`}
                  className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-accent-strong hover:underline"
                >
                  <Mail className="h-4 w-4" aria-hidden />
                  {copy.email}
                </a>
              </div>

              <div className="rounded-2xl border border-line bg-panel p-5">
                <p className="text-[0.68rem] font-bold uppercase tracking-[0.12em] text-accent">{copy.nextTitle}</p>
                <ol className="mt-3 space-y-3">
                  {copy.nextSteps.map((step, index) => (
                    <li key={step} className="flex items-start gap-3 text-sm leading-relaxed text-muted">
                      <span className="kpi-value grid h-6 w-6 shrink-0 place-items-center rounded-full bg-accent-soft text-[0.62rem] font-bold text-accent-strong">
                        {index + 1}
                      </span>
                      {step}
                    </li>
                  ))}
                </ol>
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
                        <a
                          href={item.href}
                          className="mt-1 block text-sm font-semibold text-heading hover:underline"
                          {...("external" in item && item.external ? { target: "_blank", rel: "noreferrer" } : {})}
                        >
                          {item.value}
                        </a>
                      ) : (
                        <p className="mt-1 text-sm font-semibold text-heading">{item.value}</p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>

              <div className="flex items-start gap-3 rounded-2xl border border-jade-200 bg-accent-soft p-4">
                <ShieldCheck className="h-4 w-4 shrink-0 text-accent-strong" aria-hidden />
                <p className="text-xs leading-relaxed text-heading">
                  {labels.privacyNote} {copy.privacyEmail}
                </p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
