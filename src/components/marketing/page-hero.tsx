import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Reveal } from "@/components/motion/reveal";

export function PageHero({
  eyebrow,
  title,
  accent,
  subtitle,
  primaryHref,
  primaryLabel,
  secondaryHref,
  secondaryLabel,
}: {
  eyebrow: string;
  title: string;
  accent?: string;
  subtitle: string;
  primaryHref: string;
  primaryLabel: string;
  secondaryHref?: string;
  secondaryLabel?: string;
}) {
  return (
    <section className="relative overflow-hidden border-b border-line">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 grid-lines opacity-50 [mask-image:radial-gradient(ellipse_70%_70%_at_30%_0%,black,transparent)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-20 -top-24 h-[26rem] w-[26rem] rounded-full bg-[radial-gradient(circle_at_center,rgba(22,169,126,0.16),transparent_65%)] blur-2xl"
      />
      <div className="relative mx-auto w-full max-w-6xl px-4 pb-14 pt-12 sm:px-6 lg:px-8 lg:pb-16 lg:pt-16">
        <Reveal>
          <p className="inline-flex items-center gap-2 rounded-full border border-accent-line bg-panel/80 px-3 py-1.5 text-xs font-semibold text-accent shadow-sm">
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            {eyebrow}
          </p>
          <h1 className="mt-5 max-w-3xl text-balance text-[2.1rem] font-extrabold leading-[1.08] tracking-tight text-heading sm:text-5xl">
            {title}
            {accent ? (
              <>
                {" "}
                <span className="text-accent-strong">{accent}</span>
              </>
            ) : null}
          </h1>
          <p className="mt-5 max-w-2xl text-balance text-[1.02rem] leading-relaxed text-muted sm:text-lg">
            {subtitle}
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link href={primaryHref} className={buttonVariants({ size: "lg" })}>
              {primaryLabel}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            {secondaryHref && secondaryLabel ? (
              <Link href={secondaryHref} className={buttonVariants({ variant: "secondary", size: "lg" })}>
                {secondaryLabel}
              </Link>
            ) : null}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
