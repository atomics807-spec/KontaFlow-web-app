import type { Locale } from "@/lib/i18n/config";
import type { Article, LegalDoc, SiteContent } from "./types";

const loaders: Record<Locale, () => Promise<SiteContent>> = {
  en: async () => (await import("./en")).en,
  fr: async () => (await import("./fr")).fr,
  pcm: async () => (await import("./pcm")).pcm,
};

export async function getSiteContent(locale: Locale): Promise<SiteContent> {
  return (loaders[locale] ?? loaders.en)();
}

export function findLegalDoc(content: SiteContent, slug: string): LegalDoc | undefined {
  return content.legal.find((doc) => doc.slug === slug);
}

export function isArticlePublished(article: Article, now = new Date()): boolean {
  if (article.status !== "published") return false;
  const published = new Date(`${article.publishedAt}T23:59:59Z`);
  return !Number.isNaN(published.getTime()) && published <= now;
}

export function listPublishedArticles(content: SiteContent, now = new Date()): Article[] {
  return content.blog.articles
    .filter((article) => isArticlePublished(article, now))
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}

export function findArticle(content: SiteContent, slug: string): Article | undefined {
  return content.blog.articles.find((article) => article.slug === slug);
}

export function findPublishedArticle(content: SiteContent, slug: string, now = new Date()): Article | undefined {
  const article = findArticle(content, slug);
  return article && isArticlePublished(article, now) ? article : undefined;
}

export function articleCanonicalPath(article: Article): string {
  return article.canonicalPath ?? `/resources/${article.slug}`;
}

export type { Article, LegalDoc, SiteContent };
