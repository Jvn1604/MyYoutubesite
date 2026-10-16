/**
 * Failure behaviour of the public endpoints: the site must keep working
 * (or degrade cleanly) when the database or YouTube is unavailable.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fx from "../server/fixtures/dev-data.js";

const content = () => structuredClone({ settings: fx.settings, channel: fx.channel, videos: fx.videos, games: fx.games, schedule: fx.schedule, goal: fx.goal, socials: fx.socials });

const loadContent = vi.fn();
vi.mock("../server/services/content-source.js", () => ({
  loadContent: (...a) => loadContent(...a),
  applyDevMock: (c) => c,
}));

const req = (path) => new Request(`https://dephantom.example${path}`);

describe("/api/site", () => {
  beforeEach(() => { vi.resetModules(); loadContent.mockReset(); vi.spyOn(console, "error").mockImplementation(() => {}); });
  afterEach(() => vi.restoreAllMocks());

  it("is CDN-cached but always revalidated by browsers", async () => {
    loadContent.mockResolvedValue(content());
    const { default: site } = await import("../netlify/functions/site.mjs");
    const res = await site(req("/api/site"), {});
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("public, max-age=0, must-revalidate");
    expect(res.headers.get("netlify-cdn-cache-control")).toMatch(/s-maxage=60.*stale-if-error=86400/);
  });

  it("serves the last good payload (marked stale) when the database fails", async () => {
    const { default: site } = await import("../netlify/functions/site.mjs");
    loadContent.mockResolvedValueOnce(content());
    const good = await (await site(req("/api/site"), {})).json();
    loadContent.mockRejectedValueOnce(new Error("connection refused"));
    const res = await site(req("/api/site"), {});
    expect(res.status).toBe(200);
    expect(res.headers.get("x-content-stale")).toBe("1");
    expect((await res.json()).settings.hero.tagline).toBe(good.settings.hero.tagline);
  });

  it("returns a clean 503 (no internals) if it never loaded successfully", async () => {
    loadContent.mockRejectedValue(new Error("password authentication failed for user postgres"));
    const { default: site } = await import("../netlify/functions/site.mjs");
    const res = await site(req("/api/site"), {});
    expect(res.status).toBe(503);
    expect(JSON.stringify(await res.json())).not.toMatch(/password|postgres/);
  });
});

describe("/api/videos", () => {
  beforeEach(() => { vi.resetModules(); loadContent.mockReset(); vi.spyOn(console, "error").mockImplementation(() => {}); });
  afterEach(() => vi.restoreAllMocks());

  it("degrades to 503 when content can't load", async () => {
    loadContent.mockRejectedValue(new Error("db down"));
    const { default: videos } = await import("../netlify/functions/videos.mjs");
    expect((await videos(req("/api/videos"), {})).status).toBe(503);
  });

  it("rejects non-GET methods", async () => {
    const { default: videos } = await import("../netlify/functions/videos.mjs");
    expect((await videos(new Request("https://x.example/api/videos", { method: "POST" }), {})).status).toBe(405);
  });
});

describe("edge SEO injection", () => {
  const html = "<html><head><!-- seo:start --><title>Default</title><!-- seo:end --></head><body></body></html>";
  const context = { next: async () => new Response(html, { headers: { "content-type": "text/html" } }) };
  beforeEach(() => { vi.resetModules(); globalThis.Netlify = { env: { get: () => "https://dephantom.example" } }; });
  afterEach(() => { delete globalThis.Netlify; vi.unstubAllGlobals(); });

  it("injects CMS-driven tags when the API answers", async () => {
    const { buildSitePayload } = await import("../server/services/site-payload.js");
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify(buildSitePayload(content())), { headers: { "content-type": "application/json" } }));
    const { default: edge } = await import("../netlify/edge-functions/seo.js");
    const res = await edge(new Request("https://dephantom.example/"), context);
    const out = await res.text();
    expect(out).toContain('<link rel="canonical" href="https://dephantom.example/">');
    expect(out).toContain("application/ld+json");
    expect(res.headers.get("content-type")).toBe("text/html; charset=utf-8");
  });

  it("serves the untouched page if the API is down", async () => {
    vi.stubGlobal("fetch", async () => { throw new Error("offline"); });
    const { default: edge } = await import("../netlify/edge-functions/seo.js");
    const out = await (await edge(new Request("https://dephantom.example/"), context)).text();
    expect(out).toBe(html);
  });

  it("leaves non-HTML responses alone", async () => {
    const { default: edge } = await import("../netlify/edge-functions/seo.js");
    const json = new Response("{}", { headers: { "content-type": "application/json" } });
    expect(await edge(new Request("https://dephantom.example/"), { next: async () => json })).toBe(json);
  });
});
