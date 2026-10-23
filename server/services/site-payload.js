/**
 * Pure functions that turn stored rows (YouTube data merged with website
 * overrides) into the public API shapes documented in docs/02-api-contract.md.
 * No I/O here, so the same code serves fixture data now and DB rows later.
 */

const thumbs = (id) => ({
  medium: `https://i.ytimg.com/vi/${id}/mqdefault.jpg`,
  high: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
  maxres: `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`,
});

const withoutKeys = (obj, keys) => Object.fromEntries(Object.entries(obj).filter(([k]) => !keys.includes(k)));

const byNewest =(a, b) => new Date(b.publishedAt) - new Date(a.publishedAt);

/** Row → public Video DTO. `gameIndex` maps slug → game row. */
export function toVideoDto(row, gameIndex) {
  const game = row.gameSlug ? gameIndex.get(row.gameSlug) : null;
  return {
    id: row.id,
    title: row.title,
    description: row.customDescription || row.description || "",
    note: row.customDescription || null, // short website-only text written in the admin (never the YouTube description)
    url: `https://www.youtube.com/watch?v=${row.id}`,
    publishedAt: row.publishedAt,
    durationSeconds: row.durationSeconds ?? null,
    kind: row.kindOverride || row.kind,
    liveState: row.liveState,
    scheduledStart: row.scheduledStart ?? null,
    actualStart: row.actualStart ?? null,
    concurrentViewers: row.concurrentViewers ?? null,
    views: row.views ?? null,
    likes: row.likes ?? null,
    comments: row.comments ?? null,
    // Official i.ytimg.com URLs fill any size YouTube didn't report
    thumbnails: { ...thumbs(row.id), ...Object.fromEntries(Object.entries(row.thumbnails ?? {}).filter(([, url]) => url)) },
    game: game && !game.hidden ? { slug: game.slug, name: game.name } : null,
    featured: Boolean(row.featured),
  };
}

export function visibleVideos(rows) {
  return rows.filter((r) => !r.hidden && r.isAvailable !== false);
}

export function liveStatus(videos, now = Date.now()) {
  const live = videos.find((v) => v.liveState === "live");
  if (live) return { state: "live", video: live };
  const upcoming = videos
    .filter((v) => v.liveState === "upcoming" && v.scheduledStart && new Date(v.scheduledStart).getTime() > now - 2 * 3600e3)
    .sort((a, b) => new Date(a.scheduledStart) - new Date(b.scheduledStart))[0];
  return upcoming ? { state: "upcoming", video: upcoming } : { state: "offline", video: null };
}

const WORLD_LIMIT = 5;
const WORLD_SHOTS = 6;
const WORLD_STATUS_RANK = { playing: 0, upcoming: 1, favourite: 2, completed: 3, dropped: 4 };

/**
 * "Game worlds" scroll story: the games with the most to show, each with its newest
 * landscape videos (Shorts are vertical, so they don't work as full-screen scenes).
 * Playing now comes first, then featured, then the biggest libraries.
 */
export function buildWorlds(games, vids) {
  const byGame = new Map();
  vids.forEach((v) => {
    if (!v.game || v.kind === "short" || v.liveState === "upcoming") return;
    if (!byGame.has(v.game.slug)) byGame.set(v.game.slug, []);
    byGame.get(v.game.slug).push(v);
  });
  return games
    .filter((g) => !g.hidden && (byGame.get(g.slug)?.length ?? 0) >= 2)
    .sort((a, b) => (WORLD_STATUS_RANK[a.status] ?? 9) - (WORLD_STATUS_RANK[b.status] ?? 9)
      || Number(Boolean(b.featured)) - Number(Boolean(a.featured))
      || byGame.get(b.slug).length - byGame.get(a.slug).length)
    .slice(0, WORLD_LIMIT)
    .map((g) => {
      const list = byGame.get(g.slug);
      return {
        slug: g.slug,
        name: g.name,
        status: g.status,
        genre: g.genre ?? "",
        description: g.description ?? "",
        videoCount: list.length,
        streamCount: list.filter((v) => v.kind === "stream").length,
        shots: list.slice(0, WORLD_SHOTS).map((v) => ({
          id: v.id, title: v.title, url: v.url, kind: v.kind, publishedAt: v.publishedAt, views: v.views,
          durationSeconds: v.durationSeconds, thumbnails: { medium: v.thumbnails.medium, high: v.thumbnails.high, maxres: v.thumbnails.maxres },
        })),
      };
    });
}

