/**
 * Homepage bootstrap: fetch /api/site once, then render every section.
 * Static markup (brand, hero copy, skeletons) is already in index.html,
 * so the page is useful even if the API is down.
 */
import { $, $$, html, render, safeUrl, enhanceImages } from "../core/dom.js";
import { api } from "../core/api.js";
import { icon } from "../ui/icons.js";
import { initNavigation } from "../ui/menu.js";
import { initReveal } from "../ui/reveal.js";
import { initCountdowns } from "../ui/countdown.js";
import { applyAppearance } from "./theme.js";
import { applySections, bindSettings } from "./sections.js";
import { renderHero, initHeroParallax } from "./hero.js";
import { renderStats } from "./stats.js";
import { renderLatest, initPlayButtons } from "./latest.js";
import { renderGames, markSelectedGame } from "./games.js";
import { renderSchedule } from "./schedule.js";
import { renderGoal } from "./goal.js";
import { createLibrary } from "./library.js";
import { renderSocials, renderSupport, renderAbout } from "./community.js";
import { videoCard, skeletonCards, emptyState, FALLBACK_THUMB } from "./templates.js";
import { initTracking } from "./analytics.js";

const LIVE_REFRESH_MS = 2 * 60 * 1000;
const slot = (name) => $(`[data-slot="${name}"]`);

function hydrateStaticIcons() {
  $$("[data-icon]").forEach((el) => render(el, icon(el.dataset.icon)));
  $$("[data-icon-prefix]").forEach((el) => el.insertAdjacentHTML("afterbegin", icon(el.dataset.iconPrefix).value));
  $$("[data-skeleton-cards]").forEach((el) => render(el, skeletonCards(Number(el.dataset.skeletonCards), { cover: el.hasAttribute("data-skeleton-cover") })));
  render(slot("year"), String(new Date().getFullYear()));
}

function siteUrl() {
  // Dev only: /?mock=live|upcoming|empty|goal previews homepage states
  const mock = import.meta.env.DEV ? new URLSearchParams(location.search).get("mock") : null;
  return mock ? `/api/site?mock=${encodeURIComponent(mock)}` : "/api/site";
}

function renderLiveParts(data) {
  renderHero(document, data);
  renderLatest(slot("latest"), data);
  renderSchedule({ slot: slot("schedule"), message: slot("schedule-message") }, data);
}

function renderAll(data) {
  const { settings } = data;
  applyAppearance(settings.appearance);
  bindSettings(settings);
  applySections($("#sections"), settings.sections);

  renderLiveParts(data);
  renderStats(slot("stats"), data);
  render(slot("streams"), data.recentStreams.length
    ? data.recentStreams.map((v) => videoCard(v, { track: "watch_stream" }))
    : emptyState({ title: "No streams yet", text: "Finished livestreams show up here automatically." }));
  renderGoal(slot("goal"), data);
  renderSocials(slot("socials"), data);
  renderSupport(slot("support"), data);
  renderAbout(slot("about"), data);
  render(slot("footer-links"), data.socials.map((s) => html`<a href="${safeUrl(s.url)}" target="_blank" rel="noopener" data-track="${s.platform}_click">${s.label}</a>`));

  const library = $('[data-section="videos"]').hidden ? null : createLibrary($("#videos"), data);
  renderGames({ filters: slot("game-filters"), grid: slot("games") }, data, {
    onSelect: (slugValue) => {
      markSelectedGame(slot("games"), slugValue);
      library?.showGame(slugValue);
    },
  });

  enhanceImages(document, FALLBACK_THUMB);
  initReveal();
}

function renderFailure() {
  render(slot("hero-status"), "");
  const failure = emptyState({ title: "Couldn't load the latest content", text: "Please refresh in a moment.", iconName: "alert", error: true });
  ["latest", "streams", "games", "schedule", "socials"].forEach((name) => render(slot(name), failure));
  ["stats", "goal", "support", "about"].forEach((name) => slot(name)?.closest("[data-section]")?.setAttribute("hidden", ""));
}

/** Poll for live state changes while the tab is visible (cheap: CDN-cached payload). */
function watchLiveState(initial) {
  let last = initial;
  const refresh = async () => {
    if (document.hidden) return;
    const { ok, data } = await api(siteUrl());
    if (!ok) return;
    const changed = data.live.state !== last.live.state || data.live.video?.id !== last.live.video?.id
      || data.latest.upload?.id !== last.latest.upload?.id;
    last = data;
    if (changed) {
      renderLiveParts(data);
      enhanceImages(document, FALLBACK_THUMB);
      initReveal();
    }
  };
  setInterval(refresh, LIVE_REFRESH_MS);
  // When a countdown hits zero, check again shortly after the scheduled start
  document.addEventListener("countdown:done", () => setTimeout(refresh, 45 * 1000));
}

async function main() {
  hydrateStaticIcons();
  initNavigation();
  initTracking();
  initPlayButtons(document);
  initHeroParallax(document);

  const { ok, data } = await api(siteUrl());
  if (!ok || !data?.settings) {
    renderFailure();
    initReveal();
    return;
  }
  renderAll(data);
  initCountdowns();
  watchLiveState(data);
}

main();
