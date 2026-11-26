import { AdaptiveImage } from "@/components/pwa/adaptive-image";
import Link from "next/link";
import { ArrowRight, Check, ChevronDown, Sparkles } from "lucide-react";
import type { FaqItem, PageSection, SimplePageCopy, SiteContent } from "@/lib/content/types";

type HeroCopy = Pick<
  SimplePageCopy,
  "eyebrow" | "title" | "accent" | "subtitle" | "image" | "imageAlt" | "imageCaption"
>;
import type { Locale } from "@/lib/i18n/config";
import { buttonVariants } from "@/components/ui/button";
import { Reveal } from "@/components/motion/reveal";
import { cn } from "@/lib/utils";

export function Eyebrow({ children, dark = false }: { children: React.ReactNode; dark?: boolean }) {
  return (
    <p
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[0.7rem] font-bold uppercase tracking-[0.14em]",
        dark
          ? "border-white/15 bg-white/10 text-jade-200"
          : "border-accent-line bg-panel/80 text-accent",
      )}
    >
      <Sparkles className="h-3.5 w-3.5" aria-hidden />
      {children}
    </p>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  subtitle,
  align = "center",
  dark = false,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  align?: "left" | "center";
  dark?: boolean;
}) {
  return (
    <Reveal>
      <div className={cn("max-w-3xl", align === "center" && "mx-auto text-center")}>
        <p
          className={cn(
            "text-[0.7rem] font-bold uppercase tracking-[0.16em]",
            dark ? "text-jade-300" : "text-accent",
          )}
        >
          {eyebrow}
        </p>
        <h2
          className={cn(
            "mt-3 text-balance text-3xl font-extrabold tracking-tight sm:text-4xl",
            dark ? "text-white" : "text-heading",
          )}
        >
          {title}
        </h2>
        {subtitle ? (
          <p
            className={cn(
              "mt-4 text-balance text-base leading-relaxed",
              dark ? "text-jade-100/80" : "text-muted",
            )}
          >
            {subtitle}
          </p>
        ) : null}
      </div>
    </Reveal>
  );
}

export function PageHero({
  page,
  primaryHref,
  primaryLabel,
  secondaryHref,
  secondaryLabel,
}: {
  page: HeroCopy;
  locale: Locale;
  primaryHref: string;
  primaryLabel: string;
  secondaryHref?: string;
  secondaryLabel?: string;
}) {
  return (
    <section className="relative overflow-hidden border-b border-white/10 bg-forest text-white">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 grid-lines opacity-[0.07]"
      />
      <div className="relative mx-auto grid w-full max-w-7xl items-stretch lg:grid-cols-[1.04fr_0.96fr]">
        <div className="px-4 pb-12 pt-12 sm:px-6 lg:px-8 lg:pb-16 lg:pt-16">
          <Reveal>
            <Eyebrow dark>{page.eyebrow}</Eyebrow>
            <h1 className="mt-6 max-w-2xl text-balance text-[2.35rem] font-extrabold leading-[1.06] tracking-tight sm:text-5xl">
              {page.title}{" "}
              {page.accent ? <span className="text-jade-300">{page.accent}</span> : null}
            </h1>
            <p className="mt-5 max-w-xl text-balance text-base leading-relaxed text-jade-50/80 sm:text-lg">
              {page.subtitle}
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link href={primaryHref} className={buttonVariants({ variant: "mango", size: "lg" })}>
                {primaryLabel}
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              {secondaryHref && secondaryLabel ? (
                <Link
                  href={secondaryHref}
                  className={buttonVariants({
                    variant: "secondary",
                    size: "lg",
                    className: "border-white/20 bg-white/10 text-white hover:border-white/35 hover:bg-white/15",
                  })}
                >
                  {secondaryLabel}
                </Link>
              ) : null}
            </div>
          </Reveal>
        </div>

        <div className="relative min-h-[18rem] lg:min-h-[31rem]">
          <AdaptiveImage
            src={page.image}
            alt={page.imageAlt}
            fill
            priority
            sizes="(max-width: 1024px) 100vw, 48vw"
            className="object-cover"
          />
          <div
            aria-hidden
            className="absolute inset-0 bg-[linear-gradient(180deg,rgba(10,51,39,0.02)_0%,rgba(10,51,39,0.04)_55%,rgba(10,51,39,0.72)_100%)] lg:bg-[linear-gradient(90deg,rgba(10,51,39,0.95)_0%,rgba(10,51,39,0.2)_35%,rgba(10,51,39,0)_70%)]"
          />
          <div
            aria-hidden
            className="absolute inset-x-0 bottom-0 h-32 bg-[linear-gradient(0deg,rgba(10,51,39,0.92),transparent)]"
          />
          <p className="absolute bottom-4 right-4 max-w-[15rem] text-right text-[0.62rem] leading-snug text-white/65">
            {page.imageCaption}
          </p>
        </div>
      </div>
    </section>
  );
}

