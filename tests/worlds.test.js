import { describe, it, expect, beforeAll } from "vitest";
import { buildSitePayload, buildWorlds } from "../server/services/site-payload.js";
import { pickAnnouncement } from "../src/js/home/announce.js";
import { createDb } from "../server/db/client.js";
import { migrate } from "../server/db/migrate.js";
import { seed } from "../server/db/seed.js";
import * as fx from "../server/fixtures/dev-data.js";

const content = () => structuredClone({ settings: fx.settings, channel: fx.channel, videos: fx.videos, games: fx.games, schedule: fx.schedule, goal: fx.goal, socials: fx.socials });

let sceneProgress;
beforeAll(async () => {
  globalThis.matchMedia ??= () => ({ matches: false }); // ui/scenes.js imports core/motion.js, which reads it at load
  ({ sceneProgress } = await import("../src/js/ui/scenes.js"));
});

const vid = (id, slug, extra = {}) => ({
  id, game: { slug, name: slug }, kind: "stream", liveState: "ended", title: id, url: `https://www.youtube.com/watch?v=${id}`,
  publishedAt: "2026-10-01T00:00:00Z", views: 10, durationSeconds: 60,
  thumbnails: { medium: `m/${id}`, high: `h/${id}`, maxres: `x/${id}` }, ...extra,
});

describe("Game worlds payload", () => {
  it("is part of the site payload, with landscape stills only", () => {
    const p = buildSitePayload(content());
    expect(p.worlds.length).toBeGreaterThan(0);
    expect(p.worlds.length).toBeLessThanOrEqual(5);
    for (const w of p.worlds) {
      expect(w.shots.length).toBeGreaterThanOrEqual(2);
      expect(w.shots.length).toBeLessThanOrEqual(6);
      expect(w.shots.every((s) => s.kind !== "short")).toBe(true);
      expect(Object.keys(w.shots[0].thumbnails).sort()).toEqual(["high", "maxres", "medium"]);
    }
  });

  it("puts the game being played first, then featured, then the biggest library", () => {
    const games = [
      { slug: "big", name: "Big", status: "completed" },
      { slug: "feat", name: "Feat", status: "completed", featured: true },
      { slug: "now", name: "Now", status: "playing" },
      { slug: "one", name: "One", status: "playing" }, // a single video is not enough for a scene
      { slug: "gone", name: "Gone", status: "playing", hidden: true },
    ];
    const vids = [
      ...["b1", "b2", "b3", "b4"].map((id) => vid(id, "big")),
      ...["f1", "f2"].map((id) => vid(id, "feat")),
      ...["n1", "n2"].map((id) => vid(id, "now")),
      vid("o1", "one"),
      ...["g1", "g2"].map((id) => vid(id, "gone")),
      vid("s1", "now", { kind: "short" }),
      vid("u1", "now", { liveState: "upcoming" }),
    ];
    const worlds = buildWorlds(games, vids);
    expect(worlds.map((w) => w.slug)).toEqual(["now", "feat", "big"]);
    expect(worlds[0].shots.map((s) => s.id)).toEqual(["n1", "n2"]); // no Short, no upcoming
    expect(worlds[2]).toMatchObject({ videoCount: 4, streamCount: 4 });
  });
});

describe("scene progress", () => {
  const vh = 800;
  const h = 2400; // a 3-screen scene
  it("enters, holds and exits in order", () => {
    expect(sceneProgress(vh, h, vh)).toEqual({ enter: 0, hold: 0, exit: 0 }); // just below the fold
    expect(sceneProgress(400, h, vh)).toMatchObject({ enter: 0.5, hold: 0 });
    expect(sceneProgress(-800, h, vh)).toEqual({ enter: 1, hold: 0.5, exit: 0 }); // pinned, halfway
    expect(sceneProgress(-1600, h, vh)).toEqual({ enter: 1, hold: 1, exit: 0 });
    expect(sceneProgress(-2000, h, vh)).toMatchObject({ hold: 1, exit: 0.5 });
    expect(sceneProgress(-5000, h, vh)).toEqual({ enter: 1, hold: 1, exit: 1 }); // clamped
  });
});

describe("announcement strip", () => {
  const now = Date.parse("2026-10-23T12:00:00Z");
  const upload = { id: "new1", publishedAt: "2026-10-20T12:00:00Z", title: "New", url: "u" };
  it("live wins over a new upload", () => {
    expect(pickAnnouncement({ live: { state: "live", video: { id: "L" } }, latest: { upload } }, now)).toMatchObject({ kind: "live" });
  });
  it("shows an upload for a week, then nothing", () => {
    expect(pickAnnouncement({ live: { state: "offline" }, latest: { upload } }, now)).toMatchObject({ kind: "new" });
    expect(pickAnnouncement({ live: { state: "offline" }, latest: { upload } }, now + 5 * 864e5)).toBeNull();
    expect(pickAnnouncement({ live: { state: "offline" }, latest: { upload: null } }, now)).toBeNull();
  });
});

describe("migration 002 (worlds section)", () => {
  it("adds worlds just before games on an existing site, once", async () => {
    const db = await createDb("pglite:memory");
    try {
      await migrate(db);
      await seed(db);
      // Simulate a site created before the section existed, with a custom order
      const old = ["hero", "latest", "games", "stats", "streams", "schedule", "goal", "videos", "community", "support", "about"].map((key) => ({ key, enabled: key !== "goal" }));
      await db.query("update site_settings set value = $1 where key = 'sections'", [JSON.stringify(old)]);
      await db.query("delete from schema_migrations where version = '002'");
      await migrate(db);
      const [{ value }] = await db.query("select value from site_settings where key = 'sections'");
      expect(value.map((s) => s.key)).toEqual(["hero", "latest", "worlds", "games", "stats", "streams", "schedule", "goal", "videos", "community", "support", "about"]);
      expect(value.find((s) => s.key === "goal").enabled).toBe(false); // admin choices kept

      await db.query("delete from schema_migrations where version = '002'");
      await migrate(db); // running again changes nothing
      const [{ value: again }] = await db.query("select value from site_settings where key = 'sections'");
      expect(again).toEqual(value);
    } finally {
      await db.close();
    }
  }, 30_000);
});
