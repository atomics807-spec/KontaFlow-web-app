const DEFAULT_TIMEOUT_MS = 15_000;

export type ProviderResponse = {
  status: number;
  ok: boolean;
  headers: Headers;
  text: string;
  json: Record<string, unknown> | null;
};

export async function providerFetch(
  url: string,
  init: RequestInit = {},
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<ProviderResponse> {
  const response = await fetch(url, {
    ...init,
    signal: init.signal ?? AbortSignal.timeout(timeoutMs),
    cache: "no-store",
  });
  const text = await response.text();
  let json: Record<string, unknown> | null = null;
  try {
    const parsed = text ? (JSON.parse(text) as unknown) : null;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      json = parsed as Record<string, unknown>;
    }
  } catch {
    json = null;
  }
  return {
    status: response.status,
    ok: response.ok,
    headers: response.headers,
    text,
    json,
  };
}

export function basicAuth(username: string, password: string): string {
  return `Basic ${Buffer.from(`${username}:${password}`, "utf8").toString("base64")}`;
}

export function stringField(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function numberField(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return null;
}
