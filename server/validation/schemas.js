/** zod schemas for every admin input. Server-side validation never trusts the dashboard. */
import { z } from "zod";
import { PASSWORD_MAX_LENGTH } from "../services/passwords.js";

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(PASSWORD_MAX_LENGTH),
}).strict();

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(PASSWORD_MAX_LENGTH),
  newPassword: z.string().min(1).max(PASSWORD_MAX_LENGTH),
}).strict();

/** Parse or throw a 400 with a readable message. */
export function parseOrThrow(schema, data, HttpError) {
  const result = schema.safeParse(data);
  if (result.success) return result.data;
  const first = result.error.issues[0];
  throw new HttpError(400, `${first.path.join(".") || "input"}: ${first.message}`);
}
