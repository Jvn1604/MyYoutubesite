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
 *   postgres://…        → postgres.js (Supabase *transaction pooler* URL, or the
 *                         local dev server from `npm run db:local`)
 *   pglite:memory       → throwaway in-process database (unit tests)
 *   pglite:./folder     → in-process file database; single process only, so NOT
 *                         for `netlify dev` (each function call is a new thread)
 */
import { requireEnv } from "../config.js";

/**
 * Run one query at a time per connection. postgres.js pipelines concurrent queries
 * (e.g. Promise.all) on its single connection, and Supabase's pooler hangs on
 * pipelined requests, so we queue them instead.
 */
function serial() {
  let tail = Promise.resolve();
  return (run) => {
    const result = tail.then(run);
    tail = result.catch(() => {});
    return result;
  };
}

function wrapPostgres(sql, { closeTimeout = 5 } = {}) {
  const api = (s) => {
    const next = serial();
    return {
      query: (text, params = []) => next(() => s.unsafe(text, params)),
      exec: (text) => next(() => s.unsafe(text)),
    };
  };
  return {
    kind: "postgres",
    ...api(sql),
    transaction: (fn) => sql.begin((tx) => fn(api(tx))),
    close: () => sql.end({ timeout: closeTimeout }),
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
  const local = isLocalDatabase(url);
  return wrapPostgres(postgres(url, {
    ssl: local ? false : "require", // Supabase requires TLS; the local dev server has none
    max: 1,                 // serverless: one connection per function instance (queries queue on it)
    // `netlify dev` runs each request in a fresh worker, so close idle local connections quickly
    idle_timeout: local ? 2 : 20,
    connect_timeout: 10,
    prepare: false,         // required by Supabase's transaction pooler (pgbouncer)
    // int8 (counts, ids) as plain numbers: all our values are far below 2^53 and must be JSON-safe
    types: {
      int8: { to: 20, from: [20], parse: Number, serialize: String },
      // Our queries pass JSON as already-stringified text (same as PGlite expects).
      // postgres.js would JSON.stringify it again → a JSON *string* instead of an object.
      json: { to: 114, from: [114], parse: JSON.parse, serialize: (v) => (typeof v === "string" ? v : JSON.stringify(v)) },
      jsonb: { to: 3802, from: [3802], parse: JSON.parse, serialize: (v) => (typeof v === "string" ? v : JSON.stringify(v)) },
    },
    transform: { undefined: null },
    onnotice: () => {},
  }), { closeTimeout: local ? 0 : 5 }); // local: free the single server slot immediately
}

let shared;
/** One connection pool per warm function instance. */
export async function getDb() {
  shared ??= createDb();
  return shared;
}

/** True for the `npm run db:local` server (or any Postgres on this machine). */
export const isLocalDatabase = (url = process.env.DATABASE_URL ?? "") => /@(localhost|127\.0\.0\.1)(:\d+)?\//.test(url);

/**
 * Run `fn(db)` with a connection suited to the environment:
 * - production: the shared warm pool
 * - local dev server: a short-lived connection closed right after, because the
 *   local PGlite server serves one connection at a time (others queue)
 */
export async function withDb(fn) {
  if (!isLocalDatabase()) return fn(await getDb());
  // The local server rejects a connection while another is active: wait and retry
  for (let attempt = 1; ; attempt++) {
    const db = await createDb();
    try {
      return await fn(db);
    } catch (err) {
      const refused = ["ECONNRESET", "ECONNREFUSED", "CONNECTION_CLOSED", "CONNECTION_ENDED", "EPIPE"].includes(err.code);
      if (!refused || attempt >= 40) throw err;
      await new Promise((r) => setTimeout(r, 50 + Math.random() * 100 * Math.min(attempt, 5)));
    } finally {
      await db.close().catch(() => {});
    }
  }
}
