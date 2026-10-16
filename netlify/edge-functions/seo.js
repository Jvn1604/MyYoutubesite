/**
 * Injects SEO / social-preview tags + JSON-LD into the homepage HTML at the edge.
 * Uses the CDN-cached /api/site payload, so it adds no database load.
 * If anything fails, the static defaults in index.html are served unchanged.
 */
import { injectHead } from "../../server/services/seo.js";

export default async (request, context) => {
  const response = await context.next();
  if (!response.headers.get("content-type")?.includes("text/html")) return response;

  let payload = null;
  try {
    const res = await fetch(new URL("/api/site", request.url), { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(2500) });
    if (res.ok) payload = await res.json();
  } catch {
    // fall through: static defaults
  }
  if (!payload?.settings) return response;

  const configured = Netlify.env.get("SITE_URL");
  const siteUrl = new URL("/", configured && !configured.includes("localhost") ? configured : request.url).href;
  const html = injectHead(await response.text(), payload, siteUrl);

  const headers = new Headers(response.headers);
  headers.delete("content-length");
  headers.delete("etag");
  headers.set("content-type", "text/html; charset=utf-8");
  return new Response(html, { status: response.status, headers });
};

export const config = { path: "/", excludedPath: ["/admin/*", "/api/*", "/media/*"] };
