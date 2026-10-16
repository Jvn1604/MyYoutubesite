import { HttpError } from "../../middleware/http.js";
import { readJson } from "../../middleware/auth.js";
import { socialSchema, reorderSchema, parseOrThrow } from "../../validation/schemas.js";
import { toId, notFoundIfEmpty } from "./helpers.js";

const SELECT = `select id, platform, label, description, url, icon, accent, enabled, sort_order as "sortOrder" from social_links`;

export const list = ({ db }) => db.query(`${SELECT} order by sort_order, id`);

export async function create({ req, db }) {
  const s = parseOrThrow(socialSchema, await readJson(req), HttpError);
  const [row] = await db.query(
    `insert into social_links (platform, label, description, url, icon, accent, enabled, sort_order)
     values ($1, $2, $3, $4, $5, $6, $7, (select coalesce(max(sort_order), 0) + 1 from social_links)) returning id`,
    [s.platform, s.label, s.description, s.url, s.icon, s.accent, s.enabled]
  );
  return (await db.query(`${SELECT} where id = $1`, [row.id]))[0];
}

export async function update({ req, db, params }) {
  const s = parseOrThrow(socialSchema, await readJson(req), HttpError);
  return notFoundIfEmpty(await db.query(
    `update social_links set platform = $2, label = $3, description = $4, url = $5, icon = $6, accent = $7, enabled = $8
     where id = $1 returning id, platform, label, description, url, icon, accent, enabled, sort_order as "sortOrder"`,
    [toId(params.id), s.platform, s.label, s.description, s.url, s.icon, s.accent, s.enabled]
  ), "Link");
}

export async function remove({ db, params }) {
  notFoundIfEmpty(await db.query("delete from social_links where id = $1 returning id", [toId(params.id)]), "Link");
  return { ok: true };
}

export async function reorder({ req, db }) {
  const { ids } = parseOrThrow(reorderSchema, await readJson(req), HttpError);
  await db.transaction(async (tx) => {
    for (const [i, id] of ids.entries()) await tx.query("update social_links set sort_order = $2 where id = $1", [id, i + 1]);
  });
  return { ok: true };
}
