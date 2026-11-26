import type { MetadataRoute } from "next";
import { LOCALES } from "@/lib/i18n/config";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export default function sitemap(): MetadataRoute.Sitemap {
  const updated = new Date();
  const pages = ["", "/login", "/signup"];

  return pages.flatMap((page) =>
    LOCALES.map((locale) => ({
      url: `${BASE_URL}/${locale}${page}`,
      lastModified: updated,
      changeFrequency: page === "" ? ("weekly" as const) : ("monthly" as const),
      priority: page === "" ? 1 : 0.5,
      alternates: {
        languages: Object.fromEntries(LOCALES.map((code) => [code, `${BASE_URL}/${code}${page}`])),
      },
    })),
  );
}
