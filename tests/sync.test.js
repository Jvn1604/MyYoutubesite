import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { createDb } from "../server/db/client.js";
import { migrate } from "../server/db/migrate.js";
import { seed } from "../server/db/seed.js";
import { runSync } from "../server/services/sync.js";
import { YouTubeApiError } from "../server/services/youtube.js";
import { loadContentFromDb } from "../server/repositories/content.js";
import { buildSitePayload, queryVideos } from "../server/services/site-payload.js";

const CHANNEL = "UC6REYc9lkrj8Em4kjCYsG7A";
const load = (name) => JSON.parse(readFileSync(new URL(`./fixtures/youtube/${name}`, import.meta.url), "utf8"));
const channelItem = load("channel.json").items[0];
const fixtureVideos = Object.fromEntries(load("videos.json").items.map((v) => [v.id, v]));

/** In-memory stand-in for the YouTube API: a mutable "channel" we can upload to, go live on, delete from. */
function fakeYouTube() {
  const state = {
    playlist: ["LiveLiveLv1", "UpcomingUp1", "7utpCWTZQpg", "RegularVid1", "VerticalSh1"], // newest first
    videos: structuredClone(fixtureVideos),
    channel: structuredClone(channelItem),
    failWith: null,
  };
  let units = 0;
  const maybeFail = () => { units += 1; if (state.failWith) throw state.failWith; };
  return {
    state,
    get unitsUsed() { return units; },
    async getChannel() { maybeFail(); return state.channel; },
    async listPlaylistPage(_id, { maxResults = 50 } = {}) { maybeFail(); return { ids: state.playlist.slice(0, maxResults), nextPageToken: null }; },
    async listAllPlaylistIds() { maybeFail(); return [...state.playlist]; },
    async getVideos(ids) { maybeFail(); return ids.map((id) => state.videos[id]).filter(Boolean); },
  };
}

let db;
let yt;
beforeEach(async () => {
  db = await createDb("pglite:memory");
  await migrate(db);
  await seed(db);
  yt = fakeYouTube();
}, 30_000);
afterEach(() => db?.close());

const sync = (job, now = new Date("2026-10-16T13:30:00Z")) => runSync(db, yt, { job, channelId: CHANNEL, now });
// Same fixed clock as sync() so date-based rules (stale upcoming streams) don't depend on today's date
const payload = async () => buildSitePayload({ ...(await loadContentFromDb(db)), now: Date.parse("2026-10-16T13:30:00Z") });

describe("full sync", () => {
  it("imports channel stats and every upload, classified", async () => {
    const r = await sync("manual");
    expect(r).toMatchObject({ ok: true, unitsUsed: 3 });
    const kinds = Object.fromEntries((await db.query("select youtube_id, kind, live_state from videos")).map((v) => [v.youtube_id, `${v.kind}/${v.live_state}`]));
    expect(kinds).toEqual({
      LiveLiveLv1: "stream/live", UpcomingUp1: "stream/upcoming", "7utpCWTZQpg": "stream/ended", RegularVid1: "video/none", VerticalSh1: "short/none",
    });
    const [c] = await db.query("select subscriber_count, video_count from channel_stats");
    expect(c).toEqual({ subscriber_count: 1350, video_count: 434 });
    expect(await db.query("select day from analytics_snapshots")).toHaveLength(1);
  });

  it("logs every run with quota usage", async () => {
    await sync("manual");
    const [log] = await db.query("select job, ok, units_used, error, finished_at is not null as done from youtube_sync_logs");
    expect(log).toEqual({ job: "manual", ok: true, units_used: 3, error: null, done: true });
  });

  it("auto-assigns games from titles", async () => {
    await sync("library");
    const rows = await db.query("select o.youtube_id, g.slug from video_overrides o join games g on g.id = o.game_id order by 1");
    expect(rows).toEqual([
      { youtube_id: "7utpCWTZQpg", slug: "valor-mortis" },
      { youtube_id: "LiveLiveLv1", slug: "valor-mortis" },
      { youtube_id: "UpcomingUp1", slug: "elden-ring" }, // "Elden Ring Nightreign – Boss rush"
    ]);
  });
});

describe("the 'What is Soulslike?' workflow", () => {
  it("a new upload becomes the latest upload without any code change", async () => {
    await sync("manual");
    expect((await payload()).latest.upload.id).toBe("RegularVid1"); // the newer Short doesn't headline

    // Creator uploads a new video on YouTube
    yt.state.videos.NewSoulsVid = { ...structuredClone(fixtureVideos.RegularVid1), id: "NewSoulsVid",
      snippet: { ...fixtureVideos.RegularVid1.snippet, title: "What is Soulslike? (Part 2)", publishedAt: "2026-10-16T14:00:00Z",
        thumbnails: { high: { url: "https://i.ytimg.com/vi/NewSoulsVid/hqdefault.jpg" } } } };
    yt.state.playlist.unshift("NewSoulsVid");

    const r = await sync("live");
    expect(r.inserted).toEqual(["NewSoulsVid"]);
    const p = await payload();
    expect(p.latest.upload).toMatchObject({ id: "NewSoulsVid", title: "What is Soulslike? (Part 2)", url: "https://www.youtube.com/watch?v=NewSoulsVid" });
    expect(p.latest.upload.thumbnails.high).toMatch(/NewSoulsVid/);
    expect(queryVideos(await loadContentFromDb(db), { type: "video", game: "", q: "soulslike", page: 1, pageSize: 12 }).items[0].id).toBe("NewSoulsVid");
  });

  it("hiding/featuring it on the website survives later syncs", async () => {
    await sync("manual");
    await db.query("insert into video_overrides (youtube_id, hidden, featured, custom_description) values ('RegularVid1', true, true, 'Website-only text')");
    yt.state.videos.RegularVid1.statistics.viewCount = "999";
    yt.state.videos.RegularVid1.snippet.title = "What is Soulslike? [updated on YouTube]";
    await sync("library");
    const [row] = await db.query("select v.title, v.view_count, o.hidden, o.featured, o.custom_description from videos v join video_overrides o using (youtube_id) where youtube_id = 'RegularVid1'");
    expect(row).toEqual({ title: "What is Soulslike? [updated on YouTube]", view_count: 999, hidden: true, featured: true, custom_description: "Website-only text" });
    expect((await payload()).latest.upload?.id).not.toBe("RegularVid1"); // hidden → not shown
  });
});

