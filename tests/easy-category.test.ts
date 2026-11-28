import { describe, expect, it } from "vitest";
import { categoryGlyph } from "@/components/easy/category-glyph";

describe("categoryGlyph", () => {
  it("gives default categories a recognizable picture", () => {
    expect(categoryGlyph("Sales", "income")).toBe("🛒");
    expect(categoryGlyph("Transport", "expense")).toBe("🛵");
    expect(categoryGlyph("Utilities", "expense")).toBe("💡");
  });

  it("understands French and Pidgin category names", () => {
    expect(categoryGlyph("Achats de marchandises", "expense")).toBe("📦");
    expect(categoryGlyph("Light and water", "expense")).toBe("💡");
  });

  it("uses an explicit icon when it is known and a safe fallback otherwise", () => {
    expect(categoryGlyph("Custom", "expense", "fuel")).toBe("⛽");
    expect(categoryGlyph("Custom income", "income")).toBe("💰");
    expect(categoryGlyph("Custom expense", "expense")).toBe("🧾");
  });
});
