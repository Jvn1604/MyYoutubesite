import { describe, it, expect } from "vitest";
import { headTags, injectHead, structuredData, isoDuration, sitemap } from "../server/services/seo.js";
import { buildSitePayload } from "../server/services/site-payload.js";
import * as fx from "../server/fixtures/dev-data.js";

const SITE = "https://dephantom.example/";
const payload = (patch = (c) => c) => buildSitePayload(patch(structuredClone({
  settings: fx.settings, channel: fx.channel, videos: fx.videos, games: fx.games, schedule: fx.schedule, goal: fx.goal, socials: fx.socials,
})));

describe("isoDuration", () => {
  it.each([[13325, "PT3H42M5S"], [754, "PT12M34S"], [45, "PT45S"], [3600, "PT1H"], [0, undefined], [null, undefined]])("%s → %s", (s, iso) => expect(isoDuration(s)).toBe(iso));
});

describe("head tags", () => {
  it("includes title, description, canonical, Open Graph, Twitter and JSON-LD", () => {
    const tags = headTags(payload(), SITE);
    expect(tags).toContain("<title>DePhantom தமிழ் | Tamil Gaming Livestreams</title>");
    expect(tags).toMatch(/<meta name="description" content="DePhantom தமிழ் – Tamil gaming/);
    expect(tags).toContain(`<link rel="canonical" href="${SITE}">`);
    expect(tags).toMatch(/<meta property="og:image" content="https:\/\/yt3\.googleusercontent\.com/);
    expect(tags).toContain('<meta name="twitter:card" content="summary_large_image">');
    expect(tags).toContain('<script type="application/ld+json">');
  });

  it("escapes admin-provided text", () => {
    const tags = headTags(payload((c) => { c.settings.seo.title = `"><script>alert(1)</script>`; return c; }), SITE);
    expect(tags).not.toContain("<script>alert(1)");
    expect(tags).toContain("&quot;&gt;&lt;script&gt;");
  });

  it("can't break out of the JSON-LD script", () => {
    const tags = headTags(payload((c) => { c.videos[0].title = "</script><script>alert(1)</script>"; return c; }), SITE);
    const ld = tags.slice(tags.indexOf("application/ld+json"));
    expect(ld.match(/<\/script>/g)).toHaveLength(1); // only the real closing tag
  });

  it("announces live streams in the title and structured data", () => {
    const p = payload((c) => {
      c.videos.unshift({ ...c.videos[0], id: "LiveLiveLv1", title: "Boss rush", liveState: "live", actualStart: "2026-10-16T13:00:00Z" });
      return c;
    });
    expect(headTags(p, SITE)).toContain("<title>🔴 LIVE: Boss rush | DePhantom</title>");
    const live = structuredData(p, SITE)["@graph"][2].itemListElement[0].item;
    expect(live.publication).toMatchObject({ "@type": "BroadcastEvent", isLiveBroadcast: true });
  });

  it("injects into the marked block only", () => {
    const html = "<head>\n  <!-- seo:start --><title>old</title><!-- seo:end -->\n</head>";
    const out = injectHead(html, payload(), SITE);
    expect(out).not.toContain("<title>old</title>");
    expect(out.match(/<!-- seo:start -->/g)).toHaveLength(1);
    expect(injectHead("<head></head>", payload(), SITE)).toBe("<head></head>");
  });
});

describe("structured data", () => {
  it("describes the creator with only https profile links", () => {
    const graph = structuredData(payload(), SITE)["@graph"];
    const person = graph.find((n) => n["@type"] === "Person");
    expect(person.name).toBe("DePhantom தமிழ்");
    expect(person.sameAs).toContain("https://discord.gg/RdwRFEeb8K");
    expect(person.sameAs.every((u) => u.startsWith("https://"))).toBe(true);
    const videos = graph.find((n) => n["@type"] === "ItemList").itemListElement;
    expect(videos[0].item).toMatchObject({ "@type": "VideoObject", embedUrl: "https://www.youtube.com/embed/7utpCWTZQpg" });
  });
});

describe("sitemap", () => {
  it("lists the homepage with lastmod", () => {
    const xml = sitemap(SITE, "2026-10-14T13:00:00.000Z");
    expect(xml).toContain(`<loc>${SITE}</loc>`);
    expect(xml).toContain("<lastmod>2026-10-14</lastmod>");
  });
});
