/**
 * Privacy-friendly event tracking. Elements opt in with data-track="event"
 * (+ optional data-track-target). Only the event name and target are sent:
 * no cookies, IPs or user agents are stored. Also re-dispatched as a DOM
 * event ("dp:track") so an external analytics provider can listen if configured.
 */
const sent = new Map(); // de-dupe rapid double clicks

function send(detail) {
  const key = `${detail.event}:${detail.target}`;
  const now = Date.now();
  if (now - (sent.get(key) ?? 0) < 2000) return;
  sent.set(key, now);
  const body = JSON.stringify(detail);
  const blob = new Blob([body], { type: "application/json" });
  if (!navigator.sendBeacon?.("/api/events", blob)) {
    fetch("/api/events", { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: true }).catch(() => {});
  }
}

export function initTracking() {
  document.addEventListener("click", (e) => {
    const el = e.target.closest("[data-track]");
    if (!el) return;
    const detail = { event: el.dataset.track, target: el.dataset.trackTarget ?? null };
    send(detail);
    window.dispatchEvent(new CustomEvent("dp:track", { detail }));
  });
}
