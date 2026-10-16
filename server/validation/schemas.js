/** zod schemas for every admin input. Server-side validation never trusts the dashboard. */
import { z } from "zod";
import { PASSWORD_MAX_LENGTH } from "../services/passwords.js";

// ---------------------------------------------------------------- primitives
const text = (max, min = 0) => z.string().trim().min(min).max(max);
const line = (max = 120, min = 0) => text(max, min).refine((s) => !/[\r\n]/.test(s), "must be a single line");
/** https URL, or a site-relative path / in-page anchor. No javascript:, data:, etc. */
const url = z.string().trim().max(500).refine(
  (s) => s === "" || /^https:\/\/[^\s]+$/i.test(s) || /^\/(?!\/)[^\s]*$/.test(s) || /^#[a-z0-9-]*$/i.test(s),
  "must be an https:// link, a /path or a #section"
);
const httpsUrl = z.string().trim().max(500).regex(/^https:\/\/[^\s]+$/i, "must be an https:// link");
const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "must be a #rrggbb colour");
const slug = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "use lowercase letters, numbers and dashes").max(80);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "must be YYYY-MM-DD");
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "must be HH:MM (24h)");
const timeZone = z.string().max(64).refine((tz) => {
  try { new Intl.DateTimeFormat("en", { timeZone: tz }); return true; } catch { return false; }
}, "unknown timezone");
const id = z.coerce.number().int().positive();

// ---------------------------------------------------------------- auth
export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(PASSWORD_MAX_LENGTH),
}).strict();

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(PASSWORD_MAX_LENGTH),
  newPassword: z.string().min(1).max(PASSWORD_MAX_LENGTH),
}).strict();

// ---------------------------------------------------------------- site settings (one schema per key)
export const SECTION_KEYS = ["hero", "stats", "latest", "streams", "games", "schedule", "goal", "videos", "community", "support", "about"];

const cta = z.object({
  key: z.enum(["latest", "live", "subscribe", "discord", "custom"]),
  label: line(40, 1),
  url,
  style: z.enum(["primary", "youtube", "ghost"]),
  enabled: z.boolean(),
}).strict();

export const settingSchemas = {
  brand: z.object({
    name: line(40, 1), nameTa: line(40), greetingTa: line(80), community: line(60), logoUrl: url,
  }).strict(),
  hero: z.object({
    heading: line(60, 1), headingTa: line(60), tagline: line(120), lead: text(600), backgroundUrl: url,
    ctas: z.array(cta).max(6),
  }).strict(),
  about: z.object({
    title: line(120), paragraphs: z.array(text(1500)).max(8), features: z.array(line(60)).max(12),
    channelStart: isoDate.or(z.literal("")), genres: z.array(line(40)).max(12),
    milestones: z.array(z.object({ date: z.string().regex(/^\d{4}-\d{2}(-\d{2})?$/, "YYYY-MM or YYYY-MM-DD"), title: line(140, 1) }).strict()).max(30),
    photoUrl: url,
  }).strict(),
  support: z.object({
    title: line(120), text: text(800),
    methods: z.array(z.object({ key: z.enum(["membership", "superchat", "subscribe", "discord", "custom"]), label: line(60, 1), description: line(140), url: httpsUrl, enabled: z.boolean() }).strict()).max(8),
    perks: z.array(line(120)).max(12), perksEnabled: z.boolean(),
  }).strict(),
  footer: z.object({ text: line(200) }).strict(),
  links: z.object({ channel: httpsUrl, subscribe: httpsUrl, live: httpsUrl, streams: httpsUrl, join: httpsUrl, discord: httpsUrl }).strict(),
  appearance: z.object({
    primary: hex, secondary: hex, background: hex,
    radiusScale: z.number().min(0).max(1.5),
    motion: z.enum(["normal", "subtle", "off"]),
    preset: z.enum(["phantom", "blood", "abyss", "minimal", "custom"]).optional(),
  }).strict(),
  sections: z.array(z.object({ key: z.enum(SECTION_KEYS), enabled: z.boolean() }).strict()).length(SECTION_KEYS.length)
    .refine((list) => new Set(list.map((s) => s.key)).size === SECTION_KEYS.length, "each section must appear exactly once")
    .refine((list) => list[0].key === "hero", "hero must stay first"),
  seo: z.object({ title: line(70, 1), description: text(170).min(1), ogImageUrl: url, twitterHandle: z.string().regex(/^(@\w{1,15})?$/, "like @handle").or(z.literal("")) }).strict(),
  schedule: z.object({
    timezone: timeZone, message: line(200),
    compareZones: z.array(z.object({ label: line(30, 1), timeZone }).strict()).max(8),
  }).strict(),
};

