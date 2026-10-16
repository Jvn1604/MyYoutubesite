/**
 * Database access behind one tiny interface so the same code runs on
 * Supabase Postgres (production) and PGlite (in-memory/local Postgres for dev + tests).
 *
 *   db.query(text, params) → rows        parameterised ($1, $2…) only
 *   db.exec(text)                        multi-statement SQL (migrations)
 *   db.transaction(async (tx) => …)      tx has query/exec
 *   db.close()
 *
 * DATABASE_URL:
 *   postgres://…        → postgres.js (use Supabase's *transaction pooler* URL)
 *   pglite:memory       → throwaway in-memory database
 *   pglite:./.data/db   → persistent local database folder
 */
import { requireEnv } from "../config.js";

function wrapPostgres(sql) {
  const api = (s) => ({
    query: (text, params = []) => s.unsafe(text, params),
    exec: (text) => s.unsafe(text),
  });
  return {
    kind: "postgres",
    ...api(sql),
    transaction: (fn) => sql.begin((tx) => fn(api(tx))),
    close: () => sql.end({ timeout: 5 }),
  };
}

function wrapPglite(pg) {
  const api = (s) => ({
    query: async (text, params = []) => (await s.query(text, params)).rows,
    exec: (text) => s.exec(text),
  });
  return {
    kind: "pglite",
    ...api(pg),
    transaction: (fn) => pg.transaction((tx) => fn(api(tx))),
    close: () => pg.close(),
  };
}

export async function createDb(url = requireEnv("DATABASE_URL")) {
  if (url.startsWith("pglite:")) {
    const { PGlite } = await import("@electric-sql/pglite");
    const target = url.slice("pglite:".length);
    const options = { parsers: { 20: Number } }; // int8 → number, same as the postgres adapter
    if (target === "memory") return wrapPglite(new PGlite(options));
    const { mkdir } = await import("node:fs/promises");
    await mkdir(target, { recursive: true }); // PGlite won't create parent folders
    return wrapPglite(new PGlite(target, options));
  }
  const { default: postgres } = await import("postgres");
  return wrapPostgres(postgres(url, {
    max: 3,                 // serverless: keep the pool tiny
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false,         // required by Supabase's transaction pooler (pgbouncer)
    // int8 (counts, ids) as plain numbers: all our values are far below 2^53 and must be JSON-safe
    types: { int8: { to: 20, from: [20], parse: Number, serialize: String } },
    transform: { undefined: null },
    onnotice: () => {},
  }));
}

let shared;
/** One connection pool per warm function instance. */
export async function getDb() {
  shared ??= createDb();
  return shared;
}