describe("live lifecycle", () => {
  it("LIVE → ended moves the stream into recent streams", async () => {
    await sync("manual");
    let p = await payload();
    expect(p.live).toMatchObject({ state: "live", video: { id: "LiveLiveLv1", concurrentViewers: 148 } });

    // Stream ends; it has also been pushed off the first playlist page by newer uploads
    Object.assign(yt.state.videos.LiveLiveLv1.snippet, { liveBroadcastContent: "none" });
    yt.state.videos.LiveLiveLv1.liveStreamingDetails.actualEndTime = "2026-10-16T16:00:00Z";
    yt.state.videos.LiveLiveLv1.contentDetails.duration = "PT3H";
    yt.state.playlist = ["X0000000001", ...yt.state.playlist.filter((id) => id !== "LiveLiveLv1")];

    await sync("live");
    p = await payload();
    expect(p.live.state).toBe("upcoming"); // the scheduled stream is next
    expect(p.recentStreams[0].id).toBe("LiveLiveLv1");
    expect(p.recentStreams[0].concurrentViewers).toBeNull();
  });

  it("an upcoming stream that is cancelled (deleted) stops showing", async () => {
    await sync("manual");
    delete yt.state.videos.UpcomingUp1;
    yt.state.playlist = yt.state.playlist.filter((id) => id !== "UpcomingUp1");
    await sync("live");
    const [row] = await db.query("select is_available, live_state from videos where youtube_id = 'UpcomingUp1'");
    expect(row).toEqual({ is_available: false, live_state: "ended" });
  });
});

describe("deletions", () => {
  it("library sync marks removed videos unavailable but keeps their overrides", async () => {
    await sync("manual");
    await db.query("insert into video_overrides (youtube_id, featured) values ('VerticalSh1', true)");
    yt.state.playlist = yt.state.playlist.filter((id) => id !== "VerticalSh1");
    delete yt.state.videos.VerticalSh1;
    await sync("library");
    expect((await db.query("select is_available from videos where youtube_id = 'VerticalSh1'"))[0].is_available).toBe(false);
    expect(await db.query("select 1 from video_overrides where youtube_id = 'VerticalSh1'")).toHaveLength(1);
    expect((await payload()).videoFacets.byKind.short).toBe(0);
  });

  it("an empty playlist response never wipes the library", async () => {
    await sync("manual");
    yt.state.playlist = [];
    await sync("library");
    expect(await db.query("select 1 from videos where is_available")).toHaveLength(5);
  });
});

describe("game assignment respects the admin", () => {
  it("never overrides a locked or already-set game", async () => {
    await sync("manual");
    const [bloodborne] = await db.query("select id from games where slug = 'bloodborne'");
    await db.query("update video_overrides set game_id = $1, game_locked = true where youtube_id = '7utpCWTZQpg'", [bloodborne.id]);
    await sync("library");
    const [row] = await db.query("select g.slug from video_overrides o join games g on g.id = o.game_id where youtube_id = '7utpCWTZQpg'");
    expect(row.slug).toBe("bloodborne");
  });
});

describe("failures", () => {
  it("keeps the last good data and records the error", async () => {
    await sync("manual");
    yt.state.failWith = new YouTubeApiError("YouTube videos failed (403 quotaExceeded)", { status: 403, reason: "quotaExceeded" });
    const r = await sync("live");
    expect(r).toMatchObject({ ok: false, reason: "quotaExceeded" });
    const [log] = await db.query("select ok, error from youtube_sync_logs order by id desc limit 1");
    expect(log.ok).toBe(false);
    expect(log.error).toMatch(/quotaExceeded/);
    expect((await payload()).live.state).toBe("live"); // site still renders previous state
  });

  it("skips a job while the same job is still running", async () => {
    await db.query("insert into youtube_sync_logs (job) values ('live')");
    expect(await sync("live")).toMatchObject({ ok: true, skipped: true, unitsUsed: 0 });
  });

  it("reports a missing channel clearly", async () => {
    yt.state.channel = null;
    expect((await sync("stats")).error).toMatch(/not found/);
  });
});

describe("goal", () => {
  it("is marked achieved once the subscriber count reaches it", async () => {
    yt.state.channel.statistics.subscriberCount = "1700";
    await sync("stats");
    expect((await db.query("select achieved_at is not null as done from subscriber_goals where enabled"))[0].done).toBe(true);
    expect((await payload()).goal.current).toBe(1700);
  });
});
