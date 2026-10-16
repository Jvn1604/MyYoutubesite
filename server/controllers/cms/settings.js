import { HttpError } from "../../middleware/http.js";
import { readJson } from "../../middleware/auth.js";
import { settingSchemas, parseOrThrow } from "../../validation/schemas.js";
import { loadSettings } from "../../repositories/content.js";

export const list = ({ db }) => loadSettings(db);

export async function put({ req, db, params }) {
  const schema = settingSchemas[params.key];
  if (!schema) throw new HttpError(404, "Unknown setting");
  const { value } = await readJson(req);
  const clean = parseOrThrow(schema, value, HttpError);
  await db.query(
    `insert into site_settings (key, value) values ($1, $2::jsonb)
     on conflict (key) do update set value = excluded.value, draft_value = null`,
    [params.key, JSON.stringify(clean)]
  );
  return { key: params.key, value: clean };
}
