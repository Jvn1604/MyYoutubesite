/**
 * Writes for YouTube-owned tables (videos, channel_stats, analytics_snapshots, sync logs).
 * These functions only ever touch YouTube-owned columns, so website overrides
 * (video_overrides, games, settings…) can never be erased by a sync.
 */

const VIDEO_COLUMNS = [
  ["youtube_id", "youtubeId"], ["title", "title"], ["description", "description"], ["published_at", "publishedAt"],
  ["duration_seconds", "durationSeconds"], ["thumbnails", "thumbnails", "jsonb"], ["kind", "kind"], ["live_state", "liveState"],
  ["scheduled_start", "scheduledStart"], ["actual_start", "actualStart"], ["actual_end", "actualEnd"],
  ["concurrent_viewers", "concurrentViewers"], ["view_count", "viewCount"], ["like_count", "likeCount"],
  ["comment_count", "commentCount"], ["is_available", "isAvailable"],
];

/**
 * Insert or update videos. Returns { inserted: [ids], updated: n }.
 * A row counts as "changed" only if a meaningful field differs (keeps logs honest).
 */
const COLUMN_TYPES = {
  youtube_id: "text", title: "text", description: "text", published_at: "timestamptz", duration_seconds: "integer",
  thumbnails: "jsonb", kind: "text", live_state: "text", scheduled_start: "timestamptz", actual_start: "timestamptz",
  actual_end: "timestamptz", concurrent_viewers: "integer", view_count: "bigint", like_count: "bigint",
  comment_count: "bigint", is_available: "boolean",
};
const BATCH = 100;

export async function upsertVideos(db, rows) {
  if (!rows.length) return { inserted: [], changed: 0 };
  const cols = VIDEO_COLUMNS.map(([c]) => c);
  const updates = cols.filter((c) => c !== "youtube_id").map((c) => `${c} = excluded.${c}`).join(", ");
  const recordType = cols.map((c) => `${c} ${COLUMN_TYPES[c]}`).join(", ");
  const inserted = [];
  let changed = 0;

  // One statement per 100 rows (json_to_recordset) instead of a round-trip per video
  await db.transaction(async (tx) => {
    for (let i = 0; i < rows.length; i += BATCH) {
      const payload = rows.slice(i, i + BATCH).map((row) => Object.fromEntries(VIDEO_COLUMNS.map(([col, key]) => [col, row[key] ?? null])));
      const result = await tx.query(
        `insert into videos (${cols.join(", ")}, synced_at)
         select ${cols.join(", ")}, now() from json_to_recordset($1::json) as r(${recordType})
         on conflict (youtube_id) do update set ${updates}, synced_at = now()
         where (videos.title, videos.live_state, videos.view_count, videos.concurrent_viewers, videos.is_available, videos.kind, videos.actual_end)
           is distinct from (excluded.title, excluded.live_state, excluded.view_count, excluded.concurrent_viewers, excluded.is_available, excluded.kind, excluded.actual_end)
         returning youtube_id, (xmax = 0) as inserted`,
        [JSON.stringify(payload)]
      );
      changed += result.length; // unchanged rows are filtered out by the WHERE above
      result.forEach((r) => r.inserted && inserted.push(r.youtube_id));
    }
  });
  return { inserted, changed };
}

/** Mark videos unavailable (deleted/private on YouTube). Never deletes: overrides survive a re-publish. */
export async function markUnavailable(db, ids) {
  if (!ids.length) return 0;
  const rows = await db.query(
    "update videos set is_available = false, live_state = case when live_state in ('live','upcoming') then 'ended' else live_state end, synced_at = now() where youtube_id = any($1::text[]) and is_available returning youtube_id",
    [ids]
  );
  return rows.length;
}

export async function knownVideoIds(db, { onlyAvailable = true } = {}) {
  const rows = await db.query(`select youtube_id from videos ${onlyAvailable ? "where is_available" : ""}`);
  return rows.map((r) => r.youtube_id);
}

