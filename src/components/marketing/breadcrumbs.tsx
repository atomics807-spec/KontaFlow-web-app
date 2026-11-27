import Link from "next/link";
import { JsonLd } from "@/components/seo/json-ld";
import { breadcrumbListSchema, type BreadcrumbItem } from "@/lib/structured-data";
import { cn } from "@/lib/utils";
import type { Locale } from "@/lib/i18n/config";

export function Breadcrumbs({
  locale,
  label,
  homeLabel,
  items,
  tone = "light",
  className,
}: {
  locale: Locale;
  label: string;
  homeLabel: string;
  items: BreadcrumbItem[];
  tone?: "light" | "dark";
  className?: string;
}) {
  const all: BreadcrumbItem[] = [{ label: homeLabel, href: `/${locale}` }, ...items];

  return (
    <>
      <nav
        aria-label={label}
        className={cn(
          "text-xs",
          tone === "dark" ? "text-jade-100/70" : "text-muted",
          className,
        )}
      >
        <ol className="flex flex-wrap items-center gap-2">
          {all.map((item, index) => {
            const current = index === all.length - 1;
            return (
              <li key={`${item.label}-${index}`} className="flex items-center gap-2">
                {index > 0 ? <span aria-hidden>/</span> : null}
                {item.href && !current ? (
                  <Link
                    href={item.href}
                    className={tone === "dark" ? "hover:text-white" : "hover:text-heading"}
                  >
                    {item.label}
                  </Link>
                ) : (
                  <span
                    aria-current={current ? "page" : undefined}
                    className={tone === "dark" ? "text-jade-100/95" : "text-heading"}
                  >
                    {item.label}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
      <JsonLd data={breadcrumbListSchema(locale, all)} />
    </>
  );
}
