/**
 * Forward-only SQL migrations. Files in ./migrations named NNN_description.sql
 * run once each, in order, each inside its own transaction.
 */
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const MIGRATIONS_DIR = join(import.meta.dirname, "migrations");

export async function listMigrations(dir = MIGRATIONS_DIR) {
  const files = (await readdir(dir)).filter((f) => /^\d{3}_[a-z0-9_]+\.sql$/.test(f)).sort();
  return Promise.all(files.map(async (file) => ({ version: file.slice(0, 3), file, sql: await readFile(join(dir, file), "utf8") })));
}

export async function migrate(db, { log = () => {}, dir } = {}) {
  await db.exec(`create table if not exists schema_migrations (
    version text primary key,
    file text not null,
    applied_at timestamptz not null default now()
  )`);
  const done = new Set((await db.query("select version from schema_migrations")).map((r) => r.version));
  const pending = (await listMigrations(dir)).filter((m) => !done.has(m.version));

  for (const m of pending) {
    log(`applying ${m.file}`);
    await db.transaction(async (tx) => {
      await tx.exec(m.sql);
      await tx.query("insert into schema_migrations (version, file) values ($1, $2)", [m.version, m.file]);
    });
  }
  return pending.map((m) => m.file);
}
