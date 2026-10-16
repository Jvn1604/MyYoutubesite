import { handle, json } from "../../server/middleware/http.js";
import { loadContent } from "../../server/services/content-source.js";
import { parseVideoQuery, queryVideos } from "../../server/services/site-payload.js";

// Video library: filter by type/game, search, paginate.
export default handle(async (req) => {
  const query = parseVideoQuery(new URL(req.url).searchParams);
  const content = await loadContent();
  return json(queryVideos(content, query), {
    headers: { "Cache-Control": "public, max-age=0, s-maxage=120, stale-while-revalidate=600" },
  });
});

export const config = { path: "/api/videos" };
