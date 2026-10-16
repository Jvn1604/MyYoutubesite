/**
 * Minimal YouTube Data API v3 client (official endpoints only).
 * - Tracks quota units used per instance (every call we make costs 1 unit).
 * - Never puts the API key in errors or logs.
 * - Retries once on transient 5xx/network errors; quota/key errors fail fast.
 *
 * Quota reference: channels.list, playlistItems.list, videos.list = 1 unit each.
 * search.list (100 units) is deliberately not used.
 */

const BASE = "https://www.googleapis.com/youtube/v3";
const TIMEOUT_MS = 10_000;
const MAX_IDS_PER_CALL = 50;

export class YouTubeApiError extends Error {
  constructor(message, { status = 0, reason = "unknown", retryable = false } = {}) {
    super(message);
    this.name = "YouTubeApiError";
    this.status = status;
    this.reason = reason;       // e.g. quotaExceeded, keyInvalid, forbidden, network
    this.retryable = retryable;
  }
}

const FATAL_REASONS = new Set(["quotaExceeded", "dailyLimitExceeded", "rateLimitExceeded", "keyInvalid", "keyExpired", "forbidden", "accessNotConfigured", "ipRefererBlocked"]);

export function createYouTubeClient({ apiKey, fetchImpl = globalThis.fetch, sleep = (ms) => new Promise((r) => setTimeout(r, ms)) }) {
  if (!apiKey) throw new YouTubeApiError("YouTube API key is not configured", { reason: "keyMissing" });
  let unitsUsed = 0;

  async function call(resource, params, attempt = 1) {
    const url = new URL(`${BASE}/${resource}`);
    Object.entries(params).forEach(([k, v]) => v != null && url.searchParams.set(k, String(v)));
    url.searchParams.set("key", apiKey);

    let res;
    try {
      unitsUsed += 1;
      res = await fetchImpl(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(TIMEOUT_MS) });
    } catch (err) {
      if (attempt < 2) { await sleep(750); return call(resource, params, attempt + 1); }
      throw new YouTubeApiError(`Network error calling ${resource}: ${err.name === "TimeoutError" ? "timed out" : err.message}`, { reason: "network", retryable: true });
    }

    if (res.ok) return res.json();

    let reason = "unknown";
    let message = res.statusText;
    try {
      const body = await res.json();
      reason = body?.error?.errors?.[0]?.reason ?? body?.error?.status ?? reason;
      message = body?.error?.message ?? message;
    } catch { /* non-JSON error body */ }

    const retryable = res.status >= 500 && !FATAL_REASONS.has(reason);
    if (retryable && attempt < 2) { await sleep(750); return call(resource, params, attempt + 1); }
    // Strip anything that looks like our key from Google's message, just in case
    const safeMessage = String(message).split(apiKey).join("[redacted]");
    throw new YouTubeApiError(`YouTube ${resource} failed (${res.status} ${reason}): ${safeMessage}`, { status: res.status, reason, retryable });
  }

  return {
    get unitsUsed() { return unitsUsed; },

    /** Channel snippet/statistics/branding + uploads playlist id. Returns raw item or null. */
    async getChannel(channelId) {
      const data = await call("channels", { part: "snippet,statistics,brandingSettings,contentDetails", id: channelId, maxResults: 1 });
      return data.items?.[0] ?? null;
    },

    /** One page of the uploads playlist (newest first). */
    async listPlaylistPage(playlistId, { pageToken, maxResults = 50 } = {}) {
      const data = await call("playlistItems", { part: "contentDetails", playlistId, maxResults, pageToken });
      return {
        ids: (data.items ?? []).map((i) => i.contentDetails?.videoId).filter(Boolean),
        nextPageToken: data.nextPageToken ?? null,
        total: data.pageInfo?.totalResults ?? null,
      };
    },

    /** Every video id in a playlist, following pagination (1 unit per 50 ids). */
    async listAllPlaylistIds(playlistId, { maxPages = 40 } = {}) {
      const ids = [];
      let pageToken;
      for (let page = 0; page < maxPages; page++) {
        const res = await this.listPlaylistPage(playlistId, { pageToken });
        ids.push(...res.ids);
        if (!res.nextPageToken) break;
        pageToken = res.nextPageToken;
      }
      return [...new Set(ids)];
    },

    /**
     * Full video resources for ids, batched 50 per call.
     * Deleted/private videos are simply absent from the result.
     */
    async getVideos(ids) {
      const unique = [...new Set(ids)];
      const items = [];
      for (let i = 0; i < unique.length; i += MAX_IDS_PER_CALL) {
        const batch = unique.slice(i, i + MAX_IDS_PER_CALL);
        const data = await call("videos", {
          part: "snippet,contentDetails,statistics,liveStreamingDetails,status,player",
          id: batch.join(","),
          maxResults: MAX_IDS_PER_CALL,
          maxHeight: 720, // makes player.embedWidth/embedHeight reflect the aspect ratio (Shorts are vertical)
        });
        items.push(...(data.items ?? []));
      }
      return items;
    },
  };
}

/** The uploads playlist id can be derived from the channel id (UC… → UU…). */
export const uploadsPlaylistFor = (channelId) => (channelId?.startsWith("UC") ? `UU${channelId.slice(2)}` : null);
