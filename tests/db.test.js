import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createDb } from "../server/db/client.js";
import { migrate } from "../server/db/migrate.js";
import { seed } from "../server/db/seed.js";

// Real Postgres (PGlite, in memory): same SQL as Supabase, no external service needed.
let db;
beforeAll(async () => {
  db = await createDb("pglite:memory");
  await migrate(db);
}, 30_000);
afterAll(() => db?.close());

const rejects = (sql, params) => expect(db.query(sql, params)).rejects.toThrow();
const videoRow = (id, extra = "") =>
  db.query(`insert into videos (youtube_id, title, published_at, kind${extra ? ", live_state" : ""}) values ($1, 'T', now(), 'stream'${extra ? ", $2" : ""})`,
    extra ? [id, extra] : [id]);

describe("migrations", () => {
  it("records applied migrations and is a no-op the second time", async () => {
    const rows = await db.query("select version, file from schema_migrations");
    expect(rows).toEqual([{ version: "001", file: "001_init.sql" }]);
    expect(await migrate(db)).toEqual([]);
  });

  it("creates every table from the design", async () => {
    const tables = (await db.query("select table_name from information_schema.tables where table_schema = 'public'")).map((r) => r.table_name);
    for (const t of ["admins", "sessions", "login_attempts", "site_settings", "media", "games", "videos", "video_overrides", "channel_stats",
      "analytics_snapshots", "youtube_sync_logs", "schedule_rules", "schedule_events", "subscriber_goals", "social_links", "site_events"]) {
      expect(tables).toContain(t);
    }
  });
});

describe("seed", () => {
  it("inserts the legacy site content", async () => {
    const result = await seed(db);
    expect(result).toEqual({ settings: 10, games: 11, socials: 5, scheduleRules: 7, goals: 1 });
    const [hero] = await db.query("select value from site_settings where key = 'hero'");
    expect(hero.value.tagline).toMatch(/Brutal Bosses/);
    const [brand] = await db.query("select value from site_settings where key = 'brand'");
    expect(brand.value.greetingTa).toBe("வணக்கம் நண்பர்களே!");
    const [rule] = await db.query("select to_char(start_time, 'HH24:MI') as t, timezone from schedule_rules limit 1");
    expect(rule).toEqual({ t: "21:00", timezone: "Asia/Kuala_Lumpur" });
    const [discord] = await db.query("select url from social_links where platform = 'discord'");
    expect(discord.url).toBe("https://discord.gg/RdwRFEeb8K");
  });

  it("never overwrites admin edits when re-run", async () => {
    await db.query("update site_settings set value = jsonb_set(value, '{tagline}', '\"Edited by admin\"') where key = 'hero'");
    await db.query("update games set status = 'completed' where slug = 'valor-mortis'");
    await db.query("update social_links set label = 'Discord server' where platform = 'discord'");
    expect(await seed(db)).toEqual({ settings: 0, games: 0, socials: 0, scheduleRules: 0, goals: 0 });
    expect((await db.query("select value->>'tagline' as t from site_settings where key = 'hero'"))[0].t).toBe("Edited by admin");
    expect((await db.query("select status from games where slug = 'valor-mortis'"))[0].status).toBe("completed");
    expect((await db.query("select label from social_links where platform = 'discord'"))[0].label).toBe("Discord server");
  });

  it("returns counts as JSON-safe numbers", async () => {
    const [row] = await db.query("select count(*) as n from games");
    expect(typeof row.n).toBe("number");
  });
});

