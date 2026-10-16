/** Wires env config → DB + YouTube client → runSync. Shared by scheduled functions, the CLI and the admin "Sync now". */
import { env, requireEnv } from "../config.js";
import { withDb } from "../db/client.js";
import { createYouTubeClient } from "./youtube.js";
import { runSync } from "./sync.js";

export async function runConfiguredSync(job, { db } = {}) {
  const yt = createYouTubeClient({ apiKey: requireEnv("YOUTUBE_API_KEY") });
  const run = (database) => runSync(database, yt, { job, channelId: env("YOUTUBE_CHANNEL_ID") });
  return db ? run(db) : withDb(run);
}

/** Handler factory for Netlify scheduled functions. Logs a one-line summary; never throws. */
export function scheduledSync(job) {
  return async () => {
    try {
      const r = await runConfiguredSync(job);
      const line = r.skipped ? "skipped (previous run still active)" : r.ok
        ? `ok · ${r.itemsChanged} changed · ${r.unitsUsed} units${r.inserted?.length ? ` · new: ${r.inserted.join(",")}` : ""}`
        : `FAILED · ${r.error}`;
      console.log(`[sync:${job}] ${line}`);
    } catch (err) {
      // Config errors (missing key / DB URL) land here
      console.error(`[sync:${job}] cannot run: ${err.message}`);
    }
  };
}
