import { getServerEnv } from "../env";
import { logger } from "../logger";
import type { Locale } from "./config";

export type TolgeeOverrides = Record<string, string>;

const REVALIDATE_SECONDS = 300;

/**
 * Pulls translations from a Tolgee project using its REST API and returns a
 * flat `{ "dot.path": "translated value" }` map.
 *
 * We intentionally keep this adapter dependency-free: Tolgee is a headless
 * translation service, and the app only needs its data. If Tolgee is not
 * configured, unreachable or slow, we return `null` and the bundled
 * dictionary is used verbatim, so a translation outage never breaks the app.
 */
export async function getTolgeeOverrides(locale: Locale): Promise<TolgeeOverrides | null> {
  const projectId = process.env.NEXT_PUBLIC_TOLGEE_PROJECT_ID;
  const apiKey = process.env.TOLGEE_API_KEY;
  if (!projectId || !apiKey) return null;

  const { TOLGEE_API_URL } = getServerEnv();
  const url = `${TOLGEE_API_URL}/v2/projects/${encodeURIComponent(projectId)}/translations/${encodeURIComponent(
    locale,
  )}?ak=${encodeURIComponent(apiKey)}`;

  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      next: { revalidate: REVALIDATE_SECONDS, tags: [`tolgee:${locale}`] },
    });
    if (!response.ok) throw new Error(`Tolgee responded ${response.status}`);

    const payload: unknown = await response.json();
    return flatten(payload);
  } catch (error) {
    logger.warn("tolgee.overrides_failed", { locale, error });
    return null;
  }
}

function flatten(payload: unknown): TolgeeOverrides {
  if (!payload || typeof payload !== "object") return {};

  const result: TolgeeOverrides = {};
  const walk = (node: unknown, prefix: string) => {
    if (typeof node === "string") {
      if (prefix) result[prefix] = node;
      return;
    }
    if (node && typeof node === "object") {
      for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
        walk(value, prefix ? `${prefix}.${key}` : key);
      }
    }
  };
  walk(payload, "");
  return result;
}

/** Merges flat Tolgee overrides into a nested typed dictionary. */
export function applyOverrides<T>(base: T, overrides: TolgeeOverrides): T {
  const clone = structuredClone(base) as Record<string, unknown>;

  for (const [path, value] of Object.entries(overrides)) {
    const parts = path.split(".");
    let cursor: Record<string, unknown> = clone;

    for (let index = 0; index < parts.length - 1; index += 1) {
      const part = parts[index];
      const next = cursor[part];
      if (!next || typeof next !== "object") {
        cursor = {};
        break;
      }
      cursor = next as Record<string, unknown>;
    }

    const leaf = parts[parts.length - 1];
    if (leaf && leaf in cursor && typeof cursor[leaf] === "string") {
      cursor[leaf] = value;
    }
  }

  return clone as T;
}
