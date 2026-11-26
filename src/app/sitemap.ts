import type { MetadataRoute } from "next";
import { LOCALES } from "@/lib/i18n/config";
import { getSiteContent } from "@/lib/content";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

type PageEntry = {
  path: string;
  priority: number;
  changeFrequency: "weekly" | "monthly" | "yearly";
  lastModified?: Date;
};

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const content = await getSiteContent("en");
  const now = new Date();

  const pages: PageEntry[] = [
    { path: "", priority: 1, changeFrequency: "weekly" },
    { path: "/features", priority: 0.9, changeFrequency: "monthly" },
    { path: "/pricing", priority: 0.9, changeFrequency: "monthly" },
    { path: "/how-it-works", priority: 0.8, changeFrequency: "monthly" },
    { path: "/resources", priority: 0.8, changeFrequency: "weekly" },
    { path: "/about", priority: 0.7, changeFrequency: "monthly" },
    { path: "/services", priority: 0.7, changeFrequency: "monthly" },
    { path: "/contact", priority: 0.7, changeFrequency: "yearly" },
    { path: "/faq", priority: 0.6, changeFrequency: "monthly" },
    { path: "/security", priority: 0.6, changeFrequency: "monthly" },
    { path: "/login", priority: 0.5, changeFrequency: "yearly" },
    { path: "/signup", priority: 0.8, changeFrequency: "yearly" },
    { path: "/photo-credits", priority: 0.3, changeFrequency: "yearly" },
    ...content.legal.map((doc) => ({
      path: `/legal/${doc.slug}`,
      priority: 0.4,
      changeFrequency: "yearly" as const,
    })),
    ...content.blog.articles.map((article) => ({
      path: `/resources/${article.slug}`,
      priority: 0.6,
      changeFrequency: "yearly" as const,
      lastModified: new Date(`${article.publishedAt}T12:00:00Z`),
    })),
  ];

  return pages.flatMap((page) =>
    LOCALES.map((locale) => ({
      url: `${BASE_URL}/${locale}${page.path}`,
      lastModified: page.lastModified ?? now,
      changeFrequency: page.changeFrequency,
      priority: page.priority,
      alternates: {
        languages: {
          ...Object.fromEntries(LOCALES.map((code) => [code, `${BASE_URL}/${code}${page.path}`])),
          "x-default": `${BASE_URL}/en${page.path}`,
        },
      },
    })),
  );
}
