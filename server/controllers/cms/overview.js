import { status as youtubeStatus } from "./youtube.js";
import { resolveNextStream } from "../../../src/js/core/time.js";

/** Dashboard home: everything in one round-trip. */
export async function get({ db }) {
  const [channel] = await db.query(`select title, subscriber_count as "subscriberCount", subscribers_hidden as "subscribersHidden",
    view_count as "viewCount", video_count as "videoCount", synced_at as "syncedAt" from channel_stats where id = 1`);
  const [counts] = await db.query(`select
      count(*) filter (where is_available and kind = 'stream')::int as streams,
      count(*) filter (where is_available and kind = 'video')::int as videos,
      count(*) filter (where is_available and kind = 'short')::int as shorts,
      count(*) filter (where live_state = 'live' and is_available)::int as "liveNow"
    from videos`);
  const recent = await db.query(`select v.youtube_id as id, v.title, v.kind, v.live_state as "liveState", v.published_at as "publishedAt",
      v.view_count as views, v.thumbnails, coalesce(o.hidden, false) as hidden, coalesce(o.featured, false) as featured
    from videos v left join video_overrides o using (youtube_id) where v.is_available order by v.published_at desc limit 6`);
  const [goal] = await db.query(`select title, start_value as "startValue", goal_value as "goalValue", to_char(deadline, 'YYYY-MM-DD') as deadline
    from subscriber_goals where enabled limit 1`);
  const [settings] = await db.query("select value from site_settings where key = 'schedule'");
  const rules = await db.query("select weekday, to_char(start_time, 'HH24:MI') as time, title, enabled from schedule_rules where enabled");
  const events = await db.query("select starts_at as \"startsAt\", title, description from schedule_events where enabled and starts_at > now()");
  const [upcoming] = await db.query(`select youtube_id as id, title, scheduled_start as "scheduledStart" from videos
    where is_available and live_state = 'upcoming' and scheduled_start > now() - interval '2 hours' order by scheduled_start limit 1`);
  const next = resolveNextStream({ upcomingVideo: upcoming, events, rules, timeZone: settings?.value?.timezone ?? "Asia/Kuala_Lumpur" });
  const snapshots = await db.query(`select to_char(day, 'YYYY-MM-DD') as day, subscriber_count as subscribers
    from analytics_snapshots where day >= current_date - 90 order by day`);

  return {
    channel: channel ?? null,
    counts,
    latestUpload: recent.find((v) => v.kind === "video") ?? null,
    recent,
    goal: goal ? { ...goal, current: channel && !channel.subscribersHidden ? channel.subscriberCount : null } : null,
    nextStream: next ? { source: next.source, startsAt: next.startsAt.toISOString(), title: next.title ?? "" } : null,
    youtube: await youtubeStatus({ db }),
    snapshots,
  };
}
