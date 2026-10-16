/** Weekly schedule converted to the visitor's timezone + next stream countdown. */
import { html, render, safeUrl } from "../core/dom.js";
import { zonedToUtc, zonedParts, parseTime, formatTimeIn, relativeDayLabel, viewerTimeZone } from "../core/time.js";
import { countdownMarkup } from "../ui/countdown.js";
import { nextStreamFor } from "./hero.js";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** A rule's time on its base-timezone weekday, expressed in the viewer's timezone. */
function ruleInViewerTz(rule, baseTz, viewerTz, weekStart) {
  const t = parseTime(rule.time);
  const d = new Date(weekStart.getTime() + rule.weekday * 86400000);
  const at = zonedToUtc({ year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate(), ...t }, baseTz);
  return { at, viewerDay: zonedParts(at, viewerTz).weekday };
}

function nextCard(data) {
  const { live } = data;
  if (live.state === "live") {
    return html`
      <div class="card card--glow next-stream">
        <span class="pill pill--live"><span class="pill__dot" aria-hidden="true"></span><strong>LIVE NOW</strong></span>
        <p class="next-stream__when">${live.video.title}</p>
        <a class="btn btn--youtube" href="${safeUrl(live.video.url)}" target="_blank" rel="noopener" data-track="watch_live">Watch live</a>
      </div>`;
  }
  const next = nextStreamFor(data);
  if (!next) {
    return html`<div class="card next-stream"><p class="next-stream__when">No stream scheduled</p><p class="text-muted">Turn on notifications on YouTube so you don't miss the next one.</p></div>`;
  }
  const tz = viewerTimeZone();
  const sourceLabel = { youtube: "Scheduled on YouTube", event: "Special event", schedule: "Regular schedule" }[next.source];
  return html`
    <div class="card card--glow next-stream">
      <p class="eyebrow">Next stream · ${sourceLabel}</p>
      <p class="next-stream__when">${relativeDayLabel(next.startsAt, new Date(), tz)}, ${formatTimeIn(next.startsAt, tz)}</p>
      ${next.title ? html`<p class="text-soft">${next.title}</p>` : ""}
      <div><p class="text-sm text-muted">Starts in</p>${countdownMarkup(next.startsAt)}</div>
      ${next.video ? html`<a class="btn btn--ghost btn--sm" href="${safeUrl(next.video.url)}" target="_blank" rel="noopener" data-track="watch_upcoming">Set a reminder on YouTube</a>` : ""}
    </div>`;
}

function weekCard({ schedule }) {
  const viewerTz = viewerTimeZone();
  const base = schedule.timezone;
  // Sunday of the current week in the base timezone (UTC date math only)
  const today = zonedParts(new Date(), base);
  const weekStart = new Date(Date.UTC(today.year, today.month - 1, today.day - today.weekday));
  const viewerToday = zonedParts(new Date(), viewerTz).weekday;

  const byViewerDay = new Map();
  schedule.rules.forEach((r) => {
    if (!parseTime(r.time)) return;
    const { at, viewerDay } = ruleInViewerTz(r, base, viewerTz, weekStart);
    byViewerDay.set(viewerDay, [...(byViewerDay.get(viewerDay) ?? []), formatTimeIn(at, viewerTz)]);
  });

  const sample = schedule.rules.find((r) => parseTime(r.time));
  const sampleAt = sample ? ruleInViewerTz(sample, base, viewerTz, weekStart).at : null;
  const zones = schedule.compareZones ?? [];

  return html`
    <div class="card">
      <h3 class="card-title">This week</h3>
      <p class="text-sm text-muted">Times shown in your timezone (${viewerTz.replace(/_/g, " ")})</p>
      <ol class="week" role="list" aria-label="Weekly stream days">
        ${DAYS.map((d, i) => {
          const times = byViewerDay.get(i);
          return html`<li class="week__day" ${times ? html`data-on` : ""} ${i === viewerToday ? html`data-today aria-current="date"` : ""}>
            <strong>${d}</strong><span>${times ? times.join(", ") : "Off"}</span></li>`;
        })}
      </ol>
      ${sampleAt && zones.length ? html`
        <ul class="zones" role="list" aria-label="Stream time around the world">
          ${zones.map((z) => html`<li ${z.timeZone === viewerTz ? html`data-viewer` : ""}><span>${z.label}</span><span>${formatTimeIn(sampleAt, z.timeZone)}</span></li>`)}
        </ul>` : ""}
    </div>`;
}

export function renderSchedule({ slot, message }, data) {
  render(message, data.schedule.message ?? "");
  render(slot, [nextCard(data), weekCard(data)]);
}
