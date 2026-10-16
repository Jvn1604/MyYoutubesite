#!/usr/bin/env node
/**
 * Backup / restore of website-owned content (everything you edit in the admin).
 * YouTube data (videos, channel stats) is NOT included: a sync rebuilds it.
 * Admin accounts are NOT included: recreate with `npm run admin:create`.
 *
 *   npm run backup                          → backups/website-YYYY-MM-DD-HHMM.json
 *   npm run restore -- backups/file.json    (replaces website content in DATABASE_URL)
 *
 * Uploaded image FILES live in Supabase Storage; download them separately (see README → Backups).
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { createDb } from "../server/db/client.js";
import { exportWebsite, restoreWebsite, BACKUP_TABLES } from "../server/db/backup.js";

const [command = "export", file] = process.argv.slice(2);
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set (see .env.example).");
  process.exit(1);
}
const db = await createDb();

try {
  if (command === "export") {
    const data = await exportWebsite(db);
    const out = file ?? `backups/website-${data.createdAt.slice(0, 16).replace("T", "-").replace(":", "")}.json`;
    await mkdir(dirname(out), { recursive: true });
    await writeFile(out, JSON.stringify(data, null, 2));
    console.log(`✓ Backup written to ${out}`);
    BACKUP_TABLES.forEach((t) => console.log(`  ${t.padEnd(18)} ${data.tables[t].length} rows`));
  } else if (command === "restore") {
    if (!file) throw new Error("Usage: npm run restore -- backups/website-….json");
    const data = JSON.parse(await readFile(file, "utf8"));
    const { skippedOverrides } = await restoreWebsite(db, data);
    console.log(`✓ Restored website content from ${file} (backup from ${data.createdAt})`);
    if (skippedOverrides) console.log(`  ${skippedOverrides} video setting(s) skipped: those videos aren't synced yet. Run \`npm run sync -- all\`, then restore again.`);
  } else {
    throw new Error(`Unknown command "${command}" (use export or restore)`);
  }
} catch (err) {
  console.error(`✗ ${err.message}`);
  process.exitCode = 1;
} finally {
  await db.close();
}
