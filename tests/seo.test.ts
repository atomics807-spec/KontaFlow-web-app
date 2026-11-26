import { describe, expect, it } from "vitest";
import { marketingMetadata } from "@/lib/seo";

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
    expect(languages.wes).toMatch(/\/wes\/pricing$/);
    expect(languages["x-default"]).toMatch(/\/en\/pricing$/);
  });

  it("sets localized Open Graph locale and absolute image URLs", () => {
    const metadata = marketingMetadata({
      locale: "wes",
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
});
