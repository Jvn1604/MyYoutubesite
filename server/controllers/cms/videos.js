import { HttpError } from "../../middleware/http.js";
import { readJson } from "../../middleware/auth.js";
import { videoPatchSchema, videoQuerySchema, parseOrThrow } from "../../validation/schemas.js";
import { notFoundIfEmpty } from "./helpers.js";

const PAGE_SIZE = 25;

const SELECT = `
  select v.youtube_id as id, v.title, v.published_at as "publishedAt", v.kind, v.live_state as "liveState",
         v.view_count as views, v.duration_seconds as "durationSeconds", v.thumbnails, v.is_available as "isAvailable",
         coalesce(o.hidden, false) as hidden, coalesce(o.featured, false) as featured, o.game_id as "gameId",
         coalesce(o.game_locked, false) as "gameLocked", o.kind_override as "kindOverride",
         o.custom_description as "customDescription", coalesce(o.priority, 0) as priority, g.name as "gameName"
  from videos v
  left join video_overrides o using (youtube_id)
  left join games g on g.id = o.game_id`;

export async function list({ db, query }) {
  const q = parseOrThrow(videoQuerySchema, Object.fromEntries(query), HttpError);
  const where = [];
  const params = [];
  const add = (sql, value) => { params.push(value); where.push(sql.replace("?", `$${params.length}`)); };

  if (q.q) add("v.title ilike ?", `%${q.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`);
  if (q.type !== "all") add("coalesce(o.kind_override, v.kind) = ?", q.type);
  if (q.game === "none") where.push("o.game_id is null");
  else if (q.game) add("o.game_id = ?", q.game);
  if (q.status === "visible") where.push("v.is_available and not coalesce(o.hidden, false)");
  if (q.status === "hidden") where.push("coalesce(o.hidden, false)");
  if (q.status === "featured") where.push("coalesce(o.featured, false)");
  if (q.status === "unavailable") where.push("not v.is_available");

  const clause = where.length ? `where ${where.join(" and ")}` : "";
  const [{ total }] = await db.query(`select count(*)::int as total from videos v left join video_overrides o using (youtube_id) ${clause}`, params);
  const items = await db.query(
    `${SELECT} ${clause} order by v.published_at desc limit ${PAGE_SIZE} offset ${(q.page - 1) * PAGE_SIZE}`,
    params
  );
  return { items, total, page: q.page, pageSize: PAGE_SIZE, hasMore: q.page * PAGE_SIZE < total };
}

/** Website-only presentation settings. Never touches the YouTube-owned `videos` row. */
export async function patch({ req, db, params }) {
  const body = parseOrThrow(videoPatchSchema, await readJson(req), HttpError);
  notFoundIfEmpty(await db.query("select 1 from videos where youtube_id = $1", [params.id]), "Video");
  if (body.gameId) notFoundIfEmpty(await db.query("select 1 from games where id = $1", [body.gameId]), "Game");

  const columns = {
    hidden: body.hidden, featured: body.featured, kind_override: body.kindOverride,
    custom_description: body.customDescription, priority: body.priority,
  };
  if ("gameId" in body) Object.assign(columns, { game_id: body.gameId, game_locked: true }); // admin's choice wins over auto-assign
  const set = Object.entries(columns).filter(([, v]) => v !== undefined);
  if (!set.length) throw new HttpError(400, "Nothing to update");

  const names = set.map(([k]) => k);
  const values = set.map(([, v]) => v);
  await db.query(
    `insert into video_overrides (youtube_id, ${names.join(", ")}) values ($1, ${names.map((_, i) => `$${i + 2}`).join(", ")})
     on conflict (youtube_id) do update set ${names.map((n) => `${n} = excluded.${n}`).join(", ")}`,
    [params.id, ...values]
  );
  const [row] = await db.query(`${SELECT} where v.youtube_id = $1`, [params.id]);
  return row;
}
