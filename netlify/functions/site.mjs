import { handle, json } from "../../server/middleware/http.js";
import { loadContent, applyDevMock } from "../../server/services/content-source.js";
import { buildSitePayload } from "../../server/services/site-payload.js";

// Homepage payload. Cached at the CDN so visitors never hit the database/YouTube directly.
export default handle(async (req) => {
  const mock = new URL(req.url).searchParams.get("mock");
  const content = applyDevMock(await loadContent(), mock);
  return json(buildSitePayload(content), {
    headers: { "Cache-Control": mock ? "no-store" : "public, max-age=0, s-maxage=60, stale-while-revalidate=300" },
  });
});

export const config = { path: "/api/site" };
