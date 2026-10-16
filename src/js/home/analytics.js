/**
 * Privacy-friendly event hooks. Elements opt in with data-track="event"
 * (+ optional data-track-target). No personal data is collected; events are
 * dispatched as a DOM event that a configured provider can listen to.
 */
export function initTracking() {
  document.addEventListener("click", (e) => {
    const el = e.target.closest("[data-track]");
    if (!el) return;
    const detail = { event: el.dataset.track, target: el.dataset.trackTarget ?? null };
    window.dispatchEvent(new CustomEvent("dp:track", { detail }));
  });
}