export function buildSitePayload({ settings, channel, videos, games, schedule, goal, socials, now = Date.now() }) {
  const gameIndex = new Map(games.map((g) => [g.slug, g]));
  const vids = visibleVideos(videos).map((r) => toVideoDto(r, gameIndex)).sort(byNewest);

  const finishedStreams = vids.filter((v) => v.kind === "stream" && v.liveState === "ended");
  // "Latest upload" headlines the newest full video; Shorts live in the library under their own filter
  const uploads = vids.filter((v) => v.kind === "video" && v.liveState !== "upcoming");

  const counts = { video: 0, stream: 0, short: 0 };
  vids.forEach((v) => { counts[v.kind] = (counts[v.kind] ?? 0) + 1; });

  const gameVideoCount = new Map();
  const gameLatestThumb = new Map(); // vids are newest-first, so the first seen wins
  vids.forEach((v) => {
    if (!v.game) return;
    gameVideoCount.set(v.game.slug, (gameVideoCount.get(v.game.slug) ?? 0) + 1);
    if (!gameLatestThumb.has(v.game.slug)) gameLatestThumb.set(v.game.slug, v.thumbnails.high);
  });

  const featuredRows = visibleVideos(videos).filter((r) => r.featured).sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0) || byNewest(a, b));

  return {
    generatedAt: new Date(now).toISOString(),
    settings: { ...withoutKeys(settings, ["schedule"]), sections: settings.sections.filter((s) => s.enabled) },
    channel: channel ? { ...channel, subscriberCount: channel.subscribersHidden ? null : channel.subscriberCount } : null,
    live: liveStatus(vids, now),
    latest: { upload: uploads[0] ?? null, stream: finishedStreams[0] ?? null },
    recentStreams: finishedStreams.slice(0, 6),
    featured: featuredRows.slice(0, 6).map((r) => toVideoDto(r, gameIndex)),
    games: games
      .filter((g) => !g.hidden)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
      .map(({ hidden, sortOrder, ...g }) => ({
        ...g,
        // No uploaded cover yet → borrow the thumbnail of the game's newest video
        coverUrl: g.coverUrl || gameLatestThumb.get(g.slug) || "",
        videoCount: gameVideoCount.get(g.slug) ?? 0,
      })),
    worlds: buildWorlds(games, vids),
    schedule: { ...schedule, rules: schedule.rules.filter((r) => r.enabled !== false) },
    goal: goal?.enabled
      ? { title: goal.title, description: goal.description, start: goal.start, target: goal.target,
          current: channel && !channel.subscribersHidden ? channel.subscriberCount : null,
          deadline: goal.deadline, celebrate: goal.celebrate }
      : null,
    socials: socials
      .filter((s) => s.enabled)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
      .map(({ enabled, sortOrder, ...s }) => ({ icon: s.platform, ...s })),
    videoFacets: { total: vids.length, byKind: counts },
  };
}

export const VIDEO_TYPES = ["all", "video", "stream", "short"];

/** Parse + clamp library query params. Invalid values fall back to safe defaults. */
export function parseVideoQuery(params) {
  const type = VIDEO_TYPES.includes(params.get("type")) ? params.get("type") : "all";
  const game = /^[a-z0-9-]{1,80}$/.test(params.get("game") ?? "") ? params.get("game") : "";
  const q = (params.get("q") ?? "").trim().slice(0, 80);
  const page = Math.max(1, Math.min(500, parseInt(params.get("page"), 10) || 1));
  const pageSize = Math.max(1, Math.min(48, parseInt(params.get("pageSize"), 10) || 12));
  return { type, game, q, page, pageSize };
}

export function queryVideos({ videos, games }, { type, game, q, page, pageSize }) {
  const gameIndex = new Map(games.map((g) => [g.slug, g]));
  const needle = q.toLowerCase();
  const matches = visibleVideos(videos)
    .map((r) => toVideoDto(r, gameIndex))
    .filter((v) => v.liveState !== "upcoming")
    .filter((v) => type === "all" || v.kind === type)
    .filter((v) => !game || v.game?.slug === game)
    .filter((v) => !needle || v.title.toLowerCase().includes(needle) || v.game?.name.toLowerCase().includes(needle))
    .sort(byNewest);
  const start = (page - 1) * pageSize;
  return { items: matches.slice(start, start + pageSize), page, pageSize, total: matches.length, hasMore: start + pageSize < matches.length };
}
