/**
 * /api/cms/* router. Every route requires an admin session; every write
 * also requires the CSRF token (enforced by requireAdmin).
 */
import { json, HttpError } from "../../middleware/http.js";
import { requireAdmin } from "../../middleware/auth.js";
import * as overview from "./overview.js";
import * as settings from "./settings.js";
import * as videos from "./videos.js";
import * as games from "./games.js";
import * as schedule from "./schedule.js";
import * as goals from "./goals.js";
import * as socials from "./socials.js";
import * as media from "./media.js";
import * as youtube from "./youtube.js";
import * as analytics from "./analytics.js";

const ROUTES = [
  ["GET", "/overview", overview.get],
  ["GET", "/settings", settings.list],
  ["PUT", "/settings/:key", settings.put],
  ["GET", "/videos", videos.list],
  ["PATCH", "/videos/:id", videos.patch],
  ["GET", "/games", games.list],
  ["POST", "/games", games.create],
  ["POST", "/games/reorder", games.reorder],
  ["PUT", "/games/:id", games.update],
  ["DELETE", "/games/:id", games.remove],
  ["GET", "/schedule", schedule.get],
  ["PUT", "/schedule/rules", schedule.putRules],
  ["POST", "/schedule/events", schedule.createEvent],
  ["PUT", "/schedule/events/:id", schedule.updateEvent],
  ["DELETE", "/schedule/events/:id", schedule.removeEvent],
  ["GET", "/goals", goals.list],
  ["POST", "/goals", goals.create],
  ["PUT", "/goals/:id", goals.update],
  ["DELETE", "/goals/:id", goals.remove],
  ["GET", "/socials", socials.list],
  ["POST", "/socials", socials.create],
  ["POST", "/socials/reorder", socials.reorder],
  ["PUT", "/socials/:id", socials.update],
  ["DELETE", "/socials/:id", socials.remove],
  ["GET", "/media", media.list],
  ["POST", "/media", media.upload],
  ["PATCH", "/media/:id", media.patch],
  ["DELETE", "/media/:id", media.remove],
  ["GET", "/youtube", youtube.status],
  ["POST", "/youtube/sync", youtube.sync],
  ["GET", "/analytics", analytics.get],
].map(([method, pattern, handler]) => ({
  method,
  handler,
  regex: new RegExp(`^/api/cms${pattern.replace(/:(\w+)/g, "(?<$1>[^/]+)")}$`),
}));

export async function routeCms(req, db, context) {
  const path = new URL(req.url).pathname;
  const matches = ROUTES.filter((r) => r.regex.test(path));
  if (!matches.length) throw new HttpError(404, "Not found");
  const route = matches.find((r) => r.method === req.method);
  if (!route) throw new HttpError(405, "Method not allowed");

  const session = await requireAdmin(req, db);
  const params = route.regex.exec(path).groups ?? {};
  const result = await route.handler({ req, db, params, session, context, query: new URL(req.url).searchParams });
  return result instanceof Response ? result : json(result ?? { ok: true }, { headers: { "Cache-Control": "no-store" } });
}
