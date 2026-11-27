import type { SimplePageCopy } from "@/lib/content/types";
import type { Locale } from "@/lib/i18n/config";
import type { BreadcrumbItem } from "@/lib/structured-data";
import { CtaBand, PageHero, ProseSections } from "./site";

export function DetailPage({
  page,
  locale,
  primaryHref,
  primaryLabel,
  secondaryHref,
  secondaryLabel,
  breadcrumbs,
  breadcrumbLabel,
  homeLabel,
}: {
  page: SimplePageCopy;
  locale: Locale;
  primaryHref: string;
  primaryLabel: string;
  secondaryHref: string;
  secondaryLabel: string;
  breadcrumbs?: BreadcrumbItem[];
  breadcrumbLabel?: string;
  homeLabel?: string;
}) {
  return (
    <>
      <PageHero
        page={page}
        locale={locale}
        primaryHref={primaryHref}
        primaryLabel={primaryLabel}
        secondaryHref={secondaryHref}
        secondaryLabel={secondaryLabel}
        breadcrumbs={breadcrumbs}
        breadcrumbLabel={breadcrumbLabel}
        homeLabel={homeLabel}
      />
      <section className="py-16 sm:py-20">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="mb-14 max-w-3xl">
            <h2 className="text-2xl font-extrabold tracking-tight text-heading sm:text-3xl">{page.introTitle}</h2>
            <p className="mt-4 text-base leading-relaxed text-muted">{page.introBody}</p>
          </div>
          <ProseSections sections={page.sections} />
        </div>
      </section>
      <CtaBand {...page.cta} locale={locale} />
    </>
  );
}
