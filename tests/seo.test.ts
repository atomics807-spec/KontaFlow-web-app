import { describe, expect, it } from "vitest";
import sitemap from "@/app/sitemap";
import robots from "@/app/robots";
import { getSiteContent, listPublishedArticles } from "@/lib/content";
import { marketingMetadata } from "@/lib/seo";
import {
  articleSchema,
  breadcrumbListSchema,
  definedTermSetSchema,
  organizationSchema,
  softwareApplicationSchema,
  webPageSchema,
} from "@/lib/structured-data";

describe("marketing metadata", () => {
  it("points canonical, hreflang and x-default at the localized path", () => {
    const metadata = marketingMetadata({
      locale: "fr",
      path: "/pricing",
      title: "Tarifs",
      description: "Des offres simples.",
    });
    const languages = metadata.alternates?.languages as Record<string, string>;

    expect(metadata.alternates?.canonical).toMatch(/\/fr\/pricing$/);
    expect(languages.en).toMatch(/\/en\/pricing$/);
    expect(languages.fr).toMatch(/\/fr\/pricing$/);
    expect(languages.pcm).toMatch(/\/pcm\/pricing$/);
    expect(languages["x-default"]).toMatch(/\/en\/pricing$/);
  });

  it("sets localized Open Graph locale and absolute image URLs", () => {
    const metadata = marketingMetadata({
      locale: "pcm",
      path: "/faq",
      title: "FAQ",
      description: "Answers.",
    });
    const image = metadata.openGraph?.images;
    const first = Array.isArray(image) ? image[0] : image;

    expect(metadata.openGraph?.locale).toBe("en_CM");
    expect(typeof first === "object" && first !== null && "url" in first ? first.url : "").toMatch(
      /^https?:\/\/.+\/images\/marketing\/og-default\.webp$/,
    );
  });

  it("marks Pidgin titles distinctly from English", () => {
    const metadata = marketingMetadata({
      locale: "pcm",
      path: "/features",
      title: "Features",
      description: "Features.",
    });

    expect(metadata.title).toEqual({ absolute: "Features · Pidgin" });
  });

  it("adds article publication and modification metadata", () => {
    const metadata = marketingMetadata({
      locale: "en",
      path: "/resources/weekly-bookkeeping-routine",
      title: "Weekly routine",
      description: "A routine.",
      type: "article",
      author: "KontaFlow editorial",
      publishedTime: "2026-10-29",
      modifiedTime: "2026-11-20",
      category: "Routine",
    });

    const openGraph = metadata.openGraph as Record<string, unknown>;
    expect(openGraph.type).toBe("article");
    expect(openGraph.publishedTime).toBe("2026-10-29");
    expect(openGraph.modifiedTime).toBe("2026-11-20");
    expect(metadata.robots).toMatchObject({ index: true, follow: true });
  });
});

describe("structured data", () => {
  it("publishes an Article with modified date and localized language", () => {
    const schema = articleSchema({
      locale: "fr",
      path: "/resources/weekly-bookkeeping-routine",
      title: "Une routine hebdomadaire",
      description: "Une routine simple.",
      image: "/images/marketing/market-vendors.webp",
      author: "La rédaction KontaFlow",
      publishedAt: "2026-10-29",
      updatedAt: "2026-11-20",
      category: "Routine",
      tags: ["routine comptable"],
    });

    expect(schema["@type"]).toBe("Article");
    expect(schema.inLanguage).toBe("fr");
    expect(schema.dateModified).toBe("2026-11-20");
    expect(schema.author).toEqual({ "@type": "Organization", name: "La rédaction KontaFlow" });
  });

  it("builds absolute breadcrumb item URLs", () => {
    const schema = breadcrumbListSchema("en", [
      { label: "Home", href: "/en" },
      { label: "Resources", href: "/en/resources" },
      { label: "Article" },
    ]);
    const items = schema.itemListElement as { item?: string }[];

    expect(items).toHaveLength(3);
    expect(items[0].item).toMatch(/^https?:\/\/.+\/en$/);
    expect(items[1].item).toMatch(/^https?:\/\/.+\/en\/resources$/);
    expect(items[2].item).toBeUndefined();
  });

  it("keeps Organization and SoftwareApplication claims factual", () => {
    const organization = organizationSchema("en", "Bookkeeping for African business.");
    const software = softwareApplicationSchema({
      locale: "en",
      description: "Bookkeeping for African business.",
      offers: [{ name: "Growth", price: "9900", priceCurrency: "XAF" }],
    });

    expect(organization["@type"]).toBe("Organization");
    expect(organization.sameAs).toBeUndefined();
    expect(software["@type"]).toBe("SoftwareApplication");
    expect((software.offers as { price: string }[])[0].price).toBe("9900");
  });

  it("describes a glossary as a DefinedTermSet", () => {
    const schema = definedTermSetSchema({
      locale: "pcm",
      path: "/glossary",
      name: "Bookkeeping terms",
      description: "Simple definitions.",
      terms: [{ term: "Ledger", definition: "The complete record." }],
    });

    expect(schema["@type"]).toBe("DefinedTermSet");
    expect((schema.hasDefinedTerm as { name: string }[])[0].name).toBe("Ledger");
  });

  it("adds a WebPage identity and modification date", () => {
    const schema = webPageSchema({
      locale: "en",
      path: "/compare",
      name: "Compare",
      description: "A comparison.",
      dateModified: "2026-11-26",
    });

    expect(schema["@type"]).toBe("WebPage");
    expect(schema.dateModified).toBe("2026-11-26");
  });
});

