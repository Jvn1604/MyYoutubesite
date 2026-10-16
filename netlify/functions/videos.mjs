import { handle, json, error } from "../../server/middleware/http.js";
import { loadContent } from "../../server/services/content-source.js";
import { parseVideoQuery, queryVideos } from "../../server/services/site-payload.js";

// Video library: filter by type/game, search, paginate.
export default handle(async (req) => {
  const query = parseVideoQuery(new URL(req.url).searchParams);
  let content;
  try {
    content = await loadContent();
  } catch (err) {
    console.error("[api/videos] content load failed:", err.message);
    return error(503, "Videos temporarily unavailable");
  }
  return json(queryVideos(content, query), {
    headers: { "Cache-Control": "public, max-age=0, s-maxage=120, stale-while-revalidate=600, stale-if-error=86400" },
  });
});

export const config = { path: "/api/videos" };
