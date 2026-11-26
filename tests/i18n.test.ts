import { describe, expect, it } from "vitest";
import {
  intlLocale,
  isLocale,
  localizePath,
  localizedPath,
  negotiateLocale,
  pickTranslation,
  resolveLocale,
  resolvePathLocale,
} from "@/lib/i18n/config";
import { interpolate } from "@/lib/i18n/interpolate";
import { en } from "@/lib/i18n/dictionaries/en";
import { fr } from "@/lib/i18n/dictionaries/fr";
import { pcm } from "@/lib/i18n/dictionaries/pcm";

function flatten(value: unknown, prefix = ""): string[] {
  if (value === null || typeof value !== "object") return [prefix];
  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
    flatten(child, prefix ? `${prefix}.${key}` : key),
  );
}

describe("locale resolution", () => {
  it("accepts supported locales and rejects others", () => {
    expect(isLocale("en")).toBe(true);
    expect(isLocale("fr")).toBe(true);
    expect(isLocale("pcm")).toBe(true);
    expect(isLocale("wes")).toBe(false);
    expect(isLocale("de")).toBe(false);
  });

  it("maps the legacy wes code to pcm", () => {
    expect(resolveLocale("wes")).toBe("pcm");
    expect(resolveLocale("wes-CM")).toBe("pcm");
    expect(resolveLocale("pcm")).toBe("pcm");
    expect(resolveLocale("pcm-CM")).toBe("pcm");
    expect(resolveLocale("pidgin")).toBe("pcm");
  });

  it("extracts a supported locale from a regional tag", () => {
    expect(resolveLocale("fr-CM")).toBe("fr");
    expect(resolveLocale("en-GB")).toBe("en");
    expect(resolveLocale("de-DE")).toBe("en");
    expect(resolveLocale(null)).toBe("en");
  });

  it("negotiates from an Accept-Language header", () => {
    expect(negotiateLocale("fr-CM,fr;q=0.9,en;q=0.4")).toBe("fr");
    expect(negotiateLocale("pcm,en;q=0.8")).toBe("pcm");
    expect(negotiateLocale("wes,en;q=0.8")).toBe("pcm");
    expect(negotiateLocale("de-DE,de;q=0.9,en;q=0.6")).toBe("en");
    expect(negotiateLocale("*")).toBe("en");
    expect(negotiateLocale(null)).toBe("en");
  });

  it("maps app locales to Intl locales", () => {
    expect(intlLocale("fr")).toBe("fr-CM");
    expect(intlLocale("pcm")).toBe("en-CM");
    expect(intlLocale("en")).toBe("en-CM");
  });

  it("rewrites locale prefixes without losing the rest of the path", () => {
    expect(localizePath("/fr/dashboard/reports", "pcm")).toBe("/pcm/dashboard/reports");
    expect(localizePath("/wes/pricing", "fr")).toBe("/fr/pricing");
    expect(localizePath("/dashboard", "fr")).toBe("/fr/dashboard");
    expect(localizedPath("pcm", "/")).toBe("/pcm");
  });

  it("resolves legacy path segments", () => {
    expect(resolvePathLocale("wes")).toBe("pcm");
    expect(resolvePathLocale("pcm")).toBe("pcm");
    expect(resolvePathLocale("de")).toBeNull();
    expect(resolvePathLocale(undefined)).toBeNull();
  });

  it("falls back from pcm translation rows to the legacy wes key", () => {
    expect(pickTranslation({ fr: "Ventes", wes: "Sale" }, "pcm")).toBe("Sale");
    expect(pickTranslation({ pcm: "Sale", wes: "Old" }, "pcm")).toBe("Sale");
    expect(pickTranslation(null, "pcm")).toBeUndefined();
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

  it("selects ICU plural categories using the locale", () => {
    const template = "{count, plural, one {# entry} other {# entries}}";
    expect(interpolate(template, { count: 1 })).toBe("1 entry");
    expect(interpolate(template, { count: 12 })).toBe("12 entries");
    expect(interpolate(template, { count: 0 })).toBe("0 entries");
  });

  it("uses locale-specific plural rules", () => {
    const template = "{count, plural, one {# dossier} other {# dossiers}}";
    expect(interpolate(template, { count: 0 }, { locale: "fr-CM" })).toBe("0 dossier");
    expect(interpolate(template, { count: 2 }, { locale: "fr-CM" })).toBe("2 dossiers");
  });

  it("keeps a plural block when its value is missing", () => {
    const template = "{count, plural, one {# entry} other {# entries}}";
    expect(interpolate(template, {})).toBe(template);
  });
});

describe("dictionary parity", () => {
  it("ships the same keys in English, French and Pidgin", () => {
    const base = flatten(en).sort();
    expect(flatten(fr).sort()).toEqual(base);
    expect(flatten(pcm).sort()).toEqual(base);
  });

  it("has no empty strings", () => {
    for (const dict of [en, fr, pcm]) {
      for (const path of flatten(dict)) {
        const value = path
          .split(".")
          .reduce<unknown>((acc, part) => (acc as Record<string, unknown>)[part], dict);
        expect(String(value).trim().length, path).toBeGreaterThan(0);
      }
    }
  });

  it("covers channel, email and CSV surfaces", () => {
    for (const dict of [en, fr, pcm]) {
      expect(dict.channels.ussd.menu.length).toBeGreaterThan(10);
      expect(dict.channels.whatsapp.notLinked.length).toBeGreaterThan(10);
      expect(dict.emails.inviteSubject).toContain("{workspace}");
      expect(dict.emails.dailyText).toContain("{cash}");
      expect(dict.reports.csv.amount.length).toBeGreaterThan(0);
      expect(dict.reports.downloadPdf.length).toBeGreaterThan(0);
      expect(dict.reports.pdfFooter.length).toBeGreaterThan(0);
      expect(dict.common.month.length).toBeGreaterThan(0);
    }
  });
});
