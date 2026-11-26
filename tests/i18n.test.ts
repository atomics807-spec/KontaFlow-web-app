import { describe, expect, it } from "vitest";
import { intlLocale, isLocale, negotiateLocale, resolveLocale } from "@/lib/i18n/config";
import { interpolate } from "@/lib/i18n/interpolate";
import { en } from "@/lib/i18n/dictionaries/en";
import { fr } from "@/lib/i18n/dictionaries/fr";
import { wes } from "@/lib/i18n/dictionaries/wes";

function flatten(value: unknown, prefix = ""): string[] {
  if (value === null || typeof value !== "object") return [prefix];
  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
    flatten(child, prefix ? `${prefix}.${key}` : key),
  );
}

describe("locale resolution", () => {
  it("accepts supported locales and rejects others", () => {
    expect(isLocale("fr")).toBe(true);
    expect(isLocale("wes")).toBe(true);
    expect(isLocale("de")).toBe(false);
  });

  it("extracts a supported locale from a regional tag", () => {
    expect(resolveLocale("fr-CM")).toBe("fr");
    expect(resolveLocale("wes-CM")).toBe("wes");
    expect(resolveLocale("de-DE")).toBe("en");
    expect(resolveLocale(null)).toBe("en");
  });

  it("negotiates from an Accept-Language header", () => {
    expect(negotiateLocale("fr-CM,fr;q=0.9,en;q=0.4")).toBe("fr");
    expect(negotiateLocale("wes,en;q=0.8")).toBe("wes");
    expect(negotiateLocale("*")).toBe("en");
    expect(negotiateLocale(null)).toBe("en");
  });

  it("maps app locales to Intl locales", () => {
    expect(intlLocale("fr")).toBe("fr-CM");
    expect(intlLocale("wes")).toBe("en-CM");
    expect(intlLocale("en")).toBe("en-CM");
  });
});

describe("interpolation", () => {
  it("replaces named placeholders and leaves unknown ones intact", () => {
    expect(interpolate("Hello {name}, you have {count} entries", { name: "Ada", count: 3 })).toBe(
      "Hello Ada, you have 3 entries",
    );
    expect(interpolate("Hi {missing}", {})).toBe("Hi {missing}");
  });

  it("ignores braces with spaces or nesting", () => {
    expect(interpolate("{ name }", { name: "no" })).toBe("{ name }");
  });
});

describe("dictionary parity", () => {
  it("ships the same keys in English, French and Pidgin", () => {
    const base = flatten(en).sort();
    expect(flatten(fr).sort()).toEqual(base);
    expect(flatten(wes).sort()).toEqual(base);
  });

  it("has no empty strings", () => {
    for (const dict of [en, fr, wes]) {
      for (const [key, value] of Object.entries(
        Object.fromEntries(
          flatten(dict).map((path) => [
            path,
            path.split(".").reduce<unknown>((acc, part) => (acc as Record<string, unknown>)[part], dict),
          ]),
        ),
      )) {
        expect(String(value).trim().length, key).toBeGreaterThan(0);
      }
    }
  });
});
