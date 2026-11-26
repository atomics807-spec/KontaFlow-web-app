import "server-only";

import { pickTranslation, type Locale } from "@/lib/i18n/config";
import { createAdminClient } from "@/lib/supabase/admin";
import type { UssdKind } from "@/lib/ussd/menu";

export type UssdCategoryOption = { id: string; label: string };

const PREFERRED: Record<UssdKind, string[][]> = {
  income: [["Sales"], ["Other income"]],
  expense: [["Transport"], ["Food"], ["Inventory", "Stock purchases"], ["Other expenses"]],
};

const MAX_OPTIONS = 4;
const SHORT_LABELS: Record<string, string> = {
  "Other expenses": "Other",
  "Other income": "Other income",
  "Stock purchases": "Inventory",
};

function labelFor(row: { name: string; translations: unknown }, locale: Locale): string {
  const translations =
    row.translations && typeof row.translations === "object" && !Array.isArray(row.translations)
      ? (row.translations as Record<string, string>)
      : null;
  const label = pickTranslation(translations, locale) ?? SHORT_LABELS[row.name] ?? row.name;
  return label.slice(0, 24);
}

/**
 * A short, stable category list. Preferred names match the seeded chart of
 * accounts; anything else fills the remaining slots alphabetically.
 */
export async function listUssdCategories(
  workspaceId: string,
  kind: UssdKind,
  locale: Locale,
): Promise<UssdCategoryOption[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("categories")
    .select("id, name, translations")
    .eq("workspace_id", workspaceId)
    .eq("kind", kind)
    .eq("is_archived", false);

  if (!data || data.length === 0) return [];

  const rows = [...data].sort((a, b) => a.name.localeCompare(b.name));
  const preferred = PREFERRED[kind];
  const ordered: typeof rows = [];
  for (const aliases of preferred) {
    const row = rows.find((candidate) =>
      aliases.some((name) => candidate.name.toLowerCase() === name.toLowerCase()),
    );
    if (row && !ordered.includes(row)) ordered.push(row);
  }
  for (const row of rows) {
    if (!ordered.includes(row)) ordered.push(row);
  }

  return ordered.slice(0, MAX_OPTIONS).map((row) => ({
    id: row.id,
    label: labelFor(row, locale),
  }));
}
