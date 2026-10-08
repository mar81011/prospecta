// Runs the real migrations in PGlite (in-process Postgres) with minimal stand-ins
// for the Supabase-managed `auth` and `storage` schemas, so RLS and billing
// functions can be tested without Docker. `supabase test db` against a real
// local stack remains the final check.

import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

const SUPABASE_STUB = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;

  grant usage on schema public to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;

  create schema auth;
  grant usage on schema auth to anon, authenticated, service_role;
  create table auth.users (
    id uuid primary key,
    email text,
    raw_user_meta_data jsonb not null default '{}'::jsonb
  );
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  grant execute on function auth.uid() to anon, authenticated, service_role;

  create schema storage;
  grant usage on schema storage to anon, authenticated, service_role;
  create table storage.buckets (
    id text primary key, name text not null, public boolean default false,
    file_size_limit bigint, allowed_mime_types text[]
  );
  create table storage.objects (
    id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets (id), name text not null
  );
  alter table storage.objects enable row level security;
  grant select, insert, update, delete on storage.objects to authenticated, service_role;
  create function storage.foldername(name text) returns text[] language sql immutable as $$
    select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1]
  $$;
  grant execute on function storage.foldername(text) to anon, authenticated, service_role;
`;

export type Db = {
  pg: PGlite;
  /** Run SQL as an authenticated user (RLS applies). */
  as<T = Record<string, unknown>>(userId: string, sql: string, params?: unknown[]): Promise<T[]>;
  /** Run SQL as an anonymous visitor (anon role, no user). */
  anon<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
  /** Run SQL as the service role (RLS bypassed, grants still apply). */
  service<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
  /** Run SQL as the database owner (test setup only). */
  root<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
  createUser(opts?: { email?: string; name?: string; admin?: boolean }): Promise<string>;
};

export async function createDb(): Promise<Db> {
  const pg = new PGlite();
  await pg.exec(SUPABASE_STUB);

  const dir = path.resolve(__dirname, "../../supabase/migrations");
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    try {
      await pg.exec(readFileSync(path.join(dir, file), "utf8"));
    } catch (e) {
      throw new Error(`Migration ${file} failed: ${(e as Error).message}`);
    }
  }

  async function run<T>(role: string | null, sub: string | null, sql: string, params: unknown[] = []) {
    await pg.exec(`reset role; select set_config('request.jwt.claim.sub', '${sub ?? ""}', false);`);
    if (role) await pg.exec(`set role ${role};`);
    try {
      const res = await pg.query<T>(sql, params);
      return res.rows;
    } finally {
      await pg.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`);
    }
  }

  const db: Db = {
    pg,
    as: (userId, sql, params) => run(`authenticated`, userId, sql, params),
    anon: (sql, params) => run(`anon`, null, sql, params),
    service: (sql, params) => run(`service_role`, null, sql, params),
    root: (sql, params) => run(null, null, sql, params),
    async createUser(opts = {}) {
      const id = randomUUID();
      await run(null, null, `insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)`, [
        id,
        opts.email ?? `${id.slice(0, 8)}@example.com`,
        JSON.stringify({ name: opts.name ?? "Test Agent" }),
      ]);
      if (opts.admin) await run(null, null, `update public.profiles set role = 'admin' where id = $1`, [id]);
      return id;
    },
  };
  return db;
}
