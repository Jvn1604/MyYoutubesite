import { describe, it, expect, beforeAll, afterAll } from "vitest";
import sharp from "sharp";
import { createDb } from "../server/db/client.js";
import { migrate } from "../server/db/migrate.js";
import { seed } from "../server/db/seed.js";
import { createAdmin, login } from "../server/services/auth.js";
import { routeCms } from "../server/controllers/cms/router.js";
import { handle } from "../server/middleware/http.js";
import { removeObjects } from "../server/services/storage.js";

process.env.SESSION_SECRET ??= "test-secret-test-secret-test-secret-0123456789";
const ORIGIN = "https://dephantom.example";

let db, cookie, csrf;
const uploaded = [];
const call = (req) => handle((r) => routeCms(r, db), { methods: ["GET", "POST", "PUT", "PATCH", "DELETE"] })(req, {});

function req(path, { method = "GET", body, auth = true, withCsrf = true, raw } = {}) {
  const headers = new Headers({ origin: ORIGIN });
  if (auth) headers.set("cookie", cookie);
  if (auth && withCsrf && method !== "GET") headers.set("x-csrf-token", csrf);
  if (body !== undefined) headers.set("content-type", "application/json");
  return new Request(`${ORIGIN}/api/cms${path}`, { method, headers, body: raw ?? (body === undefined ? undefined : JSON.stringify(body)) });
}
const send = async (...args) => {
  const res = await call(req(...args));
  return { status: res.status, data: await res.json() };
};

async function uploadReq(buffer, { kind = "game_cover", type = "image/png", name = "x.png" } = {}) {
  const form = new FormData();
  form.append("file", new Blob([buffer], { type }), name);
  form.append("kind", kind);
  form.append("alt", "test image");
  const r = new Request(`${ORIGIN}/api/cms/media`, { method: "POST", headers: { cookie, "x-csrf-token": csrf, origin: ORIGIN }, body: form });
  const res = await call(r);
  const data = await res.json();
  if (res.ok) uploaded.push(data.path, ...Object.values(data.variants));
  return { status: res.status, data };
}

beforeAll(async () => {
  db = await createDb("pglite:memory");
  await migrate(db);
  await seed(db);
  await createAdmin(db, { email: "admin@dephantom.test", password: "correct horse battery staple" });
  const s = await login(db, { email: "admin@dephantom.test", password: "correct horse battery staple", ip: "1.1.1.1" });
  cookie = `__Host-dp_session=${s.token}`;
  csrf = s.csrfToken;
  await db.query(`insert into videos (youtube_id, title, published_at, kind) values ('AAAAAAAAAA1', 'Elden Ring boss', now(), 'stream'), ('AAAAAAAAAA2', 'Random video', now() - interval '1 day', 'video')`);
}, 30_000);
afterAll(async () => {
  await removeObjects(uploaded).catch(() => {});
  await db?.close();
});

describe("access control", () => {
  it("rejects requests without a session", async () => {
    expect((await send("/overview", { auth: false })).status).toBe(401);
  });
  it("rejects writes without the CSRF token", async () => {
    expect((await send("/settings/footer", { method: "PUT", body: { value: { text: "x" } }, withCsrf: false })).status).toBe(403);
  });
  it("404s unknown routes and 405s wrong methods", async () => {
    expect((await send("/nope")).status).toBe(404);
    expect((await send("/overview", { method: "DELETE" })).status).toBe(405);
  });
});

describe("overview & status", () => {
  it("returns dashboard data", async () => {
    const { status, data } = await send("/overview");
    expect(status).toBe(200);
    expect(data.counts).toMatchObject({ streams: 1, videos: 1 });
    expect(data.nextStream.source).toBe("schedule");
    expect(data.youtube.health).toBe("not_configured");
  });
});

describe("settings", () => {
  it("saves valid settings and rejects dangerous or malformed ones", async () => {
    const ok = await send("/settings/footer", { method: "PUT", body: { value: { text: "Game on!" } } });
    expect(ok.status).toBe(200);
    const { data: all } = await send("/settings");
    const hero = all.hero;
    const xss = await send("/settings/hero", { method: "PUT", body: { value: { ...hero, ctas: [{ ...hero.ctas[0], url: "javascript:alert(1)" }] } } });
    expect(xss.status).toBe(400);
    expect(xss.data.error).toMatch(/ctas\.0\.url/);
    expect((await send("/settings/unknown", { method: "PUT", body: { value: {} } })).status).toBe(404);
    expect((await send("/settings/footer", { method: "PUT", body: { value: { text: "x", extra: 1 } } })).status).toBe(400);
  });
  it("keeps the hero first in section order", async () => {
    const { data } = await send("/settings");
    const swapped = [data.sections[1], data.sections[0], ...data.sections.slice(2)];
    expect((await send("/settings/sections", { method: "PUT", body: { value: swapped } })).status).toBe(400);
    const reordered = [data.sections[0], ...data.sections.slice(1).reverse()];
    expect((await send("/settings/sections", { method: "PUT", body: { value: reordered } })).status).toBe(200);
  });
  it("validates colours and timezones", async () => {
    expect((await send("/settings/appearance", { method: "PUT", body: { value: { primary: "red", secondary: "#e04bff", background: "#0a0a0f", radiusScale: 1, motion: "normal" } } })).status).toBe(400);
    const { data } = await send("/settings");
    expect((await send("/settings/schedule", { method: "PUT", body: { value: { ...data.schedule, timezone: "Mars/Olympus" } } })).status).toBe(400);
  });
});

