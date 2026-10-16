#!/usr/bin/env node
/**
 * Manual YouTube sync from the terminal.
 *   npm run sync -- live | stats | library | all
 *   npm run sync -- demo      load the bundled sample videos (no API key needed; dev only)
 */
import { createDb } from "../server/db/client.js";
import { runConfiguredSync } from "../server/services/sync-runner.js";
import { upsertVideos, upsertChannel, assignGames, gamesForMatching } from "../server/repositories/youtube-data.js";
import { matchGame } from "../server/services/game-match.js";

const arg = process.argv[2] ?? "all";
const VALID = ["live", "stats", "library", "all", "demo"];
if (!VALID.includes(arg)) {
  console.error(`Usage: npm run sync -- <${VALID.join("|")}>`);
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set (see .env.example).");
  process.exit(1);
}

const db = await createDb();

async function loadDemo() {
  const { channel, videos } = await import("../server/fixtures/dev-data.js");
  await upsertChannel(db, { channelId: process.env.YOUTUBE_CHANNEL_ID ?? "UC6REYc9lkrj8Em4kjCYsG7A", description: "", ...channel });
  const rows = videos.map((v) => ({
    youtubeId: v.id, title: v.title, description: v.description, publishedAt: v.publishedAt, durationSeconds: v.durationSeconds,
    thumbnails: {}, kind: v.kind, liveState: v.liveState, scheduledStart: v.scheduledStart, actualStart: v.actualStart, actualEnd: null,
    concurrentViewers: v.concurrentViewers, viewCount: v.views, likeCount: v.likes, commentCount: v.comments, isAvailable: true,
  }));
  const { changed } = await upsertVideos(db, rows);
  const games = await gamesForMatching(db);
  const assigned = await assignGames(db, rows.map((r) => ({ youtubeId: r.youtubeId, gameId: matchGame(r.title, games) })).filter((a) => a.gameId));
  console.log(`Demo data loaded: channel + ${changed} videos changed, ${assigned} game assignments.`);
}

try {
  if (arg === "demo") {
    await loadDemo();
  } else {
    for (const job of arg === "all" ? ["stats", "library"] : [arg]) {
      const r = await runConfiguredSync(job, { db });
      if (r.skipped) console.log(`${job}: skipped (another run is in progress)`);
      else if (r.ok) console.log(`${job}: ok · ${r.itemsChanged} changed · ${r.inserted.length} new · ${r.assigned ?? 0} games assigned · ${r.unitsUsed} quota units`);
      else { console.error(`${job}: FAILED · ${r.error}`); process.exitCode = 1; }
    }
  }
} catch (err) {
  console.error(`✗ ${err.message}`);
  process.exitCode = 1;
} finally {
  await db.close();
}
