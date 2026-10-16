import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { createDb } from "../server/db/client.js";
import { migrate } from "../server/db/migrate.js";
import { putObject, publicUrl } from "../server/services/storage.js";

describe("storage path safety", () => {
  it.each([
    "../../.env",
    "game_cover/2026/../../../secret.webp",
    "game_cover/2026/abc.svg",
    "/etc/passwd",
    "game_cover\\2026\\abc.webp",
    "GAME/2026/abc.webp",
  ])("refuses %s", async (path) => {
    await expect(putObject(path, Buffer.from("x"), "image/webp")).rejects.toThrow(/unsafe media path/);
  });
  it("builds local URLs in dev/tests", () => {
    expect(publicUrl("game_cover/2026/abc123.webp")).toBe("/media/game_cover/2026/abc123.webp");
  });
});

describe("/api/events", () => {
  let db;
  beforeAll(async () => {
    db = await createDb("pglite:memory");
    await migrate(db);
    vi.doMock("../server/db/client.js", () => ({ withDb: (fn) => fn(db) }));
  }, 30_000);
  afterAll(() => db?.close());

  const post = async (body, raw) => {
    const { default: events } = await import("../netlify/functions/events.mjs");
    return events(new Request("https://x.example/api/events", { method: "POST", headers: { "content-type": "application/json" }, body: raw ?? JSON.stringify(body) }), {});
  };

  it("stores valid events without any personal data", async () => {
    expect((await post({ event: "subscribe_click", target: "hero" })).status).toBe(202);
    const rows = await db.query("select * from site_events");
    expect(rows).toHaveLength(1);
    expect(Object.keys(rows[0]).sort()).toEqual(["created_at", "event", "id", "target"]);
  });

  it.each([
    [{ event: "DROP TABLE" }],
    [{ event: "x".repeat(41) }],
    [{}],
    [{ event: 42 }],
  ])("rejects %j", async (body) => {
    expect((await post(body)).status).toBe(400);
  });

  it("drops an invalid target but keeps the event", async () => {
    expect((await post({ event: "watch_video", target: "<script>" })).status).toBe(202);
    const [row] = await db.query("select target from site_events where event = 'watch_video'");
    expect(row.target).toBeNull();
  });

  it("rejects malformed JSON and GET", async () => {
    expect((await post(null, "{not json")).status).toBe(400);
    const { default: events } = await import("../netlify/functions/events.mjs");
    expect((await events(new Request("https://x.example/api/events"), {})).status).toBe(405);
  });
});