export function CtaBand({
  title,
  body,
  primary,
  secondary,
  locale,
  href = "signup",
  secondaryHref = "contact",
}: {
  title: string;
  body: string;
  primary: string;
  secondary?: string;
  locale: Locale;
  href?: string;
  secondaryHref?: string;
}) {
  return (
    <section className="px-4 py-16 sm:px-6 lg:px-8">
      <div className="relative mx-auto w-full max-w-7xl overflow-hidden rounded-[2rem] bg-forest px-6 py-14 text-center text-white sm:px-12">
        <div aria-hidden className="pointer-events-none absolute inset-0 grid-lines opacity-[0.08]" />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-28 h-80 w-80 rounded-full bg-[radial-gradient(circle,rgba(22,169,126,0.28),transparent_68%)] blur-2xl"
        />
        <div className="relative mx-auto max-w-2xl">
          <h2 className="text-balance text-3xl font-extrabold tracking-tight sm:text-4xl">{title}</h2>
          <p className="mt-4 text-pretty text-base leading-relaxed text-jade-50/80">{body}</p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href={`/${locale}/${href}`} className={buttonVariants({ variant: "mango", size: "lg" })}>
              {primary}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            {secondary ? (
              <Link
                href={`/${locale}/${secondaryHref}`}
                className={buttonVariants({
                  variant: "secondary",
                  size: "lg",
                  className: "border-white/20 bg-white/10 text-white hover:border-white/35 hover:bg-white/15",
                })}
              >
                {secondary}
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

export function FeatureGrid({
  cards,
  columns = 3,
}: {
  cards: { title: string; body: string }[];
  columns?: 2 | 3 | 4;
}) {
  return (
    <div
      className={cn(
        "grid gap-4",
        columns === 2 && "sm:grid-cols-2",
        columns === 3 && "sm:grid-cols-2 lg:grid-cols-3",
        columns === 4 && "sm:grid-cols-2 lg:grid-cols-4",
      )}
    >
      {cards.map((card, index) => (
        <Reveal key={card.title} delay={(index % 4) * 0.04}>
          <article className="h-full rounded-2xl border border-line bg-panel p-5 transition hover:-translate-y-0.5 hover:border-accent-line hover:shadow-[0_20px_50px_-34px_rgba(8,60,45,0.5)] sm:p-6">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-accent-soft text-xs font-extrabold text-accent-strong">
              {String(index + 1).padStart(2, "0")}
            </span>
            <h3 className="mt-4 text-base font-bold text-heading">{card.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">{card.body}</p>
          </article>
        </Reveal>
      ))}
    </div>
  );
}

export function ProseSections({ sections }: { sections: PageSection[] }) {
  return (
    <div className="space-y-14">
      {sections.map((section) => (
        <Reveal key={section.title}>
          <section className="grid gap-6 lg:grid-cols-[0.78fr_1.22fr] lg:gap-12">
            <h2 className="text-balance text-2xl font-extrabold tracking-tight text-heading sm:text-3xl">
              {section.title}
            </h2>
            <div>
              {section.body ? (
                <p className="max-w-2xl text-base leading-relaxed text-muted">{section.body}</p>
              ) : null}
              {section.cards ? (
                <div className={cn("mt-6", section.body && "mt-8")}>
                  <FeatureGrid cards={section.cards} columns={2} />
                </div>
              ) : null}
            </div>
          </section>
        </Reveal>
      ))}
    </div>
  );
}

export function PricingTiers({
  tiers,
  locale,
  footnote,
  headingLevel = 3,
}: {
  tiers: SiteContent["home"]["subscription"]["tiers"];
  locale: Locale;
  footnote: string;
  headingLevel?: 2 | 3;
}) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  return (
    <>
      <div className="mt-12 grid gap-5 lg:grid-cols-3">
        {tiers.map((tier) => (
          <div
            key={tier.name}
            className={cn(
              "relative flex flex-col rounded-2xl border bg-panel p-6",
              tier.featured
                ? "border-2 border-jade-600 shadow-[0_30px_70px_-40px_rgba(8,60,45,0.55)]"
                : "border-line",
            )}
          >
            {tier.featured ? (
              <span className="absolute -top-3 left-6 rounded-full bg-jade-600 px-3 py-1 text-[0.62rem] font-bold uppercase tracking-wider text-white">
                {tier.name}
              </span>
            ) : null}
            <Heading className="text-lg font-extrabold text-heading">{tier.name}</Heading>
            <p className="mt-1 min-h-[2.5rem] text-sm text-muted">{tier.description}</p>
            <p className="mt-5 flex flex-wrap items-baseline gap-1.5">
              <span className="kpi-value text-3xl font-semibold text-heading">{tier.price}</span>
              <span className="text-xs font-medium text-muted">{tier.period}</span>
            </p>
            <Link
              href={`/${locale}/${tier.price === "0" ? "signup" : "contact"}`}
              className={buttonVariants({
                variant: tier.featured ? "primary" : "secondary",
                className: "mt-5 w-full",
              })}
            >
              {tier.cta}
            </Link>
            <ul className="mt-6 space-y-3">
              {tier.features.map((feature) => (
                <li key={feature} className="flex items-start gap-2 text-sm text-muted">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent-strong" aria-hidden />
                  {feature}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <p className="mx-auto mt-6 max-w-2xl text-center text-xs leading-relaxed text-muted">{footnote}</p>
    </>
  );
}

export function FaqList({ items, className }: { items: FaqItem[]; className?: string }) {
  return (
    <div className={cn("divide-y divide-line rounded-2xl border border-line bg-panel", className)}>
      {items.map((item) => (
        <details key={item.question} className="group px-4 py-4 sm:px-6">
          <summary className="flex cursor-pointer list-none items-start justify-between gap-4 text-left text-sm font-bold text-heading [&::-webkit-details-marker]:hidden">
            {item.question}
            <ChevronDown
              className="mt-0.5 h-4 w-4 shrink-0 text-muted transition group-open:rotate-180"
              aria-hidden
            />
          </summary>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">{item.answer}</p>
        </details>
      ))}
    </div>
  );
}

