import Link from "next/link";
import { ArrowRight, CheckCircle2, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import type { Dictionary } from "@/lib/i18n/dictionaries/en";

export function GettingStarted({
  locale,
  dict,
}: {
  locale: string;
  dict: Dictionary;
}) {
  const steps = [
    { title: dict.onboarding.welcomeStep1, body: dict.onboarding.welcomeStep1Body, href: `/${locale}/transactions/new?kind=income` },
    { title: dict.onboarding.welcomeStep2, body: dict.onboarding.welcomeStep2Body, href: `/${locale}/contacts` },
    { title: dict.onboarding.welcomeStep3, body: dict.onboarding.welcomeStep3Body, href: `/${locale}/team` },
    { title: dict.onboarding.welcomeStep4, body: dict.onboarding.welcomeStep4Body, href: `/${locale}/assistant` },
  ];

  return (
    <Card className="overflow-hidden border-accent-strong/20 bg-[linear-gradient(135deg,var(--color-jade-50),var(--color-panel)_60%)] p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-strong text-white">
          <Sparkles className="h-5 w-5" aria-hidden />
        </span>
        <div>
          <h2 className="text-lg font-extrabold tracking-tight text-heading">{dict.onboarding.welcomeTitle}</h2>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted">{dict.onboarding.welcomeSubtitle}</p>
        </div>
      </div>

      <ol className="mt-5 grid gap-3 sm:grid-cols-2">
        {steps.map((step) => (
          <li key={step.title}>
            <Link
              href={step.href}
              className="group flex h-full items-start gap-3 rounded-xl border border-line bg-panel/80 p-3.5 transition hover:border-accent-strong/40 hover:bg-panel"
            >
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent-strong" aria-hidden />
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-heading">{step.title}</span>
                <span className="mt-0.5 block text-xs leading-relaxed text-muted">{step.body}</span>
              </span>
              <ArrowRight className="ml-auto mt-0.5 h-3.5 w-3.5 shrink-0 text-muted transition group-hover:translate-x-0.5 group-hover:text-accent-strong" aria-hidden />
            </Link>
          </li>
        ))}
      </ol>

      <Link
        href={`/${locale}/dashboard`}
        className={buttonVariants({ variant: "ghost", size: "sm", className: "mt-4 gap-1.5 text-accent-strong" })}
      >
        {dict.onboarding.welcomeDismiss}
        <ArrowRight className="h-3.5 w-3.5" aria-hidden />
      </Link>
    </Card>
  );
}
