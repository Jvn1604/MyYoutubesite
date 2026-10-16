import { describe, it, expect } from "vitest";
import { buildSitePayload, parseVideoQuery, queryVideos, liveStatus } from "../server/services/site-payload.js";
import * as fx from "../server/fixtures/dev-data.js";

const content = () => structuredClone({ settings: fx.settings, channel: fx.channel, videos: fx.videos, games: fx.games, schedule: fx.schedule, goal: fx.goal, socials: fx.socials });

describe("buildSitePayload", () => {
  it("excludes hidden videos, hidden games and disabled sections/socials", () => {
    const c = content();
    c.videos[0].hidden = true;
    c.games[0].hidden = true;
    c.settings.sections[1].enabled = false;
    c.socials[0].enabled = false;
    const p = buildSitePayload(c);
    expect(p.recentStreams.find((v) => v.id === c.videos[0].id)).toBeUndefined();
    expect(p.games.find((g) => g.slug === c.games[0].slug)).toBeUndefined();
    expect(p.settings.sections.map((s) => s.key)).not.toContain(c.settings.sections[1].key);
    expect(p.socials.map((s) => s.platform)).not.toContain(c.socials[0].platform);
  });

  it("never exposes a subscriber count the creator has hidden", () => {
    const c = content();
    c.channel.subscribersHidden = true;
    const p = buildSitePayload(c);
    expect(p.channel.subscriberCount).toBeNull();
    expect(p.goal.current).toBeNull();
  });

  it("counts videos per game and per kind", () => {
    const p = buildSitePayload(content());
    expect(p.games.find((g) => g.slug === "control-resonant").videoCount).toBe(4);
    expect(p.videoFacets.byKind.stream).toBe(15);
  });

  it("orders featured videos by admin priority and excludes hidden ones", () => {
    const c = content();
    Object.assign(c.videos[3], { featured: true, priority: 1 });
    Object.assign(c.videos[5], { featured: true, priority: 9 });
    Object.assign(c.videos[6], { featured: true, hidden: true });
    c.videos[0].featured = false;
    expect(buildSitePayload(c).featured.map((v) => v.id)).toEqual([c.videos[5].id, c.videos[3].id]);
  });

  it("exposes only the admin's website description as `note`", () => {
    const c = content();
    c.videos[0].description = "Long YouTube description with links…";
    const plain = buildSitePayload(c).recentStreams[0];
    expect(plain.note).toBeNull();
    c.videos[0].customDescription = "Day-one blind playthrough";
    expect(buildSitePayload(c).recentStreams[0].note).toBe("Day-one blind playthrough");
  });

  it("never sends the internal schedule settings key to visitors", () => {
    expect(buildSitePayload(content()).settings.schedule).toBeUndefined();
  });

  it("puts the newest finished stream in latest.stream", () => {
    expect(buildSitePayload(content()).latest.stream.id).toBe("7utpCWTZQpg");
  });
});

describe("liveStatus", () => {
  const now = Date.parse("2026-10-16T12:00:00Z");
  it("live beats upcoming", () => {
    const vids = [{ liveState: "upcoming", scheduledStart: "2026-10-16T13:00:00Z" }, { liveState: "live" }];
    expect(liveStatus(vids, now).state).toBe("live");
  });
  it("ignores stale upcoming streams that never started", () => {
    expect(liveStatus([{ liveState: "upcoming", scheduledStart: "2026-10-10T13:00:00Z" }], now).state).toBe("offline");
  });
});

describe("video library query", () => {
  it("clamps bad input", () => {
    expect(parseVideoQuery(new URLSearchParams("type=<script>&page=-3&pageSize=999&game=DROP TABLE"))).toEqual({ type: "all", game: "", q: "", page: 1, pageSize: 48 });
  });
  it("filters by game, type and search, and paginates", () => {
    const r = queryVideos(content(), { type: "stream", game: "blood-of-dawnwalker", q: "part", page: 2, pageSize: 2 });
    expect(r.total).toBe(5);
    expect(r.items).toHaveLength(2);
    expect(r.hasMore).toBe(true);
  });
});
