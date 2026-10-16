/**
 * YouTube → database synchronisation.
 *
 *   live     every 2 min   newest 10 uploads + anything currently live/upcoming   ~2 units
 *   stats    every 15 min  channel statistics, daily snapshot, goal achievement   1 unit
 *   library  every 6 h     the whole uploads playlist; detects deletions          ~20 units
 *   manual   admin button  stats + library
 *
 * Every run is logged to youtube_sync_logs. On any failure the database keeps
 * the last good data, so the public site keeps working.
 */
import { normalizeVideo, normalizeChannel } from "./classify.js";
import { matchGame } from "./game-match.js";
import { uploadsPlaylistFor } from "./youtube.js";
import * as repo from "../repositories/youtube-data.js";

export const JOBS = ["live", "stats", "library", "manual"];
const LIVE_PAGE_SIZE = 10;

async function storeVideos(db, yt, ids, now) {
  const items = await yt.getVideos(ids);
  const rows = items.map((item) => normalizeVideo(item, now));
  const result = await repo.upsertVideos(db, rows);

  // Requested ids that YouTube no longer returns were deleted or made private
  const returned = new Set(items.map((i) => i.id));
  const missing = ids.filter((id) => !returned.has(id));
  const unavailable = await repo.markUnavailable(db, missing);

  // Auto-assign games to videos that don't have one yet
  const games = await repo.gamesForMatching(db);
  const candidates = await repo.videosWithoutGame(db, rows.map((r) => r.youtubeId));
  const assignments = candidates
    .map((v) => ({ youtubeId: v.youtube_id, gameId: matchGame(v.title, games) }))
    .filter((a) => a.gameId);
  const assigned = await repo.assignGames(db, assignments);

  return { changed: result.changed + unavailable, inserted: result.inserted, assigned };
}

async function syncLive(db, yt, channelId, now) {
  const playlistId = uploadsPlaylistFor(channelId);
  const { ids } = await yt.listPlaylistPage(playlistId, { maxResults: LIVE_PAGE_SIZE });
  const active = await repo.activeBroadcastIds(db);
  return storeVideos(db, yt, [...new Set([...ids, ...active])], now);
}

async function syncStats(db, yt, channelId, now) {
  const raw = await yt.getChannel(channelId);
  if (!raw) throw new Error(`Channel ${channelId} not found. Check YOUTUBE_CHANNEL_ID.`);
  await repo.upsertChannel(db, normalizeChannel(raw));
  await repo.snapshotDay(db, now.toISOString().slice(0, 10));
  await repo.markGoalAchieved(db);
  return { changed: 1, inserted: [], assigned: 0 };
}

async function syncLibrary(db, yt, channelId, now) {
  const ids = await yt.listAllPlaylistIds(uploadsPlaylistFor(channelId));
  const result = await storeVideos(db, yt, ids, now);
  // Anything we know that is no longer in the uploads playlist was removed
  const listed = new Set(ids);
  const gone = (await repo.knownVideoIds(db)).filter((id) => !listed.has(id));
  // Safety: a suspiciously empty playlist response must not wipe the library
  const removed = ids.length > 0 ? await repo.markUnavailable(db, gone) : 0;
  return { ...result, changed: result.changed + removed };
}

/**
 * Run one sync job. Never throws: returns { ok, skipped?, unitsUsed, itemsChanged, inserted, error }.
 * `yt` is a client from createYouTubeClient (or a fake in tests).
 */
export async function runSync(db, yt, { job, channelId, now = new Date() }) {
  if (!JOBS.includes(job)) throw new Error(`Unknown sync job: ${job}`);
  if (await repo.jobRunning(db, job)) return { ok: true, skipped: true, unitsUsed: 0, itemsChanged: 0, inserted: [] };

  const logId = await repo.startSyncLog(db, job);
  const startUnits = yt.unitsUsed;
  try {
    let result;
    if (job === "live") result = await syncLive(db, yt, channelId, now);
    else if (job === "stats") result = await syncStats(db, yt, channelId, now);
    else if (job === "library") result = await syncLibrary(db, yt, channelId, now);
    else {
      const stats = await syncStats(db, yt, channelId, now);
      const library = await syncLibrary(db, yt, channelId, now);
      result = { changed: stats.changed + library.changed, inserted: library.inserted, assigned: library.assigned };
    }
    const summary = { ok: true, unitsUsed: yt.unitsUsed - startUnits, itemsChanged: result.changed, inserted: result.inserted, assigned: result.assigned };
    await repo.finishSyncLog(db, logId, summary);
    return summary;
  } catch (err) {
    const summary = { ok: false, unitsUsed: yt.unitsUsed - startUnits, itemsChanged: 0, inserted: [], error: err.message, reason: err.reason };
    await repo.finishSyncLog(db, logId, summary).catch(() => {});
    return summary;
  }
}
