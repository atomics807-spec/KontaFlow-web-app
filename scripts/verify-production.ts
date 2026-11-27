#!/usr/bin/env tsx
/**
 * Read-only production readiness check.
 *
 *   APP_ENV=production DEPLOYMENT_TARGET=vercel npm run verify:production
 *   npm run verify:production -- --local     # local DB, skip provider gates
 *
 * It never writes to the database and never prints secret values.
 */
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { Client } from "pg";

const MIGRATIONS_DIR = "supabase/migrations";
const LOCAL = process.argv.includes("--local");
let passed = 0;
let warned = 0;
let failed = 0;

type Level = "pass" | "warn" | "fail";
function report(level: Level, message: string): void {
  if (level === "pass") passed += 1;
  if (level === "warn") warned += 1;
  if (level === "fail") failed += 1;
  const label = level.toUpperCase().padEnd(4);
  console.log(`  ${label} ${message}`);
}

function loadEnvFile(file: string): void {
  if (!existsSync(file)) return;
  for (const rawLine of readFileSync(file, "utf8").split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    if (process.env[key] !== undefined) continue;
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

function env(key: string): string {
  return (process.env[key] ?? "").trim();
}

function present(key: string): boolean {
  return env(key).length > 0;
}

function checkEnv(): void {
  console.log("\nEnvironment");
  const appUrl = env("NEXT_PUBLIC_APP_URL");
  if (appUrl) {
    try {
      const parsed = new URL(appUrl);
      report(parsed.protocol === "https:" || LOCAL ? "pass" : "fail", `NEXT_PUBLIC_APP_URL is ${parsed.origin}`);
    } catch {
      report("fail", "NEXT_PUBLIC_APP_URL is not a valid URL");
    }
  } else {
    report("fail", "NEXT_PUBLIC_APP_URL is missing");
  }

  for (const key of ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_DB_URL"]) {
    report(present(key) ? "pass" : "fail", `${key} is ${present(key) ? "set" : "missing"}`);
  }

  if (!LOCAL) {
    report(env("APP_ENV") === "production" ? "pass" : "fail", `APP_ENV is ${env("APP_ENV") || "unset"} (expected production)`);
    const target = env("DEPLOYMENT_TARGET");
    report(["vercel", "cloudflare"].includes(target) ? "pass" : "fail", `DEPLOYMENT_TARGET is ${target || "unset"}`);
    report(present("APP_VERSION") ? "pass" : "warn", "APP_VERSION is set for release correlation");

    const cron = env("CRON_SECRET");
    report(cron.length >= 32 ? "pass" : "fail", "CRON_SECRET is at least 32 characters");
    const otp = env("OTP_HMAC_SECRET");
    report(
      otp.length >= 32 && otp !== env("SUPABASE_SERVICE_ROLE_KEY") ? "pass" : "fail",
      "OTP_HMAC_SECRET is at least 32 characters and distinct from the service-role key",
    );
    report(["africastalking"].includes(env("SMS_PROVIDER")) ? "pass" : "fail", `SMS_PROVIDER is ${env("SMS_PROVIDER") || "unset"}`);
    report(present("RESEND_API_KEY") ? "pass" : "fail", "RESEND_API_KEY is set");
    report(present("OPENAI_API_KEY") ? "pass" : "warn", "OPENAI_API_KEY is set (assistant enabled)");
    report(env("USSD_CALLBACK_TOKEN").length >= 16 ? "pass" : "fail", "USSD_CALLBACK_TOKEN is at least 16 characters");
    report(
      env("WHATSAPP_VERIFY_TOKEN").length >= 16 && env("WHATSAPP_APP_SECRET").length >= 16 ? "pass" : "fail",
      "WhatsApp verify token and app secret are configured",
    );
    report(env("HEALTHCHECK_TOKEN").length >= 16 ? "pass" : "warn", "HEALTHCHECK_TOKEN protects the readiness endpoint");

    if (env("PAYMENT_MODE") === "production") {
      const provider = env("PAYMENT_PROVIDER");
      const ready =
        (provider === "mtn-momo" || provider === "none") &&
        present("MTN_MOMO_SUBSCRIPTION_KEY") &&
        present("MTN_MOMO_API_USER_ID") &&
        present("MTN_MOMO_API_KEY");
      const orangeReady =
        (provider === "orange-money" || provider === "none") &&
        present("ORANGE_MONEY_CLIENT_ID") &&
        present("ORANGE_MONEY_CLIENT_SECRET") &&
        present("ORANGE_MONEY_MERCHANT_KEY");
      report(ready || orangeReady ? "pass" : "fail", `PAYMENT_MODE=production credentials (provider: ${provider || "none"})`);
    } else {
      report("warn", `PAYMENT_MODE is ${env("PAYMENT_MODE") || "unset"}; checkout is disabled`);
    }
  }
}

async function checkDatabase(): Promise<void> {
  console.log("\nDatabase");
  const url = env("SUPABASE_DB_URL");
  if (!url) {
    report("fail", "SUPABASE_DB_URL is missing; database checks skipped");
    return;
  }

  const client = new Client({ connectionString: url });
  try {
    await client.connect();
    const version = await client.query<{ version: string }>("select version()");
    report("pass", `connected (${version.rows[0]?.version.split(",")[0] ?? "unknown"})`);

    const localVersions = readdirSync(MIGRATIONS_DIR)
      .filter((file) => file.endsWith(".sql"))
      .map((file) => file.split("_")[0]!);
    try {
      const applied = await client.query<{ version: string }>(
        "select version from supabase_migrations.schema_migrations",
      );
      const done = new Set(applied.rows.map((row) => row.version));
      const pending = localVersions.filter((version) => !done.has(version));
      report(pending.length === 0 ? "pass" : "fail", pending.length === 0 ? `all ${localVersions.length} migrations applied` : `pending migrations: ${pending.join(", ")}`);
    } catch {
      report("fail", "supabase_migrations.schema_migrations is missing; run npm run db:push");
    }

    const unprotected = await client.query<{ relname: string }>(
      `select c.relname
         from pg_class c
         join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
        order by 1`,
    );
    report(unprotected.rowCount === 0 ? "pass" : "fail", unprotected.rowCount === 0 ? "RLS is enabled on every public table" : `RLS missing: ${unprotected.rows.map((row) => row.relname).join(", ")}`);

    const serviceOnly = await client.query<{ relname: string }>(
      `select c.relname
         from pg_class c
         join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
          and not exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname)
        order by 1`,
    );
    if (serviceOnly.rowCount) {
      report("pass", `service-only tables (RLS, no client policy): ${serviceOnly.rows.map((row) => row.relname).join(", ")}`);
    }

    const buckets = await client.query<{ id: string; public: boolean; allowed_mime_types: string[] | null }>(
      "select id, public, allowed_mime_types from storage.buckets order by id",
    );
    const expected = [
      "kontaflow-business-documents",
      "kontaflow-invoices",
      "kontaflow-profile-images",
      "kontaflow-receipts",
      "kontaflow-report-exports",
      "kontaflow-workspace-logos",
    ];
    const bucketIds = new Set(buckets.rows.map((row) => row.id));
    const missing = expected.filter((id) => !bucketIds.has(id));
    const publicBuckets = buckets.rows.filter((row) => row.public).map((row) => row.id);
    report(missing.length === 0 && publicBuckets.length === 0 ? "pass" : "fail", missing.length === 0 && publicBuckets.length === 0 ? "all expected storage buckets exist and are private" : `buckets missing: ${missing.join(", ") || "none"}; public: ${publicBuckets.join(", ") || "none"}`);

    const logos = buckets.rows.find((row) => row.id === "kontaflow-workspace-logos");
    const svg = (logos?.allowed_mime_types ?? []).includes("image/svg+xml");
    report(svg ? "fail" : "pass", "workspace logos reject SVG uploads");

    const adminTables = ["platform_settings", "security_rate_limits"];
    for (const table of adminTables) {
      const result = await client.query<{ allowed: boolean }>(
        `select has_table_privilege('authenticated', $1, 'select') as allowed`,
        [`public.${table}`],
      );
      report(result.rows[0]?.allowed ? "fail" : "pass", `authenticated cannot select ${table}`);
    }

    const channelFunctions = await client.query<{ name: string; allowed: boolean }>(
      `select p.proname as name, has_function_privilege('authenticated', p.oid, 'execute') as allowed
         from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname in ('record_channel_transaction', 'expire_trials')
        order by 1`,
    );
    for (const row of channelFunctions.rows) {
      report(row.allowed ? "fail" : "pass", `authenticated cannot execute ${row.name}`);
    }
  } catch (error) {
    report("fail", `database check failed: ${(error as Error).message}`);
  } finally {
    await client.end().catch(() => undefined);
  }
}

async function main(): Promise<void> {
  for (const file of [".env.production.local", ".env.production", ".env.local"]) loadEnvFile(file);
  console.log(`KontaFlow production readiness${LOCAL ? " (local mode)" : ""}`);
  checkEnv();
  await checkDatabase();
  console.log(`\nResult: ${passed} passed, ${warned} warnings, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
