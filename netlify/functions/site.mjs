import { handle, json, error } from "../../server/middleware/http.js";
import { loadContent, applyDevMock } from "../../server/services/content-source.js";
import { buildSitePayload } from "../../server/services/site-payload.js";

// Last payload this warm instance served successfully: returned if the DB is briefly unreachable.
let lastGood = null;

// Homepage payload. CDN-cached so visitors never hit the database or YouTube directly.
export default handle(async (req) => {
  const mock = new URL(req.url).searchParams.get("mock");
  try {
    const payload = buildSitePayload(applyDevMock(await loadContent(), mock));
    if (!mock) lastGood = payload;
    return json(payload, {
      headers: { "Cache-Control": mock ? "no-store" : "public, max-age=0, s-maxage=60, stale-while-revalidate=300, stale-if-error=86400" },
    });
  } catch (err) {
    console.error("[api/site] content load failed:", err.message);
    if (lastGood) return json(lastGood, { headers: { "Cache-Control": "public, max-age=0, s-maxage=30", "X-Content-Stale": "1" } });
    return error(503, "Content temporarily unavailable");
  }
});

export const config = { path: "/api/site" };
