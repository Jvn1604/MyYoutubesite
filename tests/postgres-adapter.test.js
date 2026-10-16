/**
 * Runs the production driver (postgres.js) against a real Postgres wire server
 * (PGlite socket server, in-process), so adapter differences between PGlite and
 * Supabase are caught — e.g. JSON params being double-encoded.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { createDb } from "../server/db/client.js";
import { migrate } from "../server/db/migrate.js";
import { seed } from "../server/db/seed.js";
import { upsertVideos } from "../server/repositories/youtube-data.js";
import { loadContentFromDb } from "../server/repositories/content.js";

const PORT = 54398;
let pg, server, db;

beforeAll(async () => {
  pg = new PGlite();
  await pg.waitReady;
  server = new PGLiteSocketServer({ db: pg, port: PORT, host: "127.0.0.1", maxConnections: 1 });
  await server.start();
  db = await createDb(`postgres://postgres:postgres@127.0.0.1:${PORT}/postgres`);
  expect(db.kind).toBe("postgres");
  await migrate(db);
  await seed(db);
}, 30_000);

afterAll(async () => {
  await db?.close();
  await server?.stop();
  await pg?.close();
});

describe("postgres.js adapter", () => {
  it("stores JSON settings as objects, not strings", async () => {
    const [row] = await db.query("select jsonb_typeof(value) as t, value from site_settings where key = 'hero'");
    expect(row.t).toBe("object");
    expect(row.value.tagline).toMatch(/Brutal Bosses/);
  });

  it("round-trips JSON through json_to_recordset upserts", async () => {
    await upsertVideos(db, [{
      youtubeId: "PGdriver001", title: "Driver test", description: "", publishedAt: "2026-10-16T00:00:00Z", durationSeconds: 60,
      thumbnails: { high: "https://i.ytimg.com/vi/PGdriver001/hqdefault.jpg" }, kind: "video", liveState: "none",
      viewCount: 12, isAvailable: true,
    }]);
    const [v] = await db.query("select jsonb_typeof(thumbnails) as t, thumbnails, view_count from videos where youtube_id = 'PGdriver001'");
    expect(v).toEqual({ t: "object", thumbnails: { high: "https://i.ytimg.com/vi/PGdriver001/hqdefault.jpg" }, view_count: 12 });
  });

  it("returns counts as numbers and loads site content", async () => {
    const [row] = await db.query("select count(*) as n from games");
    expect(row.n).toBe(11);
    const content = await loadContentFromDb(db);
    expect(content.settings.brand.greetingTa).toBe("வணக்கம் நண்பர்களே!");
    expect(content.goal.deadline).toBe("2027-01-16");
  });
});
