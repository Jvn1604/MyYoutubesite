import { handle, json, error } from "../../server/middleware/http.js";
import { withDb } from "../../server/db/client.js";

// Privacy-friendly click analytics: event name + optional target only. No IPs, cookies or user agents.
const EVENT = /^[a-z0-9_]{1,40}$/;
const TARGET = /^[A-Za-z0-9_.:/-]{1,80}$/;

export default handle(async (req) => {
  let body;
  try {
    body = JSON.parse(await req.text());
  } catch {
    return error(400, "Invalid JSON");
  }
  const event = typeof body?.event === "string" && EVENT.test(body.event) ? body.event : null;
  const target = typeof body?.target === "string" && TARGET.test(body.target) ? body.target : null;
  if (!event) return error(400, "Invalid event");
  await withDb((db) => db.query("insert into site_events (event, target) values ($1, $2)", [event, target]));
  return json({ ok: true }, { status: 202, headers: { "Cache-Control": "no-store" } });
}, { methods: ["POST"] });

export const config = { path: "/api/events" };
