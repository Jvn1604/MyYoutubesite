import { HttpError } from "../../middleware/http.js";
import { readJson } from "../../middleware/auth.js";
import { syncRequestSchema, parseOrThrow } from "../../validation/schemas.js";
import { env, configStatus } from "../../config.js";
import { runConfiguredSync } from "../../services/sync-runner.js";

const DAILY_QUOTA = 10_000;

export async function status({ db }) {
  const lastByJob = await db.query(`
    select distinct on (job) job, started_at as "startedAt", finished_at as "finishedAt", ok, units_used as "unitsUsed",
           items_changed as "itemsChanged", error
    from youtube_sync_logs order by job, started_at desc`);
  const lastSuccess = await db.query(`select max(finished_at) as at from youtube_sync_logs where ok`);
  const recent = await db.query(`
    select id, job, started_at as "startedAt", finished_at as "finishedAt", ok, units_used as "unitsUsed", items_changed as "itemsChanged", error
    from youtube_sync_logs order by started_at desc limit 25`);
  // YouTube quota resets at midnight Pacific time
  const [quota] = await db.query(`
    select coalesce(sum(units_used), 0)::int as used from youtube_sync_logs
    where started_at >= (date_trunc('day', now() at time zone 'America/Los_Angeles') at time zone 'America/Los_Angeles')`);
  const [channel] = await db.query(`select title, synced_at as "syncedAt" from channel_stats where id = 1`);
  const [counts] = await db.query(`select count(*)::int as total, count(*) filter (where is_available)::int as available from videos`);

  const lastErrors = lastByJob.filter((j) => j.ok === false);
  return {
    channelId: env("YOUTUBE_CHANNEL_ID"),
    channelTitle: channel?.title ?? null,
    apiKeyConfigured: configStatus().youtube,
    health: !configStatus().youtube ? "not_configured" : lastErrors.length ? "error" : lastByJob.length ? "ok" : "never_synced",
    lastSuccessAt: lastSuccess[0]?.at ?? null,
    jobs: lastByJob,
    recent,
    quota: { used: quota.used, limit: DAILY_QUOTA },
    videos: counts,
  };
}

/**
 * Manual sync from the dashboard. "manual" = stats + full library (can take several seconds).
 * Scheduled syncs keep running regardless; this is only for troubleshooting / instant refresh.
 */
export async function sync({ req, db }) {
  const { job } = parseOrThrow(syncRequestSchema, await readJson(req), HttpError);
  if (!configStatus().youtube) throw new HttpError(409, "Add YOUTUBE_API_KEY to the environment first");
  const result = await runConfiguredSync(job, { db });
  return { ...result, status: await status({ db }) };
}
