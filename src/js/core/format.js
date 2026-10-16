/** Number/date/duration formatting shared by the site and admin. */

const compact = new Intl.NumberFormat("en", { notation: "compact", maximumSignificantDigits: 3 });
const full = new Intl.NumberFormat("en");

/** formatNumber(1352) → "1.35K"; format "full" → "1,352"; "percent" → "45%" */
export function formatNumber(n, format = "compact") {
  if (n == null || !Number.isFinite(Number(n))) return "–";
  n = Number(n);
  if (format === "full") return full.format(n);
  if (format === "percent") return `${Math.round(n)}%`;
  return n < 1000 ? full.format(n) : compact.format(n);
}

export const formatViews = (n) => (n == null ? "" : `${formatNumber(n)} ${n === 1 ? "view" : "views"}`);

/** ISO 8601 seconds → "1:02:03" / "4:05" */
export function formatDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const pad = (v) => String(v).padStart(2, "0");
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

export function formatDate(iso, opts = { day: "numeric", month: "short", year: "numeric" }) {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-GB", opts);
}

const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
const UNITS = [["year", 31536000], ["month", 2592000], ["week", 604800], ["day", 86400], ["hour", 3600], ["minute", 60]];

/** "3 days ago", "in 2 hours" */
export function formatRelative(iso, now = Date.now()) {
  const diff = (new Date(iso).getTime() - now) / 1000;
  if (!Number.isFinite(diff)) return "";
  for (const [unit, secs] of UNITS) {
    if (Math.abs(diff) >= secs) return rtf.format(Math.round(diff / secs), unit);
  }
  return "just now";
}
