import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { Client } from "pg";

export const DEFAULT_DB_URL =
  process.env.SUPABASE_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:5433/postgres";

export async function connect(url = DEFAULT_DB_URL, database?: string): Promise<Client> {
  const client = new Client({ connectionString: database ? withDatabase(url, database) : url });
  await client.connect();
  return client;
}

export function withDatabase(url: string, database: string): string {
  const parsed = new URL(url);
  parsed.pathname = `/${database}`;
  return parsed.toString();
}

export function databaseName(url = DEFAULT_DB_URL): string {
  return new URL(url).pathname.replace(/^\//, "") || "postgres";
}

/**
 * Minimal Supabase-compatible bootstrap for a plain Postgres instance:
 * roles, auth schema and the three auth helpers used by migrations.
 * Never run this against a real Supabase project.
 */
export async function bootstrapLocalAuth(client: Client): Promise<void> {
  await client.query(`
    do $$
    begin
      if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
      if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
      if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
    end $$;

    create schema if not exists auth;

    create table if not exists auth.users (
      id uuid primary key,
      email text unique,
      phone text,
      raw_user_meta_data jsonb not null default '{}'::jsonb,
      role text default 'authenticated',
      created_at timestamptz not null default now(),
      email_confirmed_at timestamptz
    );

    alter table auth.users
      add column if not exists email_confirmed_at timestamptz;
    alter table auth.users
      add column if not exists last_sign_in_at timestamptz;
    alter table auth.users
      add column if not exists banned_until timestamptz;

    create or replace function auth.jwt()
    returns jsonb
    language sql
    stable
    as $$
      select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb;
    $$;

    create or replace function auth.uid()
    returns uuid
    language sql
    stable
    as $$
      select nullif(auth.jwt() ->> 'sub', '')::uuid;
    $$;

    create or replace function auth.email()
    returns text
    language sql
    stable
    as $$
      select nullif(auth.jwt() ->> 'email', '');
    $$;

    create or replace function auth.role()
    returns text
    language sql
    stable
    as $$
      select coalesce(nullif(auth.jwt() ->> 'role', ''), 'anon');
    $$;

    grant usage on schema auth to anon, authenticated, service_role;
    grant execute on function auth.jwt(), auth.uid(), auth.email(), auth.role()
      to anon, authenticated, service_role;

    create schema if not exists storage;

    create table if not exists storage.buckets (
      id text primary key,
      name text not null,
      public boolean not null default false,
      file_size_limit bigint,
      allowed_mime_types text[]
    );

    create table if not exists storage.objects (
      id uuid primary key default gen_random_uuid(),
      bucket_id text not null references storage.buckets(id),
      name text not null,
      owner uuid,
      metadata jsonb,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      last_accessed_at timestamptz
    );

    alter table storage.objects enable row level security;

    create or replace function storage.foldername(p_name text)
    returns text[]
    language sql
    immutable
    as $$
      select case
        when position('/' in p_name) = 0 then array[]::text[]
        else string_to_array(regexp_replace(p_name, '/[^/]*$', ''), '/')
      end;
    $$;

    grant usage on schema storage to anon, authenticated, service_role;
    grant select on storage.buckets to authenticated, service_role;
    grant select, insert, update, delete on storage.objects to authenticated, service_role;
  `);
}

export async function applyMigrations(client: Client, directory = "supabase/migrations"): Promise<string[]> {
  const files = (await readdir(directory)).filter((file) => file.endsWith(".sql")).sort();
  for (const file of files) {
    const sql = await readFile(path.join(directory, file), "utf8");
    try {
      await client.query(sql);
    } catch (error) {
      throw new Error(`Migration failed: ${file}\n${(error as Error).message}`);
    }
  }
  return files;
}

export async function recreateDatabase(maintenance: Client, name: string): Promise<void> {
  await maintenance.query(
    `select pg_terminate_backend(pid) from pg_stat_activity where datname = $1 and pid <> pg_backend_pid()`,
    [name],
  );
  await maintenance.query(`drop database if exists "${name}"`);
  await maintenance.query(`create database "${name}"`);
}
