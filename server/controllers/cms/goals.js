import { HttpError } from "../../middleware/http.js";
import { readJson } from "../../middleware/auth.js";
import { goalSchema, parseOrThrow } from "../../validation/schemas.js";
import { toId, notFoundIfEmpty } from "./helpers.js";

const SELECT = `
  select id, title, description, start_value as "startValue", goal_value as "goalValue",
         to_char(deadline, 'YYYY-MM-DD') as deadline, enabled, celebrate, achieved_at as "achievedAt"
  from subscriber_goals`;

export async function list({ db }) {
  const goals = await db.query(`${SELECT} order by enabled desc, created_at desc`);
  const [channel] = await db.query("select subscriber_count as \"subscriberCount\", subscribers_hidden as \"subscribersHidden\" from channel_stats where id = 1");
  return { goals, current: channel && !channel.subscribersHidden ? channel.subscriberCount : null };
}

/** Only one goal can be active: enabling one disables the rest (same transaction). */
async function save(db, id, g) {
  return db.transaction(async (tx) => {
    if (g.enabled) await tx.query("update subscriber_goals set enabled = false where enabled and ($1::bigint is null or id <> $1)", [id]);
    const args = [g.title, g.description, g.startValue, g.goalValue, g.deadline, g.enabled, g.celebrate];
    const rows = id
      ? await tx.query(
        `update subscriber_goals set title = $2, description = $3, start_value = $4, goal_value = $5, deadline = $6::date,
           enabled = $7, celebrate = $8, achieved_at = case when goal_value <> $5 then null else achieved_at end
         where id = $1 returning id`, [id, ...args])
      : await tx.query(
        `insert into subscriber_goals (title, description, start_value, goal_value, deadline, enabled, celebrate)
         values ($1, $2, $3, $4, $5::date, $6, $7) returning id`, args);
    return notFoundIfEmpty(rows, "Goal").id;
  });
}

export async function create({ req, db }) {
  const id = await save(db, null, parseOrThrow(goalSchema, await readJson(req), HttpError));
  return (await db.query(`${SELECT} where id = $1`, [id]))[0];
}

export async function update({ req, db, params }) {
  const id = await save(db, toId(params.id), parseOrThrow(goalSchema, await readJson(req), HttpError));
  return (await db.query(`${SELECT} where id = $1`, [id]))[0];
}

export async function remove({ db, params }) {
  notFoundIfEmpty(await db.query("delete from subscriber_goals where id = $1 returning id", [toId(params.id)]), "Goal");
  return { ok: true };
}
