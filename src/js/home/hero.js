/** Hero: live / next-stream status, CTAs, banner background with light parallax. */
import { $, html, render, safeUrl } from "../core/dom.js";
import { formatNumber } from "../core/format.js";
import { resolveNextStream, relativeDayLabel, formatTimeIn, viewerTimeZone } from "../core/time.js";
import { countdownMarkup } from "../ui/countdown.js";
import { ctaButton } from "./templates.js";
import { motionAllowed, hasFinePointer } from "../core/motion.js";

export function nextStreamFor(data, now = new Date()) {
  const { schedule, live } = data;
  return resolveNextStream({
    upcomingVideo: live.state === "upcoming" ? live.video : null,
    events: schedule.events,
    rules: schedule.rules,
    timeZone: schedule.timezone,
  }, now);
}

function statusMarkup(data) {
  const { live, schedule } = data;
  if (live.state === "live") {
    const v = live.video;
    const watching = v.concurrentViewers != null ? html` · ${formatNumber(v.concurrentViewers)} watching` : "";
    return html`
      <span class="pill pill--live"><span class="pill__dot" aria-hidden="true"></span><strong>LIVE NOW</strong>${watching}</span>
      <a class="link text-sm truncate-2" href="${safeUrl(v.url)}" target="_blank" rel="noopener" data-track="watch_live">${v.title}</a>`;
  }
  const next = nextStreamFor(data);
  if (!next) return "";
  const viewerTz = viewerTimeZone();
  const baseTime = formatTimeIn(next.startsAt, schedule.timezone);
  const localTime = formatTimeIn(next.startsAt, viewerTz);
  const sameZone = baseTime === localTime;
  return html`
    <span class="pill">
      <span class="pill__dot" aria-hidden="true"></span>
      <span><strong>NEXT STREAM</strong> · ${relativeDayLabel(next.startsAt, new Date(), viewerTz)} ${localTime}${sameZone ? html` MYT` : html` your time (${baseTime} MYT)`}</span>
    </span>
    <span class="pill" aria-label="Time until next stream">in ${countdownMarkup(next.startsAt)}</span>`;
}

export function renderHero(root, data) {
  const { settings, channel, live } = data;
  render($('[data-slot="hero-status"]', root), statusMarkup(data));

  const enabled = settings.hero.ctas.filter((c) => c.enabled);
  if (live.state === "live") enabled.sort((a, b) => (b.key === "live") - (a.key === "live")); // live CTA first
  const ctas = enabled.map((c) => {
    // While live, the Watch Live button becomes the primary action
    if (c.key === "live" && live.state === "live") return ctaButton({ ...c, url: live.video.url, style: "youtube" }, "btn--lg");
    if (c.key === "live" && live.state !== "live") return ctaButton({ ...c, style: "ghost" });
    if (live.state === "live" && c.style === "primary") return ctaButton({ ...c, style: "ghost" });
    return ctaButton(c, c.style === "primary" ? "btn--lg" : "");
  });
  render($('[data-slot="hero-ctas"]', root), ctas);

  $(".hero", root)?.toggleAttribute("data-live", live.state === "live");

  const bg = $('[data-bind="heroBg"]', root);
  const bgUrl = settings.hero.backgroundUrl || channel?.bannerUrl;
  if (bg && bgUrl) {
    bg.addEventListener("load", () => { bg.hidden = false; }, { once: true });
    bg.addEventListener("error", () => { bg.hidden = true; }, { once: true });
    bg.src = safeUrl(bgUrl, "");
  }
}

/** Gentle parallax on the hero background (transform only, rAF-throttled, off for reduced motion). */
export function initHeroParallax(root) {
  const bg = $(".hero__bg", root);
  if (!bg) return;
  let ticking = false;
  addEventListener("scroll", () => {
    if (ticking || !motionAllowed()) return;
    ticking = true;
    requestAnimationFrame(() => {
      if (scrollY < innerHeight * 1.2) bg.style.transform = `translate3d(0, ${scrollY * 0.25}px, 0)`;
      ticking = false;
    });
  }, { passive: true });
}

/**
 * Subtle depth: the avatar drifts a few pixels toward the mouse.
 * Mouse/trackpad only, rAF-throttled, writes two CSS variables (no layout work).
 */
export function initHeroDepth(root) {
  const hero = $(".hero", root);
  if (!hero || !hasFinePointer()) return;
  let frame = 0;
  hero.addEventListener("pointermove", (e) => {
    if (frame || !motionAllowed()) return;
    frame = requestAnimationFrame(() => {
      const r = hero.getBoundingClientRect();
      hero.style.setProperty("--px", (((e.clientX - r.left) / r.width) * 2 - 1).toFixed(3));
      hero.style.setProperty("--py", (((e.clientY - r.top) / r.height) * 2 - 1).toFixed(3));
      frame = 0;
    });
  });
  hero.addEventListener("pointerleave", () => {
    hero.style.setProperty("--px", "0");
    hero.style.setProperty("--py", "0");
  });
}
