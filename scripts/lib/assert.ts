import type { Client } from "pg";

let passed = 0;
let failed = 0;
const failures: string[] = [];

export function ok(name: string, condition: boolean, detail?: unknown): void {
  if (condition) {
    passed += 1;
    console.log(`  \u001b[32m✓\u001b[0m ${name}`);
    return;
  }
  failed += 1;
  failures.push(name);
  console.error(`  \u001b[31m✗\u001b[0m ${name}`, detail ?? "");
}

export function eq(name: string, actual: unknown, expected: unknown): void {
  ok(name, String(actual) === String(expected), { actual, expected });
}

/** Runs `fn` inside a transaction that is always rolled back, as a given role. */
export async function asRole<T>(
  client: Client,
  role: "authenticated" | "anon" | "service_role",
  claims: Record<string, unknown> | null,
  fn: (client: Client) => Promise<T>,
  commit = false,
): Promise<T> {
  await client.query("begin");
  try {
    await client.query(`set local role ${role}`);
    const jwtClaims = claims ?? (role === "service_role" ? { role: "service_role" } : null);
    await client.query("select set_config('request.jwt.claims', $1, true)", [
      jwtClaims ? JSON.stringify(jwtClaims) : "",
    ]);
    const result = await fn(client);
    await client.query(commit ? "commit" : "rollback");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  }
}

export async function expectError(
  client: Client,
  role: "authenticated" | "anon" | "service_role",
  claims: Record<string, unknown> | null,
  sql: string,
  params: unknown[] = [],
  options: { commit?: boolean } = {},
): Promise<{ code?: string; message: string } | null> {
  try {
    await asRole(
      client,
      role,
      claims,
      async (c) => {
        await c.query(sql, params);
      },
      options.commit ?? false,
    );
    return null;
  } catch (error) {
    const pgError = error as { code?: string; message: string };
    return { code: pgError.code, message: pgError.message };
  }
}

export function summary(suite: string): void {
  console.log(`\n${suite}: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.error("Failed assertions:");
    for (const failure of failures) console.error(`  - ${failure}`);
    process.exitCode = 1;
  }
}
