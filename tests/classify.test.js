import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parseIsoDuration, classifyVideo, normalizeVideo, normalizeChannel, pickThumbnails } from "../server/services/classify.js";
import { matchGame } from "../server/services/game-match.js";

const load = (name) => JSON.parse(readFileSync(new URL(`./fixtures/youtube/${name}`, import.meta.url), "utf8"));
const videos = Object.fromEntries(load("videos.json").items.map((v) => [v.id, v]));

describe("parseIsoDuration", () => {
  it.each([
    ["PT3H42M5S", 13325], ["PT12M34S", 754], ["PT45S", 45], ["PT1H", 3600], ["P1DT2H", 93600], ["P0D", 0], ["PT0S", 0],
  ])("%s → %i", (iso, s) => expect(parseIsoDuration(iso)).toBe(s));
  it.each([[""], [undefined], ["P"], ["PT"], ["3 minutes"]])("rejects %j", (iso) => expect(parseIsoDuration(iso)).toBeNull());
});

describe("classifyVideo", () => {
  it.each([
    ["7utpCWTZQpg", "stream", "ended"],
    ["LiveLiveLv1", "stream", "live"],
    ["UpcomingUp1", "stream", "upcoming"],
    ["RegularVid1", "video", "none"],
    ["VerticalSh1", "short", "none"],
    ["ShortTagSh1", "short", "none"],
    ["TwoMinVid01", "video", "none"],
    ["PremiereVi1", "video", "upcoming"],
    ["StaleLive01", "stream", "live"],
  ])("%s → %s / %s", (id, kind, liveState) => {
    expect(classifyVideo(videos[id])).toEqual({ kind, liveState });
  });
});

describe("normalizeVideo", () => {
  it("maps a finished stream to a DB row", () => {
    expect(normalizeVideo(videos["7utpCWTZQpg"])).toEqual({
      youtubeId: "7utpCWTZQpg",
      title: "Valor Mortis -Napoleonic era Soulslike -pt1",
      description: "Tamil gameplay",
      publishedAt: "2026-10-14T13:01:10.000Z", // actual start, not the "created" timestamp
      durationSeconds: 13325,
      thumbnails: {
        medium: "https://i.ytimg.com/vi/7utpCWTZQpg/mqdefault.jpg",
        high: "https://i.ytimg.com/vi/7utpCWTZQpg/hqdefault.jpg",
        maxres: "https://i.ytimg.com/vi/7utpCWTZQpg/maxresdefault.jpg",
      },
      kind: "stream",
      liveState: "ended",
      scheduledStart: "2026-10-14T13:00:00.000Z",
      actualStart: "2026-10-14T13:01:10.000Z",
      actualEnd: "2026-10-14T16:43:15.000Z",
      concurrentViewers: null,
      viewCount: 1297,
      likeCount: 88,
      commentCount: 14,
      isAvailable: true,
    });
  });

  it("keeps live viewers only while live and has no duration", () => {
    const row = normalizeVideo(videos.LiveLiveLv1);
    expect(row).toMatchObject({ liveState: "live", concurrentViewers: 148, durationSeconds: null });
  });

  it("uses null (not 0) for hidden likes and disabled comments", () => {
    expect(normalizeVideo(videos.ShortTagSh1)).toMatchObject({ likeCount: null, commentCount: null, viewCount: 1100 });
  });

  it("marks non-public videos unavailable", () => {
    expect(normalizeVideo(videos.UnlistedVi1).isAvailable).toBe(false);
  });

  it("falls back across thumbnail sizes and tolerates none", () => {
    expect(pickThumbnails({ high: { url: "h" } })).toEqual({ medium: "h", high: "h", maxres: "h" });
    expect(pickThumbnails({})).toEqual({ medium: null, high: null, maxres: null });
  });
});

describe("normalizeChannel", () => {
  const raw = load("channel.json").items[0];
  it("extracts stats, avatar, banner and uploads playlist", () => {
    const c = normalizeChannel(raw);
    expect(c).toMatchObject({
      channelId: "UC6REYc9lkrj8Em4kjCYsG7A", subscriberCount: 1350, subscribersHidden: false,
      viewCount: 219369, videoCount: 434, avatarUrl: "https://yt3.ggpht.com/avatar=s800", uploadsPlaylistId: "UU6REYc9lkrj8Em4kjCYsG7A",
    });
    expect(c.bannerUrl).toMatch(/^https:\/\/yt3\.googleusercontent\.com\/.+=w\d+/);
  });
  it("never reports a hidden subscriber count", () => {
    const hidden = structuredClone(raw);
    hidden.statistics.hiddenSubscriberCount = true;
    expect(normalizeChannel(hidden)).toMatchObject({ subscriberCount: null, subscribersHidden: true });
  });
});

describe("matchGame", () => {
  const games = [
    { id: 1, keywords: ["elden ring"] },
    { id: 2, keywords: ["elden ring nightreign", "nightreign"] },
    { id: 3, keywords: ["black myth", "wukong"] },
    { id: 4, keywords: ["control resonant"] },
    { id: 5, keywords: ["ai"] },
  ];
  it.each([
    ["Elden Ring Nightreign – Boss rush", 2],        // most specific keyword wins
    ["ELDEN RING DLC no damage", 1],
    ["பிளாக் மித் | Black Myth: Wukong Tamil", 3],
    ["CONTROL Resonant - Part4 @MrLeon_Offcl", 4],
    ["Controller settings explained", null],        // whole words only
    ["Paid streams", null],                         // short keywords ignored
  ])("%s → %j", (title, id) => expect(matchGame(title, games)).toBe(id));
});
