import type { Metadata } from "next";
import { AdaptiveImage } from "@/components/pwa/adaptive-image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, CalendarDays, Clock } from "lucide-react";
import { CtaBand } from "@/components/marketing/site";
import { articleCanonicalPath, findPublishedArticle, getSiteContent, listPublishedArticles } from "@/lib/content";
import { intlLocale, resolveLocale } from "@/lib/i18n/config";
import { marketingMetadata } from "@/lib/seo";
import { JsonLd } from "@/components/seo/json-ld";
import { Breadcrumbs } from "@/components/marketing/breadcrumbs";
import { articleSchema } from "@/lib/structured-data";

function formatDate(value: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric" }).format(
    new Date(`${value}T12:00:00Z`),
  );
}

export async function generateStaticParams() {
  const content = await getSiteContent("en");
  return listPublishedArticles(content).map((article) => ({ slug: article.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale: rawLocale, slug } = await params;
  const locale = resolveLocale(rawLocale);
  const content = await getSiteContent(locale);
  const article = findPublishedArticle(content, slug);
  if (!article) return {};
  return marketingMetadata({
    locale,
    path: articleCanonicalPath(article),
    title: `${article.title} — KontaFlow`,
    description: article.description,
    image: article.image,
    type: "article",
    author: article.author,
    publishedTime: article.publishedAt,
    modifiedTime: article.updatedAt,
    category: article.category,
  });
}

export default async function ArticlePage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale: rawLocale, slug } = await params;
  const locale = resolveLocale(rawLocale);
  const content = await getSiteContent(locale);
  const article = findPublishedArticle(content, slug);
  if (!article) notFound();

  const related = listPublishedArticles(content)
    .filter((item) => item.slug !== article.slug)
    .slice(0, 2);

  return (
    <>
      <JsonLd
        data={articleSchema({
          locale,
          path: articleCanonicalPath(article),
          title: article.title,
          description: article.description,
          image: article.image,
          author: article.author,
          publishedAt: article.publishedAt,
          updatedAt: article.updatedAt,
          category: article.category,
          tags: article.tags,
        })}
      />
      <article>
        <header className="relative overflow-hidden bg-forest pb-12 pt-10 text-white sm:pb-16 sm:pt-14">
          <div aria-hidden className="pointer-events-none absolute inset-0 grid-lines opacity-[0.06]" />
          <div className="relative mx-auto w-full max-w-4xl px-4 sm:px-6 lg:px-8">
            <Breadcrumbs
              locale={locale}
              label={content.common.breadcrumb}
              homeLabel={content.common.home}
              tone="dark"
              items={[
                { label: content.common.resources, href: `/${locale}/resources` },
                { label: article.category },
                { label: article.title },
              ]}
            />
            <p className="mt-10 text-[0.68rem] font-bold uppercase tracking-[0.16em] text-mango-400">{article.category}</p>
            <h1 className="mt-4 text-balance text-[2.2rem] font-extrabold leading-[1.08] tracking-tight sm:text-5xl">
              {article.title}
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-jade-50/75 sm:text-lg">{article.description}</p>
            <div className="mt-6 flex flex-wrap items-center gap-4 text-xs text-jade-100/65">
              <span>{article.author}</span>
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5" aria-hidden />
                {formatDate(article.publishedAt, intlLocale(locale))}
              </span>
              {article.updatedAt !== article.publishedAt ? (
                <span>
                  {content.common.updated}: {formatDate(article.updatedAt, intlLocale(locale))}
                </span>
              ) : null}
              <span className="inline-flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" aria-hidden />
                {article.readingMinutes} {content.blog.minRead}
              </span>
            </div>
          </div>
        </header>

        <div className="mx-auto w-full max-w-4xl px-4 pt-8 sm:px-6 sm:pt-10 lg:px-8">
          <div className="relative aspect-[16/9] overflow-hidden rounded-[1.6rem] border border-line shadow-pop">
            <AdaptiveImage
              src={article.image}
              alt={article.imageAlt}
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 56rem"
              className="object-cover"
            />
          </div>
        </div>

        <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
          <p className="border-l-2 border-mango-500 pl-5 text-lg font-medium leading-relaxed text-heading">
            {article.intro}
          </p>
          <div className="mt-10 space-y-10">
            {article.sections.map((section) => (
              <section key={section.heading}>
                <h2 className="text-xl font-extrabold tracking-tight text-heading sm:text-2xl">{section.heading}</h2>
                <div className="mt-3 space-y-4">
                  {section.paragraphs.map((paragraph) => (
                    <p key={paragraph} className="text-[0.98rem] leading-relaxed text-muted">
                      {paragraph}
                    </p>
                  ))}
                </div>
                {section.bullets ? (
                  <ul className="mt-5 space-y-2 rounded-2xl border border-line bg-panel p-5">
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

          <aside className="mt-10 rounded-2xl border border-jade-200 bg-accent-soft p-6">
            <p className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-accent">{content.common.takeaway}</p>
            <p className="mt-2 text-base font-semibold leading-relaxed text-heading">{article.takeaway}</p>
          </aside>

          {article.tags.length ? (
            <ul className="mt-6 flex flex-wrap gap-2" aria-label={article.category}>
              {article.tags.map((tag) => (
                <li key={tag} className="rounded-full border border-line bg-panel px-3 py-1 text-xs font-semibold text-muted">
                  {tag}
                </li>
              ))}
            </ul>
          ) : null}

          <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-6">
            <Link href={`/${locale}/resources`} className="inline-flex items-center gap-2 text-sm font-bold text-accent-strong hover:underline">
              <ArrowLeft className="h-4 w-4" aria-hidden />
              {content.common.backToResources}
            </Link>
            <Link href={`/${locale}/signup`} className="inline-flex items-center gap-2 text-sm font-bold text-heading hover:underline">
              {content.common.startTrial}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        </div>
      </article>

      {related.length ? (
        <section className="border-t border-line bg-panel py-16">
          <div className="mx-auto w-full max-w-5xl px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-extrabold tracking-tight text-heading">{content.common.related}</h2>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {related.map((item) => (
                <Link
                  key={item.slug}
                  href={`/${locale}/resources/${item.slug}`}
                  className="rounded-2xl border border-line bg-page p-5 transition hover:border-accent-line hover:shadow-soft"
                >
                  <p className="text-[0.62rem] font-bold uppercase tracking-[0.1em] text-accent">{item.category}</p>
                  <h3 className="mt-2 text-base font-bold text-heading">{item.title}</h3>
                  <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted">{item.description}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <CtaBand
        title={content.home.finalCta.title}
        body={content.home.finalCta.subtitle}
        primary={content.home.finalCta.primary}
        secondary={content.home.finalCta.secondary}
        locale={locale}
      />
    </>
  );
}
