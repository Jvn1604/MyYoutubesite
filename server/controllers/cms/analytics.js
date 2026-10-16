/** Channel growth (daily snapshots) + website click events. */
export async function get({ db, query }) {
  const days = Math.min(365, Math.max(7, Number(query.get("days")) || 90));
  const snapshots = await db.query(
    `select to_char(day, 'YYYY-MM-DD') as day, subscriber_count as subscribers, view_count as views, video_count as videos, stream_count as streams
     from analytics_snapshots where day >= current_date - $1::int order by day`,
    [days]
  );
  const events = await db.query(
    `select event, count(*)::int as count from site_events where created_at >= now() - make_interval(days => $1)
     group by event order by count desc limit 30`,
    [Math.min(days, 90)]
  );
  const topTargets = await db.query(
    `select event, target, count(*)::int as count from site_events
     where created_at >= now() - interval '30 days' and target is not null
     group by event, target order by count desc limit 10`
  );
  // Keep the events table small: raw clicks older than 180 days are dropped
  await db.query("delete from site_events where created_at < now() - interval '180 days'");
  return { days, snapshots, events, topTargets };
}
