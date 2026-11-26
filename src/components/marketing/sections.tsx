"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "motion/react";
import {
  ArrowRight,
  BookOpenCheck,
  Check,
  FileBarChart2,
  Globe2,
  Lock,
  MessageCircle,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Users,
  WifiOff,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Reveal } from "@/components/motion/reveal";
import { useI18n } from "@/components/layout/i18n-provider";
import { cn } from "@/lib/utils";

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className="text-[0.7rem] font-bold uppercase tracking-[0.16em] text-accent">{eyebrow}</p>
      <h2 className="mt-3 text-balance text-3xl font-extrabold tracking-tight text-heading sm:text-4xl">{title}</h2>
      {description ? <p className="mt-4 text-balance text-base leading-relaxed text-muted">{description}</p> : null}
    </div>
  );
}

export function ChannelsSection() {
  const { dict } = useI18n();
  const m = dict.marketing;

  const channels = [
    { icon: Globe2, title: m.channelWebTitle, description: m.channelWebDesc, tag: "PWA" },
    { icon: Smartphone, title: m.channelUssdTitle, description: m.channelUssdDesc, tag: "*384*12#" },
    { icon: MessageCircle, title: m.channelWhatsappTitle, description: m.channelWhatsappDesc, tag: "WhatsApp" },
    { icon: Sparkles, title: m.channelAiTitle, description: m.channelAiDesc, tag: "AI" },
  ];

  return (
    <section id="channels" className="scroll-mt-24 py-20">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading eyebrow={m.navChannels} title={m.channelsTitle} description={m.channelsSubtitle} />

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {channels.map((channel, index) => (
            <motion.article
              key={channel.title}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: index * 0.06 }}
              className="group relative overflow-hidden rounded-2xl border border-line bg-panel p-5 transition hover:-translate-y-0.5 hover:border-accent-line hover:shadow-[0_20px_50px_-30px_rgba(8,60,45,0.5)]"
            >
              <div className="flex items-center justify-between">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent-soft text-accent">
                  <channel.icon className="h-5 w-5" aria-hidden />
                </span>
                <span className="rounded-full border border-line px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wider text-muted">
                  {channel.tag}
                </span>
              </div>
              <h3 className="mt-4 text-base font-bold text-heading">{channel.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{channel.description}</p>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function FeaturesSection() {
  const { dict } = useI18n();
  const m = dict.marketing;

  const features = [
    { icon: BookOpenCheck, title: m.feature1Title, description: m.feature1Desc },
    { icon: Users, title: m.feature2Title, description: m.feature2Desc },
    { icon: WifiOff, title: m.feature3Title, description: m.feature3Desc },
    { icon: FileBarChart2, title: m.feature4Title, description: m.feature4Desc },
    { icon: Sparkles, title: m.feature5Title, description: m.feature5Desc },
    { icon: ShieldCheck, title: m.feature6Title, description: m.feature6Desc },
  ];

  return (
    <section id="features" className="scroll-mt-24 border-y border-line bg-panel py-20">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading eyebrow={m.navFeatures} title={m.featuresTitle} description={m.featuresSubtitle} />
        <div className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.45, delay: (index % 3) * 0.05 }}
              className="bg-panel p-6 transition hover:bg-page/60"
            >
              <feature.icon className="h-5 w-5 text-accent-strong" aria-hidden />
              <h3 className="mt-4 text-base font-bold text-heading">{feature.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function HowSection() {
  const { dict } = useI18n();
  const m = dict.marketing;
  const steps = [
    { title: m.step1Title, description: m.step1Desc },
    { title: m.step2Title, description: m.step2Desc },
    { title: m.step3Title, description: m.step3Desc },
  ];

  return (
    <section className="py-20">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading eyebrow="01 — 03" title={m.howTitle} description={m.howSubtitle} />
        <ol className="mt-12 grid gap-5 md:grid-cols-3">
          {steps.map((step, index) => (
            <li key={step.title} className="relative rounded-2xl border border-line bg-panel p-6">
              <span className="kpi-value absolute -top-4 left-6 rounded-full bg-forest px-3 py-1 text-xs font-semibold text-white">
                0{index + 1}
              </span>
              <h3 className="mt-3 text-base font-bold text-heading">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{step.description}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function SecuritySection() {
  const { dict } = useI18n();

  return (
    <section id="security" className="scroll-mt-24 border-y border-line bg-forest py-20 text-white">
      <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8">
        <div>
          <p className="text-[0.7rem] font-bold uppercase tracking-[0.16em] text-jade-300">
            {dict.marketing.navSecurity}
          </p>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">
            {dict.roles.ownerDesc.split(",")[0]}, and nothing more.
          </h2>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-jade-100/80">
            {dict.marketing.feature6Desc}
          </p>
          <p className="mt-8 font-mono text-[0.7rem] uppercase tracking-[0.14em] text-jade-300/80">
            RLS · RBAC · Audit trail · Africa/Douala
          </p>
        </div>

        <ul className="grid gap-3 sm:grid-cols-2">
          {[
            { icon: Lock, text: dict.settings.auditSubtitle },
            { icon: ShieldCheck, text: dict.roles.staffDesc },
            { icon: Users, text: dict.settings.membersSubtitle },
            { icon: BookOpenCheck, text: dict.reports.subtitle },
          ].map((item) => (
            <li key={item.text} className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <item.icon className="h-4 w-4 text-mango-400" aria-hidden />
              <p className="mt-3 text-sm leading-relaxed text-jade-50/85">{item.text}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function PricingSection() {
  const { locale, dict } = useI18n();
  const m = dict.marketing;
  const p = dict.plans;

  const plans = [
    {
      key: "starter",
      name: p.starter,
      description: p.starterDesc,
      price: m.pricingStarterPrice,
      features: [m.pricingFeature1, m.pricingFeature2, m.pricingFeature3, m.pricingFeature4],
      popular: false,
    },
    {
      key: "growth",
      name: p.growth,
      description: p.growthDesc,
      price: m.pricingGrowthPrice,
      features: [m.pricingFeature5, m.pricingFeature2, m.pricingFeature3, m.pricingFeature4, m.pricingFeature9],
      popular: true,
    },
    {
      key: "scale",
      name: p.scale,
      description: p.scaleDesc,
      price: m.pricingScalePrice,
      features: [m.pricingFeature7, m.pricingFeature6, m.pricingFeature2, m.pricingFeature8, m.pricingFeature9],
      popular: false,
    },
  ];

  return (
    <section id="pricing" className="scroll-mt-24 py-20">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading eyebrow={m.navPricing} title={m.pricingTitle} description={m.pricingSubtitle} />

        <div className="mt-12 grid gap-5 lg:grid-cols-3">
          {plans.map((plan) => (
            <div
              key={plan.key}
              className={
                plan.popular
                  ? "relative rounded-2xl border-2 border-jade-600 bg-panel p-6 shadow-[0_30px_70px_-40px_rgba(8,60,45,0.55)]"
                  : "relative rounded-2xl border border-line bg-panel p-6"
              }
            >
              {plan.popular ? (
                <span className="absolute -top-3 left-6 rounded-full bg-jade-600 px-3 py-1 text-[0.65rem] font-bold uppercase tracking-wider text-white">
                  {m.pricingMostPopular}
                </span>
              ) : null}
              <h3 className="text-lg font-bold text-heading">{plan.name}</h3>
              <p className="mt-1 text-sm text-muted">{plan.description}</p>
              <p className="mt-5 flex items-baseline gap-1.5">
                <span className="kpi-value text-3xl font-semibold text-heading">{plan.price}</span>
                <span className="text-sm font-medium text-muted">FCFA{dict.common.perMonth}</span>
              </p>
              <Link
                href={`/${locale}/signup`}
                className={buttonVariants({
                  variant: plan.popular ? "primary" : "secondary",
                  className: "mt-5 w-full",
                })}
              >
                {plan.price === "0" ? m.getStarted : p.contactUs}
              </Link>
              <ul className="mt-6 space-y-2.5">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm text-muted">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent-strong" aria-hidden />
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const SHOWCASE = [
  { key: 1, image: "/illustrations/bookkeeping.svg", width: 560, height: 420 },
  { key: 2, image: "/illustrations/reports.svg", width: 560, height: 420 },
  { key: 3, image: "/illustrations/ai-insights.svg", width: 560, height: 420 },
  { key: 4, image: "/illustrations/mobile-access.svg", width: 560, height: 420 },
] as const;

export function ShowcaseSection() {
  const { dict } = useI18n();
  const m = dict.marketing;
  const items = SHOWCASE.map((item) => {
    const suffix = item.key as 1 | 2 | 3 | 4;
    return {
      ...item,
      title: m[`showcase${suffix}Title` as keyof typeof m] as string,
      description: m[`showcase${suffix}Desc` as keyof typeof m] as string,
    };
  });

  return (
    <section id="product" className="scroll-mt-24 py-20 sm:py-24">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading eyebrow={m.navFeatures} title={m.showcaseTitle} description={m.showcaseSubtitle} />

        <div className="mt-14 space-y-16 sm:space-y-24">
          {items.map((item, index) => (
            <div
              key={item.key}
              className={cn(
                "grid items-center gap-8 lg:grid-cols-2 lg:gap-16",
                index % 2 === 1 && "lg:[&>*:first-child]:order-2",
              )}
            >
              <Reveal>
                <div className="relative">
                  <div
                    aria-hidden
                    className={cn(
                      "pointer-events-none absolute -inset-5 rounded-[2.6rem] blur-2xl",
                      index % 2 === 0
                        ? "bg-[radial-gradient(circle_at_30%_20%,rgba(22,169,126,0.22),transparent_65%)]"
                        : "bg-[radial-gradient(circle_at_70%_30%,rgba(242,182,75,0.18),transparent_65%)]",
                    )}
                  />
                  <Image
                    src={item.image}
                    alt={item.title}
                    width={item.width}
                    height={item.height}
                    unoptimized
                    loading={index === 0 ? "eager" : "lazy"}
                    className="relative h-auto w-full drop-shadow-[0_24px_50px_rgba(8,60,45,0.22)]"
                  />
                </div>
              </Reveal>

              <Reveal delay={0.08}>
                <p className="kpi-value text-xs font-semibold uppercase tracking-[0.2em] text-accent">
                  0{index + 1}
                </p>
                <h3 className="mt-3 text-balance text-2xl font-extrabold tracking-tight text-heading sm:text-3xl">
                  {item.title}
                </h3>
                <p className="mt-3 max-w-lg text-base leading-relaxed text-muted">{item.description}</p>
                <p className="mt-5 inline-flex items-center gap-2 rounded-full border border-line bg-panel px-3 py-1.5 text-xs font-semibold text-muted">
                  <span className="h-1.5 w-1.5 rounded-full bg-accent-strong" aria-hidden />
                  {dict.common.tagline}
                </p>
              </Reveal>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function CtaSection() {
  const { locale, dict } = useI18n();
  const m = dict.marketing;

  return (
    <section className="px-4 pb-20 sm:px-6 lg:px-8">
      <div className="relative mx-auto w-full max-w-7xl overflow-hidden rounded-[2rem] bg-forest px-6 py-14 text-center text-white sm:px-12">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(22,169,126,0.35),transparent_55%),radial-gradient(circle_at_80%_80%,rgba(242,182,75,0.18),transparent_50%)]"
        />
        <div className="relative">
          <h2 className="text-balance text-3xl font-extrabold tracking-tight sm:text-4xl">{m.ctaTitle}</h2>
          <p className="mx-auto mt-3 max-w-lg text-balance text-sm text-jade-100/85 sm:text-base">{m.ctaSubtitle}</p>
          <Link
            href={`/${locale}/signup`}
            className={buttonVariants({ variant: "mango", size: "lg", className: "mt-7" })}
          >
            {m.ctaButton}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </div>
    </section>
  );
}
