import "server-only";

import OpenAI from "openai";
import { getServerEnv } from "../env";

let client: OpenAI | null = null;

/** Returns null when OPENAI_API_KEY is absent so callers can degrade gracefully. */
export function getAiClient(): OpenAI | null {
  const env = getServerEnv();
  if (!env.OPENAI_API_KEY) return null;
  client ??= new OpenAI({ apiKey: env.OPENAI_API_KEY, maxRetries: 1, timeout: 30_000 });
  return client;
}

export function getAiModel(): string {
  return getServerEnv().OPENAI_MODEL;
}

export function isAiConfigured(): boolean {
  try {
    return Boolean(getServerEnv().OPENAI_API_KEY);
  } catch {
    return false;
  }
}
