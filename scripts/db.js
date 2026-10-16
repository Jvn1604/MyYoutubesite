#!/usr/bin/env node
/**
 * Database CLI.
 *   npm run db:migrate   apply pending migrations
 *   npm run db:seed      insert initial website content (idempotent)
 *   npm run db:setup     migrate + seed
 *   npm run db:status    list applied / pending migrations
 * Uses DATABASE_URL from .env (e.g. pglite:./.data/db locally, Supabase in production).
 */
import { createDb } from "../server/db/client.js";
import { migrate, listMigrations } from "../server/db/migrate.js";
import { seed } from "../server/db/seed.js";

const command = process.argv[2];
const COMMANDS = ["migrate", "seed", "setup", "status"];

if (!COMMANDS.includes(command)) {
  console.error(`Usage: node scripts/db.js <${COMMANDS.join("|")}>`);
  process.exit(1);
}

const redact = (url) => url.replace(/\/\/([^:]+):[^@]+@/, "//$1:****@");
const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set. Copy .env.example to .env and fill it in (pglite:./.data/db works for local dev).");
  process.exit(1);
}

const db = await createDb(url);
try {
  console.log(`Database: ${redact(url)}`);
  if (command === "status") {
    const applied = new Set(
      (await db.query("select version from schema_migrations").catch(() => [])).map((r) => r.version)
    );
    for (const m of await listMigrations()) console.log(`${applied.has(m.version) ? "✓ applied" : "• pending"}  ${m.file}`);
  }
  if (command === "migrate" || command === "setup") {
    const applied = await migrate(db, { log: (m) => console.log(`  ${m}`) });
    console.log(applied.length ? `Applied ${applied.length} migration(s).` : "No pending migrations.");
  }
  if (command === "seed" || command === "setup") {
    const inserted = await seed(db);
    console.log("Seeded:", Object.entries(inserted).map(([k, v]) => `${k}=${v}`).join(", "));
  }
} catch (err) {
  console.error(`✗ ${err.message}`);
  process.exitCode = 1;
} finally {
  await db.close();
}
