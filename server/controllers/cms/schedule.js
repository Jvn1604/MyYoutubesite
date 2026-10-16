import { HttpError } from "../../middleware/http.js";
import { readJson } from "../../middleware/auth.js";
import { scheduleRulesSchema, scheduleEventSchema, parseOrThrow } from "../../validation/schemas.js";
import { toId, notFoundIfEmpty } from "./helpers.js";

const EVENT_SELECT = `select id, starts_at as "startsAt", title, description, enabled from schedule_events`;

export async function get({ db }) {
  const [settings] = await db.query("select value from site_settings where key = 'schedule'");
  const rules = await db.query("select weekday, to_char(start_time, 'HH24:MI') as time, title, enabled from schedule_rules order by weekday, start_time");
  const events = await db.query(`${EVENT_SELECT} where starts_at > now() - interval '30 days' order by starts_at`);
  return { settings: settings?.value ?? null, rules, events };
}

/** Replace the weekly schedule in one transaction. */
export async function putRules({ req, db }) {
  const { rules } = parseOrThrow(scheduleRulesSchema, await readJson(req), HttpError);
  const keys = rules.map((r) => `${r.weekday}-${r.time}`);
  if (new Set(keys).size !== keys.length) throw new HttpError(400, "Two streams on the same day can't start at the same time");
  const [settings] = await db.query("select value->>'timezone' as tz from site_settings where key = 'schedule'");
  await db.transaction(async (tx) => {
    await tx.query("delete from schedule_rules");
    for (const r of rules) {
      await tx.query("insert into schedule_rules (weekday, start_time, timezone, title, enabled) values ($1, $2::time, $3, $4, $5)",
        [r.weekday, r.time, settings?.tz ?? "Asia/Kuala_Lumpur", r.title, r.enabled]);
    }
  });
  return get({ db });
}

export async function createEvent({ req, db }) {
  const e = parseOrThrow(scheduleEventSchema, await readJson(req), HttpError);
  const [row] = await db.query(
    `insert into schedule_events (starts_at, title, description, enabled) values ($1, $2, $3, $4)
     returning id, starts_at as "startsAt", title, description, enabled`,
    [e.startsAt, e.title, e.description, e.enabled]
  );
  return row;
}

export async function updateEvent({ req, db, params }) {
  const e = parseOrThrow(scheduleEventSchema, await readJson(req), HttpError);
  return notFoundIfEmpty(await db.query(
    `update schedule_events set starts_at = $2, title = $3, description = $4, enabled = $5 where id = $1
     returning id, starts_at as "startsAt", title, description, enabled`,
    [toId(params.id), e.startsAt, e.title, e.description, e.enabled]
  ), "Event");
}

export async function removeEvent({ db, params }) {
  notFoundIfEmpty(await db.query("delete from schedule_events where id = $1 returning id", [toId(params.id)]), "Event");
  return { ok: true };
}
