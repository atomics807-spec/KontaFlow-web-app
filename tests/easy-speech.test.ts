import { describe, expect, it } from "vitest";
import { parseSpokenAmount, speechLanguage } from "@/lib/easy/speech";

describe("parseSpokenAmount", () => {
  it("reads plain digits and grouped thousands", () => {
    expect(parseSpokenAmount("2500")).toBe("2500");
    expect(parseSpokenAmount("2 500")).toBe("2500");
    expect(parseSpokenAmount("2,500 francs")).toBe("2500");
    expect(parseSpokenAmount("I sold 5,000 FCFA")).toBe("5000");
  });

  it("reads English number words", () => {
    expect(parseSpokenAmount("five thousand")).toBe("5000");
    expect(parseSpokenAmount("two thousand five hundred")).toBe("2500");
    expect(parseSpokenAmount("twenty five thousand")).toBe("25000");
  });

  it("reads French number words", () => {
    expect(parseSpokenAmount("deux mille cinq cents")).toBe("2500");
    expect(parseSpokenAmount("quatre-vingt mille")).toBe("80000");
    expect(parseSpokenAmount("soixante-dix mille")).toBe("70000");
    expect(parseSpokenAmount("vingt et un mille")).toBe("21000");
  });

  it("reads digit-by-digit speech", () => {
    expect(parseSpokenAmount("two five zero zero")).toBe("2500");
  });

  it("picks the amount when the sentence also contains a quantity", () => {
    expect(parseSpokenAmount("2 crates for 5,000")).toBe("5000");
  });

  it("returns null when no positive amount is present", () => {
    expect(parseSpokenAmount("")).toBeNull();
    expect(parseSpokenAmount("no money here")).toBeNull();
    expect(parseSpokenAmount("0")).toBeNull();
  });
});

describe("speechLanguage", () => {
  it("uses French for French and English for English/Pidgin", () => {
    expect(speechLanguage("fr")).toBe("fr-CM");
    expect(speechLanguage("en")).toBe("en-CM");
    expect(speechLanguage("pcm")).toBe("en-CM");
  });
});
