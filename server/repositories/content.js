/**
 * Reads everything the public API needs, in the shape site-payload.js expects
 * (the same shape as the dev fixture). YouTube data is merged with website
 * overrides here; the payload builder applies visibility rules.
 */

const iso = (d) => (d ? new Date(d).toISOString() : null);

export async function loadSettings(db) {
  const rows = await db.query("select key, value from site_settings");
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

export async function loadContentFromDb(db) {
  const [settings, channelRows, videoRows, gameRows, ruleRows, eventRows, goalRows, socialRows] = await Promise.all([
    loadSettings(db),
    db.query(`select c.*, (select count(*) from videos where kind = 'stream' and is_available) as stream_count
              from channel_stats c where c.id = 1`),
    db.query(`select v.*, o.hidden, o.featured, o.kind_override, o.custom_description, o.priority, g.slug as game_slug
              from videos v
              left join video_overrides o using (youtube_id)
              left join games g on g.id = o.game_id
              where v.is_available
              order by v.published_at desc`),
    db.query(`select g.*, m.path as cover_path from games g left join media m on m.id = g.cover_media_id order by g.sort_order, g.id`),
    db.query("select weekday, to_char(start_time, 'HH24:MI') as time, title, enabled from schedule_rules where enabled order by weekday, start_time"),
    db.query("select starts_at, title, description from schedule_events where enabled and starts_at > now() - interval '3 hours' order by starts_at limit 10"),
    // date → text in SQL: JS Date parsing would shift the day across timezones
    db.query("select *, to_char(deadline, 'YYYY-MM-DD') as deadline_text from subscriber_goals where enabled limit 1"),
    db.query("select * from social_links order by sort_order, id"),
  ]);

  const c = channelRows[0];
  const goal = goalRows[0];
  const mediaUrl = (path) => (path ? `/media/${path}` : "");

  return {
    settings,
    channel: c ? {
      title: c.title,
      subscriberCount: c.subscriber_count,
      subscribersHidden: c.subscribers_hidden,
      viewCount: c.view_count,
      videoCount: c.video_count,
      streamCount: c.stream_count,
      avatarUrl: c.avatar_url,
      bannerUrl: c.banner_url,
      syncedAt: iso(c.synced_at),
    } : null,
    videos: videoRows.map((v) => ({
      id: v.youtube_id,
      title: v.title,
      description: v.description,
      customDescription: v.custom_description,
      publishedAt: iso(v.published_at),
      durationSeconds: v.duration_seconds,
      thumbnails: v.thumbnails,
      kind: v.kind,
      kindOverride: v.kind_override,
      liveState: v.live_state,
      scheduledStart: iso(v.scheduled_start),
      actualStart: iso(v.actual_start),
      concurrentViewers: v.concurrent_viewers,
      views: v.view_count,
      likes: v.like_count,
      comments: v.comment_count,
      gameSlug: v.game_slug,
      hidden: Boolean(v.hidden),
      featured: Boolean(v.featured),
      priority: v.priority ?? 0,
      isAvailable: v.is_available,
    })),
    games: gameRows.map((g) => ({
      slug: g.slug,
      name: g.name,
      status: g.status,
      genre: g.genre,
      releaseYear: g.release_year,
      description: g.description,
      coverUrl: mediaUrl(g.cover_path),
      playlistUrl: g.playlist_url,
      featured: g.featured,
      hidden: g.hidden,
      sortOrder: g.sort_order,
    })),
    schedule: {
      timezone: settings.schedule?.timezone ?? "Asia/Kuala_Lumpur",
      message: settings.schedule?.message ?? "",
      compareZones: settings.schedule?.compareZones ?? [],
      rules: ruleRows,
      events: eventRows.map((e) => ({ startsAt: iso(e.starts_at), title: e.title, description: e.description })),
    },
    goal: goal ? {
      title: goal.title,
      description: goal.description,
      start: goal.start_value,
      target: goal.goal_value,
      deadline: goal.deadline_text,
      enabled: goal.enabled,
      celebrate: goal.celebrate,
    } : null,
    socials: socialRows.map((s) => ({
      platform: s.platform,
      label: s.label,
      description: s.description,
      url: s.url,
      icon: s.icon,
      accent: s.accent,
      enabled: s.enabled,
      sortOrder: s.sort_order,
    })),
  };
}
