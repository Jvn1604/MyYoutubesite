/** Video library: type chips, game select, debounced search, "Load more" pagination. */
import { $, $$, html, render, enhanceImages } from "../core/dom.js";
import { api } from "../core/api.js";
import { videoCard, skeletonCards, emptyState, FALLBACK_THUMB } from "./templates.js";

const TYPES = [
  { key: "all", label: "All" },
  { key: "video", label: "Videos" },
  { key: "stream", label: "Livestreams" },
  { key: "short", label: "Shorts" },
];
const PAGE_SIZE = 12;

export function createLibrary(root, { games, videoFacets }) {
  const typesEl = $('[data-slot="library-types"]', root);
  const gameEl = $("#library-game", root);
  const qEl = $("#library-q", root);
  const grid = $('[data-slot="library"]', root);
  const status = $('[data-slot="library-status"]', root);
  const more = $('[data-slot="library-more"]', root);
  const state = { type: "all", game: "", q: "", page: 1 };
  let controller;

  const counts = { all: videoFacets.total, ...videoFacets.byKind };
  render(typesEl, TYPES.map((t) => html`
    <button class="chip" type="button" data-type="${t.key}" aria-pressed="${t.key === "all"}">
      ${t.label}${counts[t.key] != null ? html` <span class="chip__count">${counts[t.key]}</span>` : ""}
    </button>`));
  render(gameEl, [html`<option value="">All games</option>`, ...games.filter((g) => g.videoCount).map((g) => html`<option value="${g.slug}">${g.name}</option>`)]);

  async function load({ append = false } = {}) {
    controller?.abort();
    controller = new AbortController();
    if (!append) render(grid, skeletonCards(6));
    grid.setAttribute("aria-busy", "true");
    more.hidden = true;

    const params = new URLSearchParams({ type: state.type, page: String(state.page), pageSize: String(PAGE_SIZE) });
    if (state.game) params.set("game", state.game);
    if (state.q) params.set("q", state.q);

    let res;
    try {
      res = await api(`/api/videos?${params}`, { signal: controller.signal });
    } catch {
      return; // aborted by a newer request
    }
    grid.removeAttribute("aria-busy");

    if (!res.ok) {
      render(grid, emptyState({ title: "Couldn't load videos", text: "Please try again in a moment.", iconName: "alert", error: true,
        action: html`<button class="btn btn--ghost btn--sm" type="button" data-retry>Try again</button>` }));
      status.textContent = "";
      return;
    }
    const { items, total, hasMore } = res.data;
    const cards = items.map((v) => videoCard(v));
    if (append) {
      grid.insertAdjacentHTML("beforeend", cards.map((c) => c.value).join(""));
    } else {
      render(grid, cards.length ? cards : emptyState({ title: "No videos match", text: "Try another filter or search term." }));
    }
    enhanceImages(grid, FALLBACK_THUMB);
    status.textContent = total ? `Showing ${grid.querySelectorAll(".video-card").length} of ${total}` : "";
    more.hidden = !hasMore;
  }

  function update(patch) {
    Object.assign(state, patch, { page: 1 });
    $$("[data-type]", typesEl).forEach((c) => c.setAttribute("aria-pressed", String(c.dataset.type === state.type)));
    gameEl.value = state.game;
    load();
  }

  typesEl.addEventListener("click", (e) => {
    const chip = e.target.closest("[data-type]");
    if (chip) update({ type: chip.dataset.type });
  });
  gameEl.addEventListener("change", () => update({ game: gameEl.value }));
  let debounce;
  qEl.addEventListener("input", () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => update({ q: qEl.value.trim() }), 300);
  });
  root.querySelector("form").addEventListener("submit", (e) => { e.preventDefault(); update({ q: qEl.value.trim() }); });
  more.addEventListener("click", () => { state.page += 1; load({ append: true }); });
  grid.addEventListener("click", (e) => { if (e.target.closest("[data-retry]")) load(); });

  // Load the first page only when the section is about to be seen
  new IntersectionObserver(([entry], io) => {
    if (!entry.isIntersecting) return;
    io.disconnect();
    load();
  }, { rootMargin: "400px" }).observe(grid);

  return {
    /** Called when a game card is picked elsewhere on the page. */
    showGame(slug) {
      qEl.value = "";
      update({ game: slug, q: "", type: "all" });
      root.scrollIntoView({ block: "start" });
    },
  };
}
