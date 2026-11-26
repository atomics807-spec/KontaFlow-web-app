#!/usr/bin/env tsx
/**
 * Compares the Tolgee project against the bundled dictionaries without
 * rewriting source files. The app keeps bundled dictionaries as its offline
 * fallback, so this command is a review gate, not a build step.
 */
import { en } from "../src/lib/i18n/dictionaries/en";
import { fr } from "../src/lib/i18n/dictionaries/fr";
import { pcm } from "../src/lib/i18n/dictionaries/pcm";
import type { Locale } from "../src/lib/i18n/config";

const DICTIONARIES: Record<Locale, unknown> = { en, fr, pcm };

function flatten(value: unknown, prefix = ""): string[] {
  if (value === null || typeof value !== "object") return [prefix];
  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
    flatten(child, prefix ? `${prefix}.${key}` : key),
  );
}

function flattenValues(value: unknown, prefix = ""): Record<string, string> {
  if (typeof value === "string") return { [prefix]: value };
  if (!value || typeof value !== "object") return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
      Object.entries(flattenValues(child, prefix ? `${prefix}.${key}` : key)),
    ),
  );
}

async function main() {
  const projectId = process.env.NEXT_PUBLIC_TOLGEE_PROJECT_ID;
  const apiKey = process.env.TOLGEE_API_KEY;
  const apiUrl = (process.env.TOLGEE_API_URL ?? "https://app.tolgee.io").replace(/\/$/, "");

  if (!projectId || !apiKey) {
    console.error("Set NEXT_PUBLIC_TOLGEE_PROJECT_ID and TOLGEE_API_KEY to inspect the remote project.");
    process.exit(1);
  }

  const base = new Set(flatten(en));
  let failures = 0;

  for (const locale of Object.keys(DICTIONARIES) as Locale[]) {
    const response = await fetch(
      `${apiUrl}/v2/projects/${encodeURIComponent(projectId)}/translations/${encodeURIComponent(locale)}?ak=${encodeURIComponent(apiKey)}`,
      { headers: { Accept: "application/json" } },
    );
    if (!response.ok) {
      console.error(`${locale}: Tolgee responded ${response.status}`);
      failures += 1;
      continue;
    }

    const remote = flattenValues(await response.json());
    const missing = Array.from(base).filter((key) => !(key in remote));
    const extra = Object.keys(remote).filter((key) => !base.has(key));

    console.log(`${locale}: ${Object.keys(remote).length} remote keys, ${missing.length} missing, ${extra.length} extra`);
    if (missing.length) console.log(`  missing: ${missing.slice(0, 12).join(", ")}${missing.length > 12 ? " …" : ""}`);
    if (extra.length) console.log(`  extra:   ${extra.slice(0, 12).join(", ")}${extra.length > 12 ? " …" : ""}`);
    failures += missing.length > 0 ? 1 : 0;
  }

  if (failures) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
