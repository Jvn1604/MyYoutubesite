/**
 * Server-side <head> tags for the homepage, built from the same /api/site payload
 * the page uses. Link-preview bots (WhatsApp, Discord, X, Facebook) don't run
 * JavaScript, so these must be in the HTML response itself.
 * Pure + dependency-free: runs in Node (tests) and Deno (Netlify Edge).
 */

const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ESC[c]);

/** JSON for <script type="application/ld+json">: escape "<" so "</script>" can't break out. */
const ldJson = (data) => JSON.stringify(data).replace(/</g, "\\u003c");

const abs = (url, siteUrl) => {
  if (!url) return "";
  try { return new URL(url, siteUrl).href; } catch { return ""; }
};

/** seconds → ISO 8601 duration (PT1H2M3S) */
export function isoDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return undefined;
  const h = Math.floor(seconds / 3600), m = Math.floor((seconds % 3600) / 60), s = Math.floor(seconds % 60);
  return `PT${h ? `${h}H` : ""}${m ? `${m}M` : ""}${s || (!h && !m) ? `${s}S` : ""}`;
}

function videoObject(v) {
  return {
    "@type": "VideoObject",
    name: v.title,
    description: v.note || v.description?.slice(0, 300) || v.title,
    thumbnailUrl: [v.thumbnails?.maxres, v.thumbnails?.high].filter(Boolean),
    uploadDate: v.publishedAt,
    duration: isoDuration(v.durationSeconds),
    contentUrl: v.url,
    embedUrl: `https://www.youtube.com/embed/${v.id}`,
    ...(v.views != null ? { interactionStatistic: { "@type": "InteractionCounter", interactionType: { "@type": "WatchAction" }, userInteractionCount: v.views } } : {}),
    ...(v.liveState === "live" || v.liveState === "upcoming" ? {
      publication: {
        "@type": "BroadcastEvent",
        isLiveBroadcast: true,
        startDate: v.actualStart || v.scheduledStart || v.publishedAt,
      },
    } : {}),
  };
}

/** Structured data: Person (the creator), WebSite, and the newest videos. */
export function structuredData(payload, siteUrl) {
  const { settings, channel, socials = [], latest, recentStreams = [], live } = payload;
  const name = `${settings.brand.name} ${settings.brand.nameTa}`.trim();
  const person = {
    "@type": "Person",
    "@id": `${siteUrl}#creator`,
    name,
    alternateName: settings.brand.name,
    url: siteUrl,
    image: abs(settings.about?.photoUrl || channel?.avatarUrl || settings.brand.logoUrl, siteUrl),
    description: settings.seo?.description,
    jobTitle: "Gaming livestreamer",
    knowsLanguage: ["ta", "en"],
    sameAs: [settings.links?.channel, ...socials.map((s) => s.url)].filter((u) => /^https:\/\//.test(u ?? "")),
  };
  const website = {
    "@type": "WebSite",
    "@id": `${siteUrl}#website`,
    url: siteUrl,
    name,
    inLanguage: ["en", "ta"],
    publisher: { "@id": `${siteUrl}#creator` },
  };
  const videos = [live?.state === "live" ? live.video : null, latest?.upload, latest?.stream, ...recentStreams]
    .filter(Boolean)
    .filter((v, i, all) => all.findIndex((x) => x.id === v.id) === i)
    .slice(0, 6)
    .map(videoObject);
  const graph = [person, website];
  if (videos.length) graph.push({ "@type": "ItemList", name: "Latest videos", itemListElement: videos.map((item, i) => ({ "@type": "ListItem", position: i + 1, item })) });
  return { "@context": "https://schema.org", "@graph": graph };
}

/** The full block that replaces <!-- seo:start --> … <!-- seo:end --> in index.html. */
export function headTags(payload, siteUrl) {
  const { settings, channel, live } = payload;
  const seo = settings.seo ?? {};
  const isLive = live?.state === "live";
  const title = isLive ? `🔴 LIVE: ${live.video.title} | ${settings.brand.name}` : seo.title;
  const description = seo.description;
  const image = abs(seo.ogImageUrl || channel?.bannerUrl || settings.brand.logoUrl, siteUrl);
  const url = siteUrl;
  const tags = [
    `<title>${esc(title)}</title>`,
    `<meta name="description" content="${esc(description)}">`,
    `<link rel="canonical" href="${esc(url)}">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="${esc(`${settings.brand.name} ${settings.brand.nameTa}`.trim())}">`,
    `<meta property="og:title" content="${esc(title)}">`,
    `<meta property="og:description" content="${esc(description)}">`,
    `<meta property="og:url" content="${esc(url)}">`,
    `<meta property="og:locale" content="en_IN">`,
    `<meta property="og:locale:alternate" content="ta_IN">`,
    image ? `<meta property="og:image" content="${esc(image)}">` : "",
    image ? `<meta property="og:image:alt" content="${esc(`${settings.brand.name} channel banner`)}">` : "",
    `<meta name="twitter:card" content="${image ? "summary_large_image" : "summary"}">`,
    `<meta name="twitter:title" content="${esc(title)}">`,
    `<meta name="twitter:description" content="${esc(description)}">`,
    image ? `<meta name="twitter:image" content="${esc(image)}">` : "",
    seo.twitterHandle ? `<meta name="twitter:site" content="${esc(seo.twitterHandle)}">` : "",
    `<script type="application/ld+json">${ldJson(structuredData(payload, siteUrl))}</script>`,
  ];
  return tags.filter(Boolean).join("\n  ");
}

// The start marker may carry a note: <!-- seo:start: … -->
export const SEO_BLOCK = /<!-- seo:start[^>]*-->[\s\S]*?<!-- seo:end -->/;

export function injectHead(html, payload, siteUrl) {
  if (!SEO_BLOCK.test(html)) return html;
  return html.replace(SEO_BLOCK, `<!-- seo:start -->\n  ${headTags(payload, siteUrl)}\n  <!-- seo:end -->`);
}

/** sitemap.xml for a single-page site (lastmod = newest content). */
export function sitemap(siteUrl, lastmod) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${esc(siteUrl)}</loc>${lastmod ? `<lastmod>${esc(lastmod.slice(0, 10))}</lastmod>` : ""}<changefreq>daily</changefreq><priority>1.0</priority></url>
</urlset>
`;
}