/** Videos currently marked live/upcoming: must be re-checked even if they fell off the first playlist page. */
export async function activeBroadcastIds(db) {
  const rows = await db.query("select youtube_id from videos where is_available and live_state in ('live', 'upcoming')");
  return rows.map((r) => r.youtube_id);
}

/**
 * Auto-assign games for videos without a locked choice. Only fills empty slots:
 * it never replaces a game the admin picked (game_locked) or one already set.
 */
export async function assignGames(db, assignments) {
  let n = 0;
  for (const { youtubeId, gameId } of assignments) {
    const rows = await db.query(
      `insert into video_overrides (youtube_id, game_id) values ($1, $2)
       on conflict (youtube_id) do update set game_id = excluded.game_id
       where video_overrides.game_id is null and not video_overrides.game_locked
       returning youtube_id`,
      [youtubeId, gameId]
    );
    n += rows.length;
  }
  return n;
}

export async function gamesForMatching(db) {
  return db.query("select id, slug, title_keywords as keywords from games");
}

export async function videosWithoutGame(db, ids) {
  if (!ids.length) return [];
  return db.query(
    `select v.youtube_id, v.title from videos v left join video_overrides o using (youtube_id)
     where v.youtube_id = any($1::text[]) and (o.youtube_id is null or (o.game_id is null and not o.game_locked))`,
    [ids]
  );
}

export async function upsertChannel(db, c) {
  await db.query(
    `insert into channel_stats (id, channel_id, title, description, subscriber_count, subscribers_hidden, view_count, video_count, avatar_url, banner_url, synced_at)
     values (1, $1, $2, $3, $4, $5, $6, $7, $8, $9, now())
     on conflict (id) do update set channel_id = excluded.channel_id, title = excluded.title, description = excluded.description,
       subscriber_count = excluded.subscriber_count, subscribers_hidden = excluded.subscribers_hidden, view_count = excluded.view_count,
       video_count = excluded.video_count, avatar_url = excluded.avatar_url, banner_url = excluded.banner_url, synced_at = now()`,
    [c.channelId, c.title, c.description, c.subscriberCount, c.subscribersHidden, c.viewCount, c.videoCount, c.avatarUrl, c.bannerUrl]
  );
}

/** One row per day (latest values win) → powers the admin growth chart. */
export async function snapshotDay(db, day) {
  await db.query(
    `insert into analytics_snapshots (day, subscriber_count, view_count, video_count, stream_count)
     select $1::date, c.subscriber_count, c.view_count, c.video_count,
            (select count(*) from videos where kind = 'stream' and is_available)
     from channel_stats c where c.id = 1
     on conflict (day) do update set subscriber_count = excluded.subscriber_count, view_count = excluded.view_count,
       video_count = excluded.video_count, stream_count = excluded.stream_count`,
    [day]
  );
}

/** Mark the active goal achieved the first time the subscriber count reaches it. */
export async function markGoalAchieved(db) {
  await db.query(
    `update subscriber_goals g set achieved_at = now()
     from channel_stats c
     where g.enabled and g.achieved_at is null and c.id = 1 and not c.subscribers_hidden and c.subscriber_count >= g.goal_value`
  );
}

// ---------------------------------------------------------------- sync log

export async function startSyncLog(db, job) {
  const [row] = await db.query("insert into youtube_sync_logs (job) values ($1) returning id", [job]);
  return row.id;
}

export async function finishSyncLog(db, id, { ok, unitsUsed = 0, itemsChanged = 0, error = null }) {
  await db.query(
    "update youtube_sync_logs set finished_at = now(), ok = $2, units_used = $3, items_changed = $4, error = $5 where id = $1",
    [id, ok, unitsUsed, itemsChanged, error ? String(error).slice(0, 2000) : null]
  );
}

/** True if the same job started recently and hasn't finished (prevents overlapping runs). */
export async function jobRunning(db, job, staleAfterSeconds = 300) {
  const rows = await db.query(
    "select 1 from youtube_sync_logs where job = $1 and finished_at is null and started_at > now() - make_interval(secs => $2) limit 1",
    [job, staleAfterSeconds]
  );
  return rows.length > 0;
}