describe("videos", () => {
  it("lists and filters", async () => {
    const { data } = await send("/videos?type=stream");
    expect(data.items.map((v) => v.id)).toEqual(["AAAAAAAAAA1"]);
    expect((await send("/videos?q=random")).data.total).toBe(1);
    expect((await send("/videos?type=<x>")).status).toBe(400);
  });
  it("saves website overrides, locks the game, never touches YouTube data", async () => {
    const [game] = await db.query("select id from games where slug = 'bloodborne'");
    const { status, data } = await send("/videos/AAAAAAAAAA1", { method: "PATCH", body: { hidden: true, featured: true, gameId: game.id, customDescription: "Website only" } });
    expect(status).toBe(200);
    expect(data).toMatchObject({ hidden: true, featured: true, gameId: game.id, gameLocked: true, customDescription: "Website only", title: "Elden Ring boss" });
    expect((await send("/videos/AAAAAAAAAA1", { method: "PATCH", body: { gameId: 999999 } })).status).toBe(404);
    expect((await send("/videos/NOPENOPENO1", { method: "PATCH", body: { hidden: true } })).status).toBe(404);
  });
});

describe("games", () => {
  let id;
  const base = { name: "Lies of P", slug: "lies-of-p", status: "upcoming", genre: "Soulslike", releaseYear: 2023, description: "", coverMediaId: null, bannerMediaId: null, playlistUrl: "", titleKeywords: ["lies of p"], featured: false, hidden: false };
  it("creates, updates and rejects duplicate slugs", async () => {
    const created = await send("/games", { method: "POST", body: base });
    expect(created.status).toBe(200);
    id = created.data.id;
    expect((await send("/games", { method: "POST", body: base })).status).toBe(409);
    const updated = await send(`/games/${id}`, { method: "PUT", body: { ...base, status: "playing" } });
    expect(updated.data.status).toBe("playing");
    expect((await send("/games", { method: "POST", body: { ...base, slug: "Bad Slug!" } })).status).toBe(400);
    expect((await send("/games", { method: "POST", body: { ...base, slug: "evil", playlistUrl: "https://evil.example/x" } })).status).toBe(400);
  });
  it("reorders", async () => {
    const { data: games } = await send("/games");
    const ids = games.map((g) => g.id).reverse();
    expect((await send("/games/reorder", { method: "POST", body: { ids } })).status).toBe(200);
    expect((await send("/games")).data[0].id).toBe(ids[0]);
  });
  it("deletes without deleting videos", async () => {
    await db.query("insert into video_overrides (youtube_id, game_id) values ('AAAAAAAAAA2', $1)", [id]);
    expect((await send(`/games/${id}`, { method: "DELETE" })).status).toBe(200);
    expect(await db.query("select game_id from video_overrides where youtube_id = 'AAAAAAAAAA2'")).toEqual([{ game_id: null }]);
    expect((await send(`/games/${id}`, { method: "DELETE" })).status).toBe(404);
  });
});

describe("schedule", () => {
  it("replaces the weekly rules atomically and rejects duplicates", async () => {
    const rules = [{ weekday: 6, time: "20:00", title: "Saturday Special", enabled: true }, { weekday: 1, time: "21:30", title: "", enabled: true }];
    const { data } = await send("/schedule/rules", { method: "PUT", body: { rules } });
    expect(data.rules).toEqual([{ weekday: 1, time: "21:30", title: "", enabled: true }, { weekday: 6, time: "20:00", title: "Saturday Special", enabled: true }]);
    expect((await send("/schedule/rules", { method: "PUT", body: { rules: [rules[0], rules[0]] } })).status).toBe(400);
    expect((await send("/schedule/rules", { method: "PUT", body: { rules: [{ ...rules[0], time: "25:00" }] } })).status).toBe(400);
  });
  it("manages special events", async () => {
    const created = await send("/schedule/events", { method: "POST", body: { startsAt: "2030-01-04T12:00:00.000Z", title: "Boss rush", description: "", enabled: true } });
    expect(created.status).toBe(200);
    expect((await send(`/schedule/events/${created.data.id}`, { method: "DELETE" })).status).toBe(200);
  });
});

