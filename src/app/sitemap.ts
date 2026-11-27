import type { MetadataRoute } from "next";
import { LOCALES, LOCALE_META } from "@/lib/i18n/config";
import { articleCanonicalPath, getSiteContent, listPublishedArticles } from "@/lib/content";
import { SITE_URL } from "@/lib/seo";

type PageEntry = {
  path: string;
  priority: number;
  changeFrequency: "weekly" | "monthly" | "yearly";
  lastModified?: Date;
};

function languageAlternates(path: string): Record<string, string> {
  return {
    ...Object.fromEntries(LOCALES.map((code) => [LOCALE_META[code].htmlLang, `${SITE_URL}/${code}${path}`])),
    "x-default": `${SITE_URL}/en${path}`,
  };
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const content = await getSiteContent("en");
  const now = new Date();
  const publishedArticles = listPublishedArticles(content, now);
  const latestArticle = publishedArticles[0]?.updatedAt;

  const pages: PageEntry[] = [
    { path: "", priority: 1, changeFrequency: "weekly" },
    { path: "/features", priority: 0.9, changeFrequency: "monthly" },
    { path: "/pricing", priority: 0.9, changeFrequency: "monthly" },
    { path: "/how-it-works", priority: 0.8, changeFrequency: "monthly" },
    { path: "/compare", priority: 0.8, changeFrequency: "monthly" },
    { path: "/resources", priority: 0.8, changeFrequency: "weekly", lastModified: latestArticle ? new Date(latestArticle) : undefined },
    { path: "/glossary", priority: 0.7, changeFrequency: "monthly" },
    { path: "/about", priority: 0.7, changeFrequency: "monthly" },
    { path: "/services", priority: 0.7, changeFrequency: "monthly" },
    { path: "/contact", priority: 0.7, changeFrequency: "yearly" },
    { path: "/faq", priority: 0.6, changeFrequency: "monthly" },
    { path: "/security", priority: 0.6, changeFrequency: "monthly" },
    { path: "/photo-credits", priority: 0.3, changeFrequency: "yearly" },
    ...content.legal.map((doc) => ({
      path: `/legal/${doc.slug}`,
      priority: 0.4,
      changeFrequency: "yearly" as const,
      lastModified: doc.updatedAt ? new Date(doc.updatedAt) : undefined,
    })),
    ...publishedArticles.map((article) => ({
      path: articleCanonicalPath(article),
      priority: 0.6,
      changeFrequency: "monthly" as const,
      lastModified: new Date(article.updatedAt),
    })),
  ];

  return pages.flatMap((page) =>
    LOCALES.map((locale) => ({
      url: `${SITE_URL}/${locale}${page.path}`,
      lastModified: page.lastModified ?? now,
      changeFrequency: page.changeFrequency,
      priority: page.priority,
      alternates: { languages: languageAlternates(page.path) },
    })),
  );
}
