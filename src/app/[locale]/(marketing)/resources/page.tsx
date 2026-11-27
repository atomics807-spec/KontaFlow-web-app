import type { Metadata } from "next";
import { AdaptiveImage } from "@/components/pwa/adaptive-image";
import Link from "next/link";
import { ArrowRight, CalendarDays, Clock } from "lucide-react";
import { CtaBand, PageHero, SectionHeading } from "@/components/marketing/site";
import { Reveal } from "@/components/motion/reveal";
import { getSiteContent, listPublishedArticles } from "@/lib/content";
import { getDictionary } from "@/lib/i18n/server";
import { intlLocale, resolveLocale } from "@/lib/i18n/config";
import { marketingMetadata } from "@/lib/seo";

function formatDate(value: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric" }).format(
    new Date(`${value}T12:00:00Z`),
  );
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const locale = resolveLocale((await params).locale);
  const content = await getSiteContent(locale);
  return marketingMetadata({
    locale,
    path: "/resources",
    title: content.blog.metaTitle,
    description: content.blog.metaDescription,
    image: "/images/marketing/business-analysis.webp",
  });
}

export default async function ResourcesPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = resolveLocale((await params).locale);
  const [content, dict] = await Promise.all([getSiteContent(locale), getDictionary(locale)]);
  const blog = content.blog;
  const [featured, ...rest] = listPublishedArticles(content);

  return (
    <>
      <PageHero
        page={{
          eyebrow: blog.eyebrow,
          title: blog.title,
          subtitle: blog.subtitle,
          image: "/images/marketing/business-analysis.webp",
          imageAlt: blog.imageAlt,
          imageCaption: blog.imageCaption,
        }}
        locale={locale}
        primaryHref={`/${locale}/signup`}
        primaryLabel={content.common.startTrial}
        secondaryHref={`/${locale}/faq`}
        secondaryLabel={dict.marketing.navFaq}
        breadcrumbs={[{ label: content.common.resources }]}
        breadcrumbLabel={content.common.breadcrumb}
        homeLabel={content.common.home}
      />

      {featured ? (
        <section className="py-16 sm:py-20">
          <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
            <Reveal>
              <article className="grid overflow-hidden rounded-[1.8rem] border border-line bg-panel lg:grid-cols-[1.05fr_0.95fr]">
                <div className="relative min-h-[18rem] lg:min-h-[26rem]">
                  <AdaptiveImage
                    src={blog.featuredImage}
                    alt={blog.featuredImageAlt}
                    fill
                    priority
                    sizes="(max-width: 1024px) 100vw, 52vw"
                    className="object-cover"
                  />
                  <span className="absolute left-4 top-4 rounded-full bg-mango-500 px-3 py-1 text-[0.6rem] font-bold uppercase tracking-wider text-heading">
                    {blog.featuredLabel}
                  </span>
                </div>
                <div className="flex flex-col justify-center p-6 sm:p-10">
                  <p className="text-[0.65rem] font-bold uppercase tracking-[0.12em] text-accent">{featured.category}</p>
                  <h2 className="mt-3 text-balance text-2xl font-extrabold tracking-tight text-heading sm:text-3xl">
                    {featured.title}
                  </h2>
                  <p className="mt-3 text-sm leading-relaxed text-muted">{featured.description}</p>
                  <div className="mt-5 flex flex-wrap items-center gap-4 text-xs text-muted">
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarDays className="h-3.5 w-3.5" aria-hidden />
                      {formatDate(featured.publishedAt, intlLocale(locale))}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" aria-hidden />
                      {featured.readingMinutes} {blog.minRead}
                    </span>
                  </div>
                  <Link
                    href={`/${locale}/resources/${featured.slug}`}
                    className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-accent-strong hover:underline"
                  >
                    {blog.readArticle}
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  </Link>
                </div>
              </article>
            </Reveal>
          </div>
        </section>
      ) : null}

      <section className="border-t border-line bg-panel py-16 sm:py-20">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeading eyebrow={blog.eyebrow} title={blog.allArticles} />
          <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {rest.map((article, index) => (
              <Reveal key={article.slug} delay={index * 0.05}>
                <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-page">
                  <Link href={`/${locale}/resources/${article.slug}`} className="relative block aspect-[16/10] overflow-hidden">
                    <AdaptiveImage
                      src={article.image}
                      alt={article.imageAlt}
                      fill
                      sizes="(max-width: 768px) 100vw, 33vw"
                      className="object-cover transition duration-500 group-hover:scale-[1.03]"
                    />
                  </Link>
                  <div className="flex flex-1 flex-col p-5">
                    <p className="text-[0.62rem] font-bold uppercase tracking-[0.1em] text-accent">{article.category}</p>
                    <h3 className="mt-2 text-base font-bold leading-snug text-heading">
                      <Link href={`/${locale}/resources/${article.slug}`} className="hover:underline">
                        {article.title}
                      </Link>
                    </h3>
                    <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted">{article.description}</p>
                    <div className="mt-auto flex items-center justify-between pt-5 text-xs text-muted">
                      <span>{formatDate(article.publishedAt, intlLocale(locale))}</span>
                      <span>
                        {article.readingMinutes} {blog.minRead}
                      </span>
                    </div>
                  </div>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <CtaBand
        title={content.home.finalCta.title}
        body={content.home.finalCta.subtitle}
        primary={content.common.startTrial}
        secondary={content.common.talkToUs}
        locale={locale}
      />
    </>
  );
}
