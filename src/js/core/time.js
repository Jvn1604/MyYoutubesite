/**
 * Timezone + schedule maths with no dependencies (pure; runs in browser and Node).
 * The creator's schedule is stored as wall-clock times in a base timezone
 * (Asia/Kuala_Lumpur) and converted to real instants here.
 */

const partsFormatter = new Map();
function formatterFor(timeZone) {
  if (!partsFormatter.has(timeZone)) {
    partsFormatter.set(timeZone, new Intl.DateTimeFormat("en-US", {
      timeZone, hourCycle: "h23",
      year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
    }));
  }
  return partsFormatter.get(timeZone);
}

/** Wall-clock parts of an instant in a timezone. */
export function zonedParts(date, timeZone) {
  const p = Object.fromEntries(formatterFor(timeZone).formatToParts(date).map((x) => [x.type, x.value]));
  const year = +p.year, month = +p.month, day = +p.day;
  return {
    year, month, day,
    hour: +p.hour, minute: +p.minute, second: +p.second,
    weekday: new Date(Date.UTC(year, month - 1, day)).getUTCDay(),
  };
}

/** Offset of `timeZone` from UTC at `date`, in minutes (e.g. +480 for MYT). */
export function tzOffsetMinutes(date, timeZone) {
  const p = zonedParts(date, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUtc - Math.floor(date.getTime() / 1000) * 1000) / 60000);
}

/** Wall-clock time in `timeZone` → Date. Handles DST transitions. */
export function zonedToUtc({ year, month, day, hour = 0, minute = 0 }, timeZone) {
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  const off1 = tzOffsetMinutes(new Date(guess), timeZone);
  let ts = guess - off1 * 60000;
  const off2 = tzOffsetMinutes(new Date(ts), timeZone);
  if (off2 !== off1) ts = guess - off2 * 60000;
  return new Date(ts);
}

export function parseTime(hhmm) {
  const m = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(String(hhmm ?? ""));
  return m ? { hour: +m[1], minute: +m[2] } : null;
}

/**
 * Next occurrences of weekly rules ({ weekday 0–6, time "HH:MM" }) after `now`.
 * Returns [{ startsAt: Date, rule }] sorted ascending.
 */
export function nextRuleOccurrences(rules, timeZone, now = new Date(), limit = 1) {
  const today = zonedParts(now, timeZone);
  const out = [];
  for (let offset = 0; offset <= 7 && out.length < limit * 7; offset++) {
    const d = new Date(Date.UTC(today.year, today.month - 1, today.day + offset));
    const weekday = d.getUTCDay();
    for (const rule of rules) {
      const t = parseTime(rule.time);
      if (rule.weekday !== weekday || !t || rule.enabled === false) continue;
      const startsAt = zonedToUtc({ year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate(), ...t }, timeZone);
      if (startsAt > now) out.push({ startsAt, rule });
    }
  }
  return out.sort((a, b) => a.startsAt - b.startsAt).slice(0, limit);
}

/**
 * Decide what "next stream" to show. Priority:
 * 1. a real YouTube scheduled stream (overrides everything)
 * 2. the earliest of: special events, regular schedule
 */
export function resolveNextStream({ upcomingVideo, events = [], rules = [], timeZone }, now = new Date()) {
  if (upcomingVideo?.scheduledStart) {
    return { source: "youtube", startsAt: new Date(upcomingVideo.scheduledStart), title: upcomingVideo.title, video: upcomingVideo };
  }
  const candidates = [];
  events.forEach((e) => {
    const at = new Date(e.startsAt);
    if (at > now) candidates.push({ source: "event", startsAt: at, title: e.title, description: e.description });
  });
  const [rule] = nextRuleOccurrences(rules, timeZone, now, 1);
  if (rule) candidates.push({ source: "schedule", startsAt: rule.startsAt, title: rule.rule.title });
  return candidates.sort((a, b) => a.startsAt - b.startsAt)[0] ?? null;
}

/** Milliseconds → { days, hours, minutes, seconds } (never negative). */
export function splitDuration(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return { days: Math.floor(s / 86400), hours: Math.floor((s % 86400) / 3600), minutes: Math.floor((s % 3600) / 60), seconds: s % 60 };
}

/** "Tonight", "Tomorrow", or weekday name, relative to the viewer's local calendar. */
export function relativeDayLabel(date, now = new Date(), timeZone) {
  const a = zonedParts(date, timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone);
  const b = zonedParts(now, timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone);
  const diffDays = Math.round((Date.UTC(a.year, a.month - 1, a.day) - Date.UTC(b.year, b.month - 1, b.day)) / 86400000);
  if (diffDays === 0) return a.hour >= 17 ? "Tonight" : "Today";
  if (diffDays === 1) return "Tomorrow";
  return date.toLocaleDateString("en-GB", { weekday: "long", timeZone });
}

export function formatTimeIn(date, timeZone, opts = {}) {
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone, ...opts });
}

export function viewerTimeZone() {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; } catch { return "UTC"; }
}
