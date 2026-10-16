/**
 * Turns raw YouTube Data API resources into our DB row shapes.
 * Pure functions: no I/O, fully unit-tested against saved API responses.
 *
 * Classification rules (kind):
 *   stream  → has liveStreamingDetails (live, upcoming or finished broadcast)
 *             except an *upcoming premiere* (already has a real duration) → video
 *   short   → vertical player (embedHeight > embedWidth) and ≤ 3 minutes,
 *             or #shorts in title/description and ≤ 3 minutes
 *   video   → everything else
 * The admin can override the kind per video (video_overrides.kind_override).
 */

const SHORT_MAX_SECONDS = 180;

/** ISO-8601 duration ("PT1H2M3S", "P1DT2H", "P0D") → seconds, or null if unparseable. */
export function parseIsoDuration(iso) {
  const m = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/.exec(iso ?? "");
  if (!m || iso === "P" || iso === "PT") return null;
  const [, d = 0, h = 0, min = 0, s = 0] = m;
  return Math.round(+d * 86400 + +h * 3600 + +min * 60 + +s);
}

const toInt = (v) => (v == null || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));
const toIso = (v) => (v ? new Date(v).toISOString() : null);

/** Pick the best available thumbnails; YouTube omits sizes it doesn't have. */
export function pickThumbnails(thumbs = {}) {
  const url = (...keys) => keys.map((k) => thumbs[k]?.url).find(Boolean) ?? null;
  return {
    medium: url("medium", "high", "default"),
    high: url("high", "standard", "medium", "default"),
    maxres: url("maxres", "standard", "high"),
  };
}

function isVertical(player) {
  const w = toInt(player?.embedWidth);
  const h = toInt(player?.embedHeight);
  return w != null && h != null && h > w;
}

export function classifyVideo(item) {
  const live = item.liveStreamingDetails;
  const broadcast = item.snippet?.liveBroadcastContent ?? "none"; // "live" | "upcoming" | "none"
  const duration = parseIsoDuration(item.contentDetails?.duration);

  let liveState = "none";
  if (broadcast === "live") liveState = "live";
  else if (broadcast === "upcoming") liveState = "upcoming";
  else if (live) {
    // liveBroadcastContent can lag behind; the timestamps are authoritative
    liveState = live.actualStartTime && !live.actualEndTime ? "live" : "ended";
  }

  const isPremiere = Boolean(live) && broadcast === "upcoming" && duration > 0;
  if (live && !isPremiere) return { kind: "stream", liveState };

  const text = `${item.snippet?.title ?? ""} ${item.snippet?.description ?? ""}`.toLowerCase();
  const shortLength = duration != null && duration > 0 && duration <= SHORT_MAX_SECONDS;
  if (shortLength && (isVertical(item.player) || /#shorts?\b/.test(text))) {
    return { kind: "short", liveState: "none" };
  }
  return { kind: "video", liveState: isPremiere ? liveState : "none" };
}

/** videos.list item → `videos` table row (camelCase; repository maps to columns). */
export function normalizeVideo(item, now = new Date()) {
  const { kind, liveState } = classifyVideo(item);
  const s = item.snippet ?? {};
  const live = item.liveStreamingDetails ?? {};
  const stats = item.statistics ?? {};
  return {
    youtubeId: item.id,
    title: (s.title ?? "").trim() || "(untitled)",
    description: s.description ?? "",
    publishedAt: toIso(live.actualStartTime ?? s.publishedAt) ?? now.toISOString(),
    durationSeconds: liveState === "live" || liveState === "upcoming" ? null : parseIsoDuration(item.contentDetails?.duration),
    thumbnails: pickThumbnails(s.thumbnails),
    kind,
    liveState,
    scheduledStart: toIso(live.scheduledStartTime),
    actualStart: toIso(live.actualStartTime),
    actualEnd: toIso(live.actualEndTime),
    concurrentViewers: liveState === "live" ? toInt(live.concurrentViewers) : null,
    viewCount: toInt(stats.viewCount),
    likeCount: toInt(stats.likeCount),       // null when the creator hides likes
    commentCount: toInt(stats.commentCount), // null when comments are disabled
    isAvailable: (item.status?.privacyStatus ?? "public") === "public",
  };
}

/** channels.list item → channel_stats row + the uploads playlist id. */
export function normalizeChannel(item) {
  const s = item.snippet ?? {};
  const stats = item.statistics ?? {};
  const banner = item.brandingSettings?.image?.bannerExternalUrl;
  return {
    channelId: item.id,
    title: s.title ?? "",
    description: s.description ?? "",
    subscriberCount: stats.hiddenSubscriberCount ? null : toInt(stats.subscriberCount),
    subscribersHidden: Boolean(stats.hiddenSubscriberCount),
    viewCount: toInt(stats.viewCount),
    videoCount: toInt(stats.videoCount),
    avatarUrl: pickThumbnails(s.thumbnails).high ?? "",
    // bannerExternalUrl has no size suffix; request YouTube's cropped desktop banner
    bannerUrl: banner ? `${banner}=w1138-fcrop64=1,00005a57ffffa5a8-k-c0xffffffff-no-nd-rj` : "",
    uploadsPlaylistId: item.contentDetails?.relatedPlaylists?.uploads ?? null,
  };
}