describe("goals", () => {
  it("keeps only one goal active", async () => {
    const g = { title: "Road to 2,000", description: "", startValue: 1652, goalValue: 2000, deadline: "2027-06-01", enabled: true, celebrate: true };
    expect((await send("/goals", { method: "POST", body: g })).status).toBe(200);
    const { data } = await send("/goals");
    expect(data.goals.filter((x) => x.enabled)).toHaveLength(1);
    expect(data.goals.find((x) => x.enabled).title).toBe("Road to 2,000");
    expect((await send("/goals", { method: "POST", body: { ...g, goalValue: 10 } })).status).toBe(400);
  });
});

describe("social links", () => {
  it("creates with validation and reorders", async () => {
    const link = { platform: "tiktok", label: "TikTok", description: "", url: "https://tiktok.com/@dephantom", icon: "link", accent: null, enabled: true };
    const created = await send("/socials", { method: "POST", body: link });
    expect(created.status).toBe(200);
    expect((await send("/socials", { method: "POST", body: { ...link, url: "http://insecure.example" } })).status).toBe(400);
    const { data: all } = await send("/socials");
    const ids = [created.data.id, ...all.map((s) => s.id).filter((i) => i !== created.data.id)];
    await send("/socials/reorder", { method: "POST", body: { ids } });
    expect((await send("/socials")).data[0].label).toBe("TikTok");
  });
});

describe("media", () => {
  it("re-encodes uploads to WebP + AVIF variants", async () => {
    const png = await sharp({ create: { width: 900, height: 1200, channels: 3, background: "#a855f7" } }).png().toBuffer();
    const { status, data } = await uploadReq(png);
    expect(status).toBe(200);
    expect(data).toMatchObject({ mime: "image/webp", width: 900, height: 1200, kind: "game_cover", alt: "test image" });
    expect(Object.keys(data.variants).sort()).toEqual(["avif_800", "webp_400", "webp_800"]);
    expect(data.url).toMatch(/^\/media\/game_cover\/\d{4}\/[0-9a-f]+\.webp$/);
  });
  it("rejects non-images, disguised files, SVG and tiny images", async () => {
    expect((await uploadReq(Buffer.from("<script>alert(1)</script>"), { type: "image/png" })).status).toBe(422);
    expect((await uploadReq(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'), { type: "image/svg+xml", name: "x.svg" })).status).toBe(422);
    const tiny = await sharp({ create: { width: 10, height: 10, channels: 3, background: "#000" } }).png().toBuffer();
    expect((await uploadReq(tiny)).data.error).toMatch(/too small/);
    expect((await uploadReq(Buffer.alloc(10), { kind: "not-a-kind" })).status).toBe(400);
  });
  it("explains missing storage configuration in production instead of failing with 500", async () => {
    const saved = { vitest: process.env.VITEST, context: process.env.CONTEXT };
    delete process.env.VITEST;
    process.env.CONTEXT = "production";
    try {
      const png = await sharp({ create: { width: 300, height: 300, channels: 3, background: "#000" } }).png().toBuffer();
      const { status, data } = await uploadReq(png);
      expect(status).toBe(503);
      expect(data.error).toMatch(/SUPABASE_URL/);
    } finally {
      process.env.VITEST = saved.vitest;
      if (saved.context === undefined) delete process.env.CONTEXT; else process.env.CONTEXT = saved.context;
    }
  });

  it("refuses to delete an image that's in use", async () => {
    const png = await sharp({ create: { width: 300, height: 400, channels: 3, background: "#e04bff" } }).png().toBuffer();
    const { data: m } = await uploadReq(png);
    const [game] = await db.query("select id from games limit 1");
    await db.query("update games set cover_media_id = $1 where id = $2", [m.id, game.id]);
    expect((await send(`/media/${m.id}`, { method: "DELETE" })).status).toBe(409);
    await db.query("update games set cover_media_id = null where id = $1", [game.id]);
    expect((await send(`/media/${m.id}`, { method: "DELETE" })).status).toBe(200);
  });
});

describe("youtube & analytics", () => {
  it("reports status and refuses manual sync without an API key", async () => {
    const saved = process.env.YOUTUBE_API_KEY;
    delete process.env.YOUTUBE_API_KEY;
    expect((await send("/youtube")).data).toMatchObject({ apiKeyConfigured: false, health: "not_configured" });
    expect((await send("/youtube/sync", { method: "POST", body: { job: "live" } })).status).toBe(409);
    if (saved) process.env.YOUTUBE_API_KEY = saved;
  });
  it("aggregates click events", async () => {
    await db.query("insert into site_events (event, target) values ('subscribe_click', null), ('subscribe_click', null), ('watch_video', 'AAAAAAAAAA1')");
    const { data } = await send("/analytics?days=30");
    expect(data.events[0]).toEqual({ event: "subscribe_click", count: 2 });
    expect(data.topTargets[0]).toMatchObject({ event: "watch_video", target: "AAAAAAAAAA1" });
  });
});