describe("constraints", () => {
  it("rejects invalid YouTube ids, kinds and live states", async () => {
    await rejects("insert into videos (youtube_id, title, published_at, kind) values ('short', 'T', now(), 'stream')");
    await rejects("insert into videos (youtube_id, title, published_at, kind) values ('AAAAAAAAAAA', 'T', now(), 'podcast')");
    await rejects("insert into videos (youtube_id, title, published_at, kind, live_state) values ('AAAAAAAAAAA', 'T', now(), 'stream', 'paused')");
  });

  it("keeps YouTube ids unique", async () => {
    await videoRow("dupDupDup01");
    await expect(videoRow("dupDupDup01")).rejects.toThrow();
  });

  it("rejects bad slugs, statuses, non-https links and bad colours", async () => {
    await rejects("insert into games (slug, name) values ('Bad Slug', 'X')");
    await rejects("insert into games (slug, name, status) values ('ok-slug', 'X', 'abandoned')");
    await rejects("insert into social_links (platform, label, url) values ('x', 'X', 'javascript:alert(1)')");
    await rejects("insert into social_links (platform, label, url, accent) values ('x', 'X', 'https://x.com', 'red')");
    await rejects("insert into site_settings (key, value) values ('anything', '{}')");
  });

  it("allows only one enabled goal and requires goal > start", async () => {
    await rejects("insert into subscriber_goals (title, start_value, goal_value) values ('Second', 0, 10)");
    await rejects("insert into subscriber_goals (title, start_value, goal_value, enabled) values ('Backwards', 10, 5, false)");
    await db.query("insert into subscriber_goals (title, start_value, goal_value, enabled) values ('Archived', 0, 10, false)");
  });

  it("allows only one channel_stats row", async () => {
    await db.query("insert into channel_stats (channel_id) values ('UC6REYc9lkrj8Em4kjCYsG7A')");
    await rejects("insert into channel_stats (id, channel_id) values (2, 'x')");
  });
});

describe("website overrides vs YouTube data", () => {
  it("survive a YouTube upsert of the same video", async () => {
    await videoRow("ovrOvrOvr01");
    const [game] = await db.query("select id from games where slug = 'bloodborne'");
    await db.query("insert into video_overrides (youtube_id, hidden, featured, game_id) values ('ovrOvrOvr01', true, true, $1)", [game.id]);
    // what sync does: upsert only YouTube-owned columns
    await db.query(`insert into videos (youtube_id, title, published_at, kind, view_count) values ('ovrOvrOvr01', 'New title', now(), 'stream', 99)
      on conflict (youtube_id) do update set title = excluded.title, view_count = excluded.view_count, synced_at = now()`);
    const [row] = await db.query(`select v.title, v.view_count, o.hidden, o.featured, o.game_id from videos v join video_overrides o using (youtube_id) where youtube_id = 'ovrOvrOvr01'`);
    expect(row).toEqual({ title: "New title", view_count: 99, hidden: true, featured: true, game_id: game.id });
  });

  it("deleting a game un-assigns its videos instead of deleting them", async () => {
    await db.query("insert into games (slug, name) values ('temp-game', 'Temp')");
    const [g] = await db.query("select id from games where slug = 'temp-game'");
    await videoRow("tmpTmpTmp01");
    await db.query("insert into video_overrides (youtube_id, game_id) values ('tmpTmpTmp01', $1)", [g.id]);
    await db.query("delete from games where id = $1", [g.id]);
    expect((await db.query("select game_id from video_overrides where youtube_id = 'tmpTmpTmp01'"))[0].game_id).toBeNull();
    expect(await db.query("select 1 from videos where youtube_id = 'tmpTmpTmp01'")).toHaveLength(1);
  });

  it("updates updated_at automatically", async () => {
    const [before] = await db.query("select updated_at from games where slug = 'elden-ring'");
    await new Promise((r) => setTimeout(r, 10));
    await db.query("update games set description = 'GOTY' where slug = 'elden-ring'");
    const [after] = await db.query("select updated_at from games where slug = 'elden-ring'");
    expect(new Date(after.updated_at) > new Date(before.updated_at)).toBe(true);
  });
});

describe("transactions", () => {
  it("roll back completely on error", async () => {
    await expect(db.transaction(async (tx) => {
      await tx.query("insert into games (slug, name) values ('rollback-me', 'R')");
      throw new Error("boom");
    })).rejects.toThrow("boom");
    expect(await db.query("select 1 from games where slug = 'rollback-me'")).toHaveLength(0);
  });
});
