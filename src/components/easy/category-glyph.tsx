import type { CategoryKind } from "@/types/database";

const GLYPHS: Record<string, string> = {
  sales: "🛒",
  sale: "🛒",
  ventes: "🛒",
  services: "🛠️",
  service: "🛠️",
  "other income": "💰",
  "autres produits": "💰",
  "other moni wey kam in": "💰",
  "stock purchases": "📦",
  "achats de marchandises": "📦",
  "buy stock": "📦",
  supplies: "🧺",
  fournitures: "🧺",
  transport: "🛵",
  rent: "🏠",
  loyer: "🏠",
  salaries: "👥",
  salaires: "👥",
  salary: "👥",
  utilities: "💡",
  "electricity and water": "💡",
  "electricite et eau": "💡",
  "light and water": "💡",
  fuel: "⛽",
  carburant: "⛽",
  marketing: "📣",
  "taxes and fees": "🏛️",
  "taxes & fees": "🏛️",
  "impots et taxes": "🏛️",
  tax: "🏛️",
  "other expenses": "🧾",
  "autres charges": "🧾",
  "other expense": "🧾",
};

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function categoryGlyph(name: string, kind: CategoryKind, icon?: string | null): string {
  const iconKey = icon ? normalize(icon) : "";
  if (iconKey && GLYPHS[iconKey]) return GLYPHS[iconKey];

  const nameKey = normalize(name);
  if (GLYPHS[nameKey]) return GLYPHS[nameKey];

  return kind === "income" ? "💰" : "🧾";
}