// ---------------------------------------------------------------- content tables
export const videoPatchSchema = z.object({
  hidden: z.boolean(),
  featured: z.boolean(),
  gameId: id.nullable(),               // null = no game; any explicit choice locks it from auto-assign
  kindOverride: z.enum(["video", "short", "stream"]).nullable(),
  customDescription: text(2000).nullable(),
  priority: z.number().int().min(-100).max(100),
}).partial().strict();

export const videoQuerySchema = z.object({
  q: text(80).default(""),
  type: z.enum(["all", "video", "short", "stream"]).default("all"),
  game: z.union([z.literal(""), z.literal("none"), id]).default(""),
  status: z.enum(["all", "visible", "hidden", "featured", "unavailable"]).default("all"),
  page: z.coerce.number().int().min(1).max(1000).default(1),
});

export const gameSchema = z.object({
  name: line(120, 1),
  slug,
  status: z.enum(["playing", "completed", "upcoming", "dropped", "favourite"]),
  genre: line(60),
  releaseYear: z.number().int().min(1970).max(2100).nullable(),
  description: text(1000),
  coverMediaId: id.nullable(),
  bannerMediaId: id.nullable(),
  playlistUrl: z.union([z.literal(""), httpsUrl.refine((u) => /^https:\/\/(www\.)?youtube\.com\//.test(u), "must be a youtube.com link")]),
  titleKeywords: z.array(line(60, 2)).max(10),
  featured: z.boolean(),
  hidden: z.boolean(),
}).strict();

export const reorderSchema = z.object({ ids: z.array(id).min(1).max(500) }).strict();

export const scheduleRulesSchema = z.object({
  rules: z.array(z.object({ weekday: z.number().int().min(0).max(6), time, title: line(80), enabled: z.boolean() }).strict()).max(28),
}).strict();

export const scheduleEventSchema = z.object({
  startsAt: z.string().datetime({ offset: true }),
  title: line(120, 1),
  description: text(500),
  enabled: z.boolean(),
}).strict();

export const goalSchema = z.object({
  title: line(120, 1),
  description: text(400),
  startValue: z.number().int().min(0),
  goalValue: z.number().int().min(1),
  deadline: isoDate.nullable(),
  enabled: z.boolean(),
  celebrate: z.boolean(),
}).strict().refine((g) => g.goalValue > g.startValue, { message: "goal must be higher than the starting number", path: ["goalValue"] });

export const socialSchema = z.object({
  platform: z.string().regex(/^[a-z0-9_-]{1,30}$/, "lowercase name like discord"),
  label: line(60, 1),
  description: line(140),
  url: httpsUrl,
  icon: z.enum(["youtube", "discord", "whatsapp", "instagram", "linktree", "link"]),
  accent: hex.nullable(),
  enabled: z.boolean(),
}).strict();

export const mediaPatchSchema = z.object({ alt: line(200) }).strict();
export const syncRequestSchema = z.object({ job: z.enum(["live", "stats", "library", "manual"]) }).strict();

/** Parse or throw a 400 with a readable message. */
export function parseOrThrow(schema, data, HttpError) {
  const result = schema.safeParse(data);
  if (result.success) return result.data;
  const first = result.error.issues[0];
  throw new HttpError(400, `${first.path.join(".") || "input"}: ${first.message}`);
}
