import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createDb } from "../server/db/client.js";
import { migrate } from "../server/db/migrate.js";
import { seed } from "../server/db/seed.js";
import { exportWebsite, restoreWebsite } from "../server/db/backup.js";

let source, target;
beforeAll(async () => {
  source = await createDb("pglite:memory");
  target = await createDb("pglite:memory");
  for (const db of [source, target]) { await migrate(db); await seed(db); }
  // Customise the source like an admin would
  await source.query("update site_settings set value = jsonb_set(value, '{tagline}', '\"Backed up tagline\"') where key = 'hero'");
  await source.query("insert into media (kind, path, mime, width, height, bytes) values ('game_cover', 'game_cover/2026/abc123.webp', 'image/webp', 600, 800, 1234)");
  const [m] = await source.query("select id from media");
  await source.query("insert into games (slug, name, cover_media_id) values ('lies-of-p', 'Lies of P', $1)", [m.id]);
  await source.query("insert into schedule_events (starts_at, title) values ('2030-01-05T12:00:00Z', 'Saturday Special')");
  for (const db of [source, target]) {
    await db.query("insert into videos (youtube_id, title, published_at, kind) values ('BackupVid01', 'Kept', now(), 'video')");
  }
  await source.query("insert into videos (youtube_id, title, published_at, kind) values ('OnlySource1', 'Not in target', now(), 'video')");
  const [g] = await source.query("select id from games where slug = 'lies-of-p'");
  await source.query("insert into video_overrides (youtube_id, featured, game_id, custom_description) values ('BackupVid01', true, $1, 'note'), ('OnlySource1', true, null, null)", [g.id]);
}, 30_000);
afterAll(async () => { await source?.close(); await target?.close(); });

describe("website backup", () => {
  it("excludes YouTube data and admin accounts", async () => {
    const data = await exportWebsite(source);
    expect(Object.keys(data.tables)).not.toContain("videos");
    expect(Object.keys(data.tables)).not.toContain("admins");
    expect(Object.keys(data.tables)).not.toContain("sessions");
  });

  it("round-trips into another database, keeping ids and relations", async () => {
    const data = JSON.parse(JSON.stringify(await exportWebsite(source))); // as if read from disk
    const { skippedOverrides } = await restoreWebsite(target, data);
    expect(skippedOverrides).toBe(1); // OnlySource1 isn't synced in the target yet

    const [hero] = await target.query("select value->>'tagline' as t from site_settings where key = 'hero'");
    expect(hero.t).toBe("Backed up tagline");
    const [game] = await target.query("select g.name, m.path from games g join media m on m.id = g.cover_media_id where g.slug = 'lies-of-p'");
    expect(game).toEqual({ name: "Lies of P", path: "game_cover/2026/abc123.webp" });
    const [ov] = await target.query("select o.featured, o.custom_description, g.slug from video_overrides o join games g on g.id = o.game_id");
    expect(ov).toEqual({ featured: true, custom_description: "note", slug: "lies-of-p" });
    expect(await target.query("select title from schedule_events")).toEqual([{ title: "Saturday Special" }]);
  });

  it("keeps identity sequences ahead so new rows don't collide", async () => {
    await target.query("insert into games (slug, name) values ('after-restore', 'New game')");
    expect(await target.query("select 1 from games where slug = 'after-restore'")).toHaveLength(1);
  });

  it("rejects files that aren't backups and leaves data untouched", async () => {
    await expect(restoreWebsite(target, { tables: {} })).rejects.toThrow(/isn't a DePhantom website backup/);
    expect((await target.query("select count(*)::int as n from games"))[0].n).toBeGreaterThan(0);
  });
});
