import { HttpError } from "../../middleware/http.js";

export const toId = (value) => {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw new HttpError(400, "Invalid id");
  return n;
};

export const notFoundIfEmpty = (rows, what = "Item") => {
  if (!rows.length) throw new HttpError(404, `${what} not found`);
  return rows[0];
};
