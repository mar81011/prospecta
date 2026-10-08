// Applies pending supabase/migrations/*.sql to a hosted Supabase project via the
// Management API, recording each in supabase_migrations.schema_migrations (the
// same table the Supabase CLI uses). Each migration runs in one transaction.
//
// Usage (in your own terminal, so the token never leaves your machine):
//   PowerShell:  $env:SUPABASE_ACCESS_TOKEN="sbp_..."; npm run db:apply
//   bash:        SUPABASE_ACCESS_TOKEN=sbp_... npm run db:apply
// Optional: SUPABASE_PROJECT_REF (defaults to the ref in NEXT_PUBLIC_SUPABASE_URL), --dry-run

import { readdirSync, readFileSync, existsSync } from "node:fs";
import path from "node:path";

const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!token) {
  console.error("Set SUPABASE_ACCESS_TOKEN (create one at https://supabase.com/dashboard/account/tokens).");
  process.exit(1);
}

function refFromEnvFile() {
  for (const file of [".env.local", ".env"]) {
    if (!existsSync(file)) continue;
    const m = readFileSync(file, "utf8").match(/NEXT_PUBLIC_SUPABASE_URL=https:\/\/([a-z0-9]+)\.supabase\.co/);
    if (m) return m[1];
  }
  return null;
}

const ref = process.env.SUPABASE_PROJECT_REF ?? refFromEnvFile();
if (!ref) {
  console.error("Could not find the project ref. Set SUPABASE_PROJECT_REF.");
  process.exit(1);
}
const dryRun = process.argv.includes("--dry-run");

async function query(sql) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ query: sql }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status}: ${text}`);
  return JSON.parse(text);
}

const dollar = (s) => {
  let tag = "$m$";
  for (let i = 0; s.includes(tag); i++) tag = `$m${i}$`;
  return `${tag}${s}${tag}`;
};

await query(
  "create schema if not exists supabase_migrations; create table if not exists supabase_migrations.schema_migrations (version text primary key, statements text[], name text);",
);
const applied = new Set((await query("select version from supabase_migrations.schema_migrations")).map((r) => r.version));

const dir = "supabase/migrations";
const pending = readdirSync(dir)
  .filter((f) => f.endsWith(".sql"))
  .sort()
  .filter((f) => !applied.has(f.split("_")[0]));

console.log(`Project ${ref}: ${applied.size} applied, ${pending.length} pending.`);
for (const file of pending) {
  const [version, ...rest] = file.replace(/\.sql$/, "").split("_");
  if (dryRun) {
    console.log(`would apply ${file}`);
    continue;
  }
  const sql = readFileSync(path.join(dir, file), "utf8");
  await query(
    `begin;\n${sql}\n;insert into supabase_migrations.schema_migrations (version, name, statements) values (${dollar(version)}, ${dollar(rest.join("_"))}, array[${dollar(sql)}]);\ncommit;`,
  );
  console.log(`applied ${file}`);
}
console.log("Done.");
