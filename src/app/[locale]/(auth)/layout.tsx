import Link from "next/link";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { LogoMark } from "@/components/layout/logo";
import { resolveLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/server";

export default async function AuthLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const locale = resolveLocale((await params).locale);
  const dict = await getDictionary(locale);

  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <aside className="relative hidden overflow-hidden bg-forest p-10 text-white lg:flex lg:flex-col lg:justify-between">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_10%,rgba(22,169,126,0.35),transparent_55%),radial-gradient(circle_at_85%_90%,rgba(242,182,75,0.16),transparent_50%)]"
        />
        <div className="relative">
          <Link href={`/${locale}`} className="inline-flex items-center gap-2.5">
            <LogoMark className="h-10 w-10" />
            <span className="text-lg font-extrabold tracking-tight">
              Konta<span className="text-jade-300">Flow</span>
            </span>
          </Link>

          <h1 className="mt-16 max-w-sm text-balance text-[2.1rem] font-extrabold leading-[1.1] tracking-tight">
            {dict.marketing.heroTitle} <span className="text-mango-400">{dict.marketing.heroTitleAccent}</span>
          </h1>
          <p className="mt-5 max-w-sm text-sm leading-relaxed text-jade-100/80">{dict.marketing.heroSubtitle}</p>

          <ul className="mt-8 space-y-3">
            {[dict.marketing.channelUssdDesc, dict.marketing.channelWhatsappDesc, dict.marketing.channelAiDesc].map(
              (line) => (
                <li key={line} className="flex items-start gap-2.5 text-sm text-jade-50/85">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-jade-300" aria-hidden />
                  {line}
                </li>
              ),
            )}
          </ul>
        </div>

        <div className="relative rounded-2xl border border-white/10 bg-white/5 p-5">
          <p className="font-mono text-[0.7rem] uppercase tracking-[0.16em] text-jade-300">{dict.marketing.regionCurrency}</p>
          <p className="mt-2 text-sm leading-relaxed text-jade-50/85">
            <span className="font-bold text-white">{dict.marketing.stat1Value}</span> {dict.marketing.stat1Label}
          </p>
        </div>
      </aside>

      <main id="main" className="flex flex-col bg-page">
        <div className="flex items-center justify-between px-5 pt-6 sm:px-8">
          <Link
            href={`/${locale}`}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted transition hover:text-heading"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            {dict.common.backHome}
          </Link>
          <Link href={`/${locale}`} className="lg:hidden">
            <LogoMark className="h-9 w-9" />
          </Link>
        </div>
        <div className="flex flex-1 items-center justify-center px-5 py-10 sm:px-8">
          <div className="w-full max-w-md">{children}</div>
        </div>
      </main>
    </div>
  );
}
