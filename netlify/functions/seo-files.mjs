import { handle } from "../../server/middleware/http.js";
import { env } from "../../server/config.js";
import { loadContent } from "../../server/services/content-source.js";
import { sitemap } from "../../server/services/seo.js";

// /robots.txt and /sitemap.xml with absolute URLs from SITE_URL.
const siteUrl = (req) => {
  const configured = env("SITE_URL");
  return new URL("/", configured && !configured.includes("localhost") ? configured : req.url).href;
};

export default handle(async (req) => {
  const base = siteUrl(req);
  if (new URL(req.url).pathname === "/robots.txt") {
    const body = [
      "User-agent: *",
      "Allow: /",
      "Disallow: /admin/",
      "Disallow: /api/",
      "",
      `Sitemap: ${base}sitemap.xml`,
      "",
    ].join("\n");
    return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
  }

  let lastmod = null;
  try {
    const { videos } = await loadContent();
    lastmod = videos.map((v) => v.publishedAt).filter(Boolean).sort().at(-1) ?? null;
  } catch { /* sitemap still valid without lastmod */ }
  return new Response(sitemap(base, lastmod), { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=0, must-revalidate", "Netlify-CDN-Cache-Control": "public, s-maxage=3600" } });
});

export const config = { path: ["/robots.txt", "/sitemap.xml"] };
