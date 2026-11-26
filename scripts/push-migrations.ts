#!/usr/bin/env tsx
/**
 * Applies pending SQL migrations to the database in SUPABASE_DB_URL.
 *
 *   npm run db:push                 # pending migrations only
 *   npm run db:push -- --seed       # migrations, then supabase/seed.sql
 *
 * The ledger lives in supabase_migrations.schema_migrations, the same table
 * the Supabase CLI uses, so either tool can take over from the other. Files
 * already recorded there are never re-run. Migrations are forward-only: edit
 * schema by adding a new file, never by changing one that has shipped.
 */
import { readdir, readFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";

const MIGRATIONS_DIR = "supabase/migrations";
const SEED_FILE = "supabase/seed.sql";

interface Applied {
  version: string;
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

function versionOf(file: string): string {
  return file.split("_")[0]!;
}

function nameOf(file: string): string {
  return file.replace(/\.sql$/, "").split("_").slice(1).join("_");
}

async function main(): Promise<void> {
  loadEnvFile(".env.local");
  const url = process.env.SUPABASE_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
  const runSeed = process.argv.includes("--seed");

  const client = new Client({ connectionString: url });
  await client.connect();

  try {
    await client.query(`
      create schema if not exists supabase_migrations;
      create table if not exists supabase_migrations.schema_migrations (
        version text primary key,
        statements text[],
        name text,
        inserted_at timestamptz not null default now()
      );
    `);

    const applied = await client.query<Applied>(
      "select version from supabase_migrations.schema_migrations",
    );
    const done = new Set(applied.rows.map((row) => row.version));

    const files = (await readdir(MIGRATIONS_DIR)).filter((file) => file.endsWith(".sql")).sort();
    const pending = files.filter((file) => !done.has(versionOf(file)));

    if (pending.length === 0) {
      console.log("No pending migrations.");
    }

    for (const file of pending) {
      const sql = await readFile(path.join(MIGRATIONS_DIR, file), "utf8");
      console.log(`Applying ${file} ...`);
      await client.query("begin");
      try {
        await client.query(sql);
        await client.query(
          "insert into supabase_migrations.schema_migrations (version, name, statements) values ($1, $2, $3)",
          [versionOf(file), nameOf(file), [sql]],
        );
        await client.query("commit");
      } catch (error) {
        await client.query("rollback");
        throw new Error(`Migration failed: ${file}\n${(error as Error).message}`);
      }
    }

    if (runSeed) {
      const seed = await readFile(SEED_FILE, "utf8");
      console.log("Applying supabase/seed.sql ...");
      await client.query(seed);
    }

    console.log(`Applied ${pending.length} migration${pending.length === 1 ? "" : "s"}.`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
