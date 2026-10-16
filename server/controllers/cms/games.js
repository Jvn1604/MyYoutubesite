import { HttpError } from "../../middleware/http.js";
import { readJson } from "../../middleware/auth.js";
import { gameSchema, reorderSchema, parseOrThrow } from "../../validation/schemas.js";
import { publicUrl } from "../../services/storage.js";
import { toId, notFoundIfEmpty } from "./helpers.js";

const SELECT = `
  select g.id, g.slug, g.name, g.status, g.genre, g.release_year as "releaseYear", g.description,
         g.cover_media_id as "coverMediaId", g.banner_media_id as "bannerMediaId", g.playlist_url as "playlistUrl",
         g.title_keywords as "titleKeywords", g.featured, g.hidden, g.sort_order as "sortOrder",
         c.path as "coverPath", (select count(*)::int from video_overrides o where o.game_id = g.id) as "videoCount"
  from games g left join media c on c.id = g.cover_media_id`;

const shape = (row) => ({ ...row, coverUrl: row.coverPath ? publicUrl(row.coverPath) : "", coverPath: undefined });

async function assertMedia(db, ...ids) {
  for (const id of ids.filter(Boolean)) notFoundIfEmpty(await db.query("select 1 from media where id = $1", [id]), "Image");
}

function uniqueSlugError(err) {
  if (/games_slug_key|duplicate key/.test(err.message)) throw new HttpError(409, "Another game already uses that slug");
  throw err;
}

export async function list({ db }) {
  return (await db.query(`${SELECT} order by g.sort_order, g.id`)).map(shape);
}

const values = (g) => [g.name, g.slug, g.status, g.genre, g.releaseYear, g.description, g.coverMediaId, g.bannerMediaId, g.playlistUrl, g.titleKeywords, g.featured, g.hidden];

export async function create({ req, db }) {
  const g = parseOrThrow(gameSchema, await readJson(req), HttpError);
  await assertMedia(db, g.coverMediaId, g.bannerMediaId);
  const [row] = await db.query(
    `insert into games (name, slug, status, genre, release_year, description, cover_media_id, banner_media_id, playlist_url, title_keywords, featured, hidden, sort_order)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::text[], $11, $12, (select coalesce(max(sort_order), 0) + 1 from games))
     returning id`,
    values(g)
  ).catch(uniqueSlugError);
  return shape((await db.query(`${SELECT} where g.id = $1`, [row.id]))[0]);
}

export async function update({ req, db, params }) {
  const id = toId(params.id);
  const g = parseOrThrow(gameSchema, await readJson(req), HttpError);
  await assertMedia(db, g.coverMediaId, g.bannerMediaId);
  const rows = await db.query(
    `update games set name = $2, slug = $3, status = $4, genre = $5, release_year = $6, description = $7, cover_media_id = $8,
       banner_media_id = $9, playlist_url = $10, title_keywords = $11::text[], featured = $12, hidden = $13
     where id = $1 returning id`,
    [id, ...values(g)]
  ).catch(uniqueSlugError);
  notFoundIfEmpty(rows, "Game");
  return shape((await db.query(`${SELECT} where g.id = $1`, [id]))[0]);
}

/** Deleting a game un-assigns its videos (FK on delete set null); videos themselves stay. */
export async function remove({ db, params }) {
  notFoundIfEmpty(await db.query("delete from games where id = $1 returning id", [toId(params.id)]), "Game");
  return { ok: true };
}

export async function reorder({ req, db }) {
  const { ids } = parseOrThrow(reorderSchema, await readJson(req), HttpError);
  await db.transaction(async (tx) => {
    for (const [i, id] of ids.entries()) await tx.query("update games set sort_order = $2 where id = $1", [id, i + 1]);
  });
  return { ok: true };
}
