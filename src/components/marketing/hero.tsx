"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { ArrowRight, CheckCircle2, MessageCircle, Sparkles, TrendingUp } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { useI18n } from "@/components/layout/i18n-provider";

const SPARKLINE = "M2 62 C 18 58, 28 46, 44 48 S 66 56, 82 42 S 104 22, 124 26 S 150 30, 168 14";

export function Hero() {
  const { locale, dict } = useI18n();
  const m = dict.marketing;

  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 grid-lines opacity-70 [mask-image:radial-gradient(ellipse_75%_60%_at_50%_0%,black,transparent)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 -top-40 h-[36rem] w-[36rem] rounded-full bg-[radial-gradient(circle_at_center,rgba(22,169,126,0.22),transparent_65%)] blur-2xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-32 top-40 h-[26rem] w-[26rem] rounded-full bg-[radial-gradient(circle_at_center,rgba(242,182,75,0.18),transparent_65%)] blur-2xl"
      />

      <div className="relative mx-auto grid w-full max-w-7xl items-center gap-14 px-4 pb-16 pt-14 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:gap-10 lg:px-8 lg:pb-24 lg:pt-20">
        <div className="animate-rise">
          <p className="inline-flex items-center gap-2 rounded-full border border-jade-200 bg-white/80 px-3 py-1.5 text-xs font-semibold text-jade-700 shadow-sm">
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            {m.heroEyebrow}
          </p>

          <h1 className="mt-6 text-balance text-[2.55rem] font-extrabold leading-[1.04] tracking-tight text-forest sm:text-6xl">
            {m.heroTitle}{" "}
            <span className="relative inline-block text-jade-600">
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
            <a href={`#channels`} className={buttonVariants({ variant: "secondary", size: "lg" })}>
              {m.heroCtaSecondary}
            </a>
          </div>

          <p className="mt-5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium text-muted">
            <CheckCircle2 className="h-3.5 w-3.5 text-jade-600" aria-hidden />
            {m.heroNote}
          </p>
        </div>

        <div className="relative mx-auto w-full max-w-[30rem] lg:max-w-none">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="relative rounded-[1.75rem] border border-line bg-white p-5 shadow-[0_30px_80px_-40px_rgba(8,60,45,0.45)] sm:p-6"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-forest text-xs font-bold text-white">
                  NF
                </span>
                <div>
                  <p className="text-sm font-bold text-forest">Nkeng Fresh Foods</p>
                  <p className="text-xs text-muted">{dict.dashboard.thisMonthLabel} · XAF</p>
                </div>
              </div>
              <span className="rounded-full bg-jade-50 px-2.5 py-1 text-[0.7rem] font-bold text-jade-700">
                {dict.transactions.posted}
              </span>
            </div>

            <div className="mt-6">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted">
                {dict.dashboard.profit}
              </p>
              <div className="mt-1 flex items-end gap-3">
                <p className="kpi-value text-[2rem] font-semibold text-forest">1 284 500</p>
                <span className="mb-1.5 inline-flex items-center gap-1 rounded-full bg-jade-50 px-2 py-0.5 text-xs font-bold text-jade-700">
                  <TrendingUp className="h-3 w-3" aria-hidden /> 12.4%
                </span>
              </div>
              <p className="text-xs text-muted">FCFA</p>
            </div>

            <svg aria-hidden viewBox="0 0 170 76" className="mt-4 h-20 w-full">
              <defs>
                <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop stopColor="#16A97E" stopOpacity="0.28" />
                  <stop offset="1" stopColor="#16A97E" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d={`${SPARKLINE} L168 76 L2 76 Z`} fill="url(#spark-fill)" />
              <path d={SPARKLINE} fill="none" stroke="#0B7A5A" strokeWidth="2.4" strokeLinecap="round" />
              <circle cx="168" cy="14" r="3.5" fill="#0B7A5A" />
            </svg>

            <div className="mt-2 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-sand p-3">
                <p className="text-[0.7rem] font-semibold uppercase tracking-[0.08em] text-muted">
                  {dict.dashboard.income}
                </p>
                <p className="kpi-value mt-1 text-base font-semibold text-forest">2 140 000</p>
              </div>
              <div className="rounded-xl bg-sand p-3">
                <p className="text-[0.7rem] font-semibold uppercase tracking-[0.08em] text-muted">
                  {dict.dashboard.expenses}
                </p>
                <p className="kpi-value mt-1 text-base font-semibold text-forest">855 500</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="absolute -bottom-10 -left-4 w-52 rounded-2xl bg-forest p-4 text-white shadow-[0_24px_60px_-24px_rgba(8,60,45,0.7)] sm:-left-8"
          >
            <div className="flex items-center justify-between text-[0.6rem] font-bold uppercase tracking-[0.16em] text-jade-200">
              <span>USSD</span>
              <span className="text-mango-400">*384*12#</span>
            </div>
            <p className="mt-3 font-mono text-[0.7rem] leading-relaxed text-jade-50/90">
              1. Record sale
              <br />
              2. Record expense
              <br />
              3. Check balance
            </p>
            <p className="mt-2 text-[0.65rem] text-jade-200/70">Reply 1</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="absolute -right-3 top-24 w-44 rounded-2xl border border-line bg-white p-3 shadow-lg sm:-right-6"
          >
            <p className="flex items-center gap-1.5 text-[0.65rem] font-bold text-jade-700">
              <MessageCircle className="h-3 w-3" aria-hidden /> WhatsApp
            </p>
            <p className="mt-1.5 rounded-lg rounded-tl-sm bg-jade-50 px-2.5 py-2 text-[0.7rem] leading-snug text-forest">
              I sell 4 bags rice 25,000 cash
            </p>
            <p className="mt-1.5 flex items-center gap-1 text-[0.65rem] font-semibold text-jade-600">
              <CheckCircle2 className="h-3 w-3" aria-hidden /> {dict.transactions.createSuccess}
            </p>
          </motion.div>
        </div>
      </div>

      <div className="relative border-y border-line bg-white/60">
        <div className="mx-auto grid w-full max-w-7xl grid-cols-1 divide-y divide-line px-4 sm:grid-cols-3 sm:divide-x sm:divide-y-0 sm:px-6 lg:px-8">
          {[
            { value: m.stat1Value, label: m.stat1Label },
            { value: m.stat2Value, label: m.stat2Label },
            { value: m.stat3Value, label: m.stat3Label },
          ].map((stat) => (
            <div key={stat.label} className="flex items-baseline gap-3 px-2 py-5 sm:justify-center sm:px-6">
              <p className="kpi-value text-2xl font-semibold text-forest">{stat.value}</p>
              <p className="text-sm text-muted">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
