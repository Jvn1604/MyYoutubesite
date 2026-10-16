import { handle, json } from "../../server/middleware/http.js";
import { runtimeEnv } from "../../server/config.js";

// Public liveness check. Integration details are only exposed via the admin API.
export default handle(async () =>
  json({ ok: true, env: runtimeEnv(), time: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } })
);

export const config = { path: "/api/health" };