describe("content publishing", () => {
  it("lists only published, non-future articles", async () => {
    const content = await getSiteContent("en");
    const draft = {
      ...content.blog.articles[0],
      slug: "draft-article",
      status: "draft" as const,
    };
    const future = {
      ...content.blog.articles[1],
      slug: "future-article",
      publishedAt: "2099-01-01",
    };
    const now = new Date("2026-11-26T12:00:00Z");
    const articles = listPublishedArticles(
      { ...content, blog: { ...content.blog, articles: [draft, future] } },
      now,
    );

    expect(articles).toHaveLength(0);
  });

  it("keeps a stable canonical path for every article", async () => {
    const content = await getSiteContent("en");
    for (const article of content.blog.articles) {
      expect(article.canonicalPath).toBe(`/resources/${article.slug}`);
      expect(article.updatedAt >= article.publishedAt).toBe(true);
      expect(article.tags.length).toBeGreaterThan(0);
    }
  });
});

describe("crawl surfaces", () => {
  it("includes public AEO pages and excludes private routes from the sitemap", async () => {
    const entries = await sitemap();
    const urls = entries.map((entry) => entry.url);

    expect(urls.some((url) => url.endsWith("/en/compare"))).toBe(true);
    expect(urls.some((url) => url.endsWith("/en/glossary"))).toBe(true);
    expect(urls.some((url) => url.includes("/en/resources/"))).toBe(true);
    expect(urls.some((url) => url.includes("/en/login"))).toBe(false);
    expect(urls.some((url) => url.includes("/en/signup"))).toBe(false);
    expect(urls.some((url) => url.includes("/en/overview"))).toBe(false);
    expect(urls.some((url) => url.includes("/en/dashboard"))).toBe(false);
    expect(urls.some((url) => url.includes("/en/product"))).toBe(false);
    expect(urls.some((url) => url.includes("/en/channels"))).toBe(false);
  });

  it("declares hreflang alternates on sitemap entries", async () => {
    const entries = await sitemap();
    const entry = entries.find((item) => item.url.endsWith("/fr/pricing"));

    const languages = entry?.alternates?.languages as Record<string, string> | undefined;
    expect(languages?.en).toMatch(/\/en\/pricing$/);
    expect(languages?.pcm).toMatch(/\/pcm\/pricing$/);
    expect(languages?.["x-default"]).toMatch(/\/en\/pricing$/);
  });

  it("blocks private routes in robots.txt", () => {
    const result = robots();
    const rule = Array.isArray(result.rules) ? result.rules[0] : result.rules;
    const disallow = Array.isArray(rule.disallow) ? rule.disallow : [rule.disallow];

    expect(disallow).toContain("/*/dashboard");
    expect(disallow).toContain("/*/admin");
    expect(disallow).toContain("/*/login");
    expect(result.sitemap).toMatch(/\/sitemap\.xml$/);
  });
});
