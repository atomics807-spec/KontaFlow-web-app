import type { Metadata } from "next";
import { AdaptiveImage } from "@/components/pwa/adaptive-image";
import { ExternalLink } from "lucide-react";
import { PageHero } from "@/components/marketing/site";
import { getSiteContent } from "@/lib/content";
import { resolveLocale } from "@/lib/i18n/config";
import { marketingMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const locale = resolveLocale((await params).locale);
  const content = await getSiteContent(locale);
  return marketingMetadata({
    locale,
    path: "/photo-credits",
    title: `${content.photoCredits.title} — KontaFlow`,
    description: content.photoCredits.intro,
    image: "/images/marketing/team-meeting.webp",
  });
}

export default async function PhotoCreditsPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = resolveLocale((await params).locale);
  const content = await getSiteContent(locale);
  const credits = content.photoCredits;

  return (
    <>
      <PageHero
        page={{
          eyebrow: content.common.legalNav,
          title: credits.title,
          subtitle: credits.intro,
          image: "/images/marketing/team-meeting.webp",
          imageAlt: content.common.illustrativePhotoAlt,
          imageCaption: content.common.illustrativePhoto,
        }}
        locale={locale}
        primaryHref={`/${locale}/about`}
        primaryLabel={content.about.eyebrow}
        secondaryHref={`/${locale}/contact`}
        secondaryLabel={content.common.talkToUs}
      />
      <section className="py-16 sm:py-20">
        <div className="mx-auto grid w-full max-w-7xl gap-6 px-4 sm:grid-cols-2 sm:px-6 lg:grid-cols-3 lg:px-8">
          {credits.items.map((credit) => (
            <figure key={credit.file} className="overflow-hidden rounded-2xl border border-line bg-panel">
              <div className="relative aspect-[16/10]">
                <AdaptiveImage
                  src={`/images/marketing/${credit.file}`}
                  alt={credit.title}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  className="object-cover"
                />
              </div>
              <figcaption className="p-5">
                <p className="text-sm font-bold text-heading">{credit.title}</p>
                <p className="mt-1 text-xs text-muted">
                  {credit.creator} ·{" "}
                  <a href={credit.licenseUrl} className="font-semibold text-accent-strong hover:underline" rel="license noopener noreferrer" target="_blank">
                    {credit.license}
                  </a>
                </p>
                <p className="mt-2 text-xs text-muted">{credit.note}</p>
                <a
                  href={credit.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-accent-strong hover:underline"
                >
                  {content.common.source}
                  <ExternalLink className="h-3 w-3" aria-hidden />
                </a>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>
    </>
  );
}
