import type { Metadata } from "next";
import { AdaptiveImage } from "@/components/pwa/adaptive-image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Mail, ShieldCheck } from "lucide-react";
import { findLegalDoc, getSiteContent } from "@/lib/content";
import { resolveLocale } from "@/lib/i18n/config";
import { marketingMetadata } from "@/lib/seo";

export async function generateStaticParams() {
  const content = await getSiteContent("en");
  return content.legal.map((doc) => ({ slug: doc.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale: rawLocale, slug } = await params;
  const locale = resolveLocale(rawLocale);
  const content = await getSiteContent(locale);
  const doc = findLegalDoc(content, slug);
  if (!doc) return {};
  return marketingMetadata({
    locale,
    path: `/legal/${doc.slug}`,
    title: `${doc.title} — KontaFlow`,
    description: doc.description,
    image: "/images/marketing/business-notes.webp",
  });
}

export default async function LegalPage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale: rawLocale, slug } = await params;
  const locale = resolveLocale(rawLocale);
  const content = await getSiteContent(locale);
  const doc = findLegalDoc(content, slug);
  if (!doc) notFound();

  return (
    <>
      <header className="relative overflow-hidden border-b border-white/10 bg-forest text-white">
        <div aria-hidden className="pointer-events-none absolute inset-0 grid-lines opacity-[0.06]" />
        <div className="relative mx-auto grid w-full max-w-7xl lg:grid-cols-[1.2fr_0.8fr]">
          <div className="px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
            <BreadcrumbsLight locale={locale} homeLabel={content.common.home} breadcrumbLabel={content.common.breadcrumb} items={[{ label: content.common.legalNav }, { label: doc.title }]} />
            <p className="mt-8 text-[0.68rem] font-bold uppercase tracking-[0.16em] text-mango-400">
              {content.common.legalNav}
            </p>
            <h1 className="mt-3 text-balance text-[2.2rem] font-extrabold leading-[1.08] tracking-tight sm:text-5xl">
              {doc.title}
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-jade-50/75">{doc.description}</p>
            <p className="mt-5 text-xs font-semibold text-jade-100/60">
              {content.common.legalStatus}: {doc.updated}
            </p>
          </div>
          <div className="relative hidden min-h-[15rem] lg:block">
            <AdaptiveImage
              src="/images/marketing/business-notes.webp"
              alt={content.common.illustrativePhotoAlt}
              fill
              sizes="36vw"
              className="object-cover"
            />
            <div aria-hidden className="absolute inset-0 bg-[linear-gradient(90deg,rgba(10,51,39,0.95),rgba(10,51,39,0.1))]" />
          </div>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[16rem_1fr] lg:px-8 lg:py-16">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <p className="text-[0.65rem] font-bold uppercase tracking-[0.12em] text-muted">{content.common.legalNav}</p>
          <nav aria-label={content.common.legalNav} className="mt-3 flex flex-wrap gap-2 lg:flex-col lg:gap-1">
            {content.legal.map((item) => (
              <Link
                key={item.slug}
                href={`/${locale}/legal/${item.slug}`}
                aria-current={item.slug === doc.slug ? "page" : undefined}
                className={
                  item.slug === doc.slug
                    ? "rounded-lg bg-accent-soft px-3 py-2 text-sm font-bold text-accent-strong"
                    : "rounded-lg px-3 py-2 text-sm text-muted transition hover:bg-panel hover:text-heading"
                }
              >
                {item.title}
              </Link>
            ))}
          </nav>
          <div className="mt-6 hidden rounded-2xl border border-line bg-panel p-4 lg:block">
            <ShieldCheck className="h-5 w-5 text-accent-strong" aria-hidden />
            <p className="mt-2 text-xs leading-relaxed text-muted">privacy@kontaflow.com</p>
            <Link href={`/${locale}/contact`} className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-accent-strong hover:underline">
              {content.common.talkToUs}
              <ArrowRight className="h-3 w-3" aria-hidden />
            </Link>
          </div>
        </aside>

        <article className="max-w-3xl">
          {locale === "pcm" ? (
            <p className="mb-6 rounded-xl border border-warn/30 bg-warn-soft px-4 py-3 text-xs leading-relaxed text-heading">
              Dis Pidgin version na to help understanding. If meaning differ, di English version go govern.
            </p>
          ) : null}
          <p className="text-base font-medium leading-relaxed text-heading">{doc.intro}</p>
          <div className="mt-8 space-y-8">
            {doc.sections.map((section) => (
              <section key={section.heading}>
                <h2 className="text-xl font-extrabold tracking-tight text-heading sm:text-2xl">{section.heading}</h2>
                <div className="mt-3 space-y-3">
                  {section.paragraphs.map((paragraph) => (
                    <p key={paragraph} className="text-sm leading-relaxed text-muted sm:text-[0.95rem]">
                      {paragraph}
                    </p>
                  ))}
                </div>
                {section.bullets ? (
                  <ul className="mt-3 space-y-2">
                    {section.bullets.map((bullet) => (
                      <li key={bullet} className="flex items-start gap-2 text-sm leading-relaxed text-muted">
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent-strong" aria-hidden />
                        {bullet}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </section>
            ))}
          </div>
          <div className="mt-10 rounded-2xl border border-line bg-panel p-5">
            <p className="flex items-center gap-2 text-sm font-bold text-heading">
              <Mail className="h-4 w-4 text-accent-strong" aria-hidden />
              info@kontaflow.com
            </p>
            <p className="mt-2 text-xs leading-relaxed text-muted">privacy@kontaflow.com · security@kontaflow.com</p>
          </div>
          <Link href={`/${locale}/legal/terms`} className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-accent-strong hover:underline">
            <ArrowLeft className="h-4 w-4" aria-hidden />
            {content.common.legalNav}
          </Link>
        </article>
      </div>
    </>
  );
}

function BreadcrumbsLight({
  locale,
  homeLabel,
  breadcrumbLabel,
  items,
}: {
  locale: string;
  homeLabel: string;
  breadcrumbLabel: string;
  items: { label: string; path?: string }[];
}) {
  return (
    <nav aria-label={breadcrumbLabel} className="text-xs text-jade-100/60">
      <ol className="flex flex-wrap items-center gap-2">
        <li>
          <Link href={`/${locale}`} className="hover:text-white">
            {homeLabel}
          </Link>
        </li>
        {items.map((item) => (
          <li key={item.label} className="flex items-center gap-2">
            <span aria-hidden>/</span>
            {item.path ? (
              <Link href={`/${locale}${item.path}`} className="hover:text-white">
                {item.label}
              </Link>
            ) : (
              <span className="text-jade-100/90">{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
