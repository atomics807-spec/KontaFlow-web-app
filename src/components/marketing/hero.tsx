"use client";

import { AdaptiveImage } from "@/components/pwa/adaptive-image";
import Link from "next/link";
import { motion } from "motion/react";
import { ArrowRight, CheckCircle2, Sparkles } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { useI18n } from "@/components/layout/i18n-provider";

export function Hero() {
  const { locale, dict } = useI18n();
  const m = dict.marketing;

  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 grid-lines opacity-60 [mask-image:radial-gradient(ellipse_75%_60%_at_50%_0%,black,transparent)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 -top-40 h-[36rem] w-[36rem] rounded-full bg-[radial-gradient(circle_at_center,rgba(22,169,126,0.2),transparent_65%)] blur-2xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-32 top-40 h-[26rem] w-[26rem] rounded-full bg-[radial-gradient(circle_at_center,rgba(242,182,75,0.16),transparent_65%)] blur-2xl"
      />

      <div className="relative mx-auto grid w-full max-w-7xl items-center gap-14 px-4 pb-20 pt-14 sm:px-6 lg:grid-cols-[1.02fr_1fr] lg:gap-8 lg:px-8 lg:pb-24 lg:pt-20">
        <div className="animate-rise">
          <p className="inline-flex items-center gap-2 rounded-full border border-accent-line bg-panel/80 px-3 py-1.5 text-xs font-semibold text-accent shadow-sm">
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            {m.heroEyebrow}
          </p>

          <h1 className="mt-6 text-balance text-[2.55rem] font-extrabold leading-[1.04] tracking-tight text-heading sm:text-6xl">
            {m.heroTitle}{" "}
            <span className="relative inline-block text-accent-strong">
              {m.heroTitleAccent}
              <svg
                aria-hidden
                viewBox="0 0 240 14"
                preserveAspectRatio="none"
                className="absolute -bottom-1 left-0 h-2.5 w-full text-mango-500"
              >
                <path d="M2 9C48 3 112 2 238 6" stroke="currentColor" strokeWidth="4" fill="none" strokeLinecap="round" />
              </svg>
            </span>
          </h1>

          <p className="mt-6 max-w-xl text-balance text-[1.05rem] leading-relaxed text-muted sm:text-lg">
            {m.heroSubtitle}
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link href={`/${locale}/signup`} className={buttonVariants({ size: "lg" })}>
              {m.heroCtaPrimary}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            <a href="#product" className={buttonVariants({ variant: "secondary", size: "lg" })}>
              {m.heroCtaSecondary}
            </a>
          </div>

          <p className="mt-5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium text-muted">
            <CheckCircle2 className="h-3.5 w-3.5 text-accent-strong" aria-hidden />
            {m.heroNote}
          </p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="relative mx-auto w-full max-w-[34rem] lg:max-w-none"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute -inset-6 rounded-[3rem] bg-[radial-gradient(circle_at_70%_20%,rgba(22,169,126,0.22),transparent_65%)] blur-2xl"
          />
          <div className="relative overflow-hidden rounded-[1.9rem] border border-line/80 bg-panel/70 p-2 shadow-pop backdrop-blur">
            <AdaptiveImage
              src="/illustrations/hero-app.svg"
              alt={m.heroImageAlt}
              width={1200}
              height={820}
              priority
              unoptimized
              className="h-auto w-full"
            />
          </div>

          <div className="absolute -bottom-5 left-2 rounded-2xl bg-forest px-4 py-3 text-white shadow-lift sm:-left-6">
            <p className="text-[0.55rem] font-bold uppercase tracking-[0.16em] text-jade-200">USSD</p>
            <p className="mt-1 font-mono text-xs font-semibold text-mango-400">*384*12#</p>
          </div>

          <div className="absolute -right-2 top-8 flex items-center gap-2 rounded-full border border-line bg-panel px-3 py-2 shadow-lift sm:-right-5">
            <span className="h-2 w-2 rounded-full bg-jade-500" aria-hidden />
            <span className="text-[0.65rem] font-bold text-heading">WhatsApp · AI · API</span>
          </div>
        </motion.div>
      </div>

      <div className="relative border-y border-line bg-panel/60">
        <div className="mx-auto grid w-full max-w-7xl grid-cols-1 divide-y divide-line px-4 sm:grid-cols-3 sm:divide-x sm:divide-y-0 sm:px-6 lg:px-8">
          {[
            { value: m.stat1Value, label: m.stat1Label },
            { value: m.stat2Value, label: m.stat2Label },
            { value: m.stat3Value, label: m.stat3Label },
          ].map((stat) => (
            <div key={stat.label} className="flex items-baseline gap-3 px-2 py-5 sm:justify-center sm:px-6">
              <p className="kpi-value text-2xl font-semibold text-heading">{stat.value}</p>
              <p className="text-sm text-muted">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
