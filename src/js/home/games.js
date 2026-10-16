/** Games library with status filter; picking a game filters the video library. */
import { $$, html, render, safeUrl } from "../core/dom.js";
import { emptyState } from "./templates.js";

export const GAME_STATUS = {
  playing: { label: "Currently Playing", badge: "live" },
  upcoming: { label: "Upcoming", badge: "upcoming" },
  favourite: { label: "Favourite", badge: "featured" },
  completed: { label: "Completed", badge: "published" },
  dropped: { label: "Dropped", badge: "hidden" },
};

const initials = (name) => name.replace(/[^\p{L}\p{N} ]/gu, "").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

function gameCard(g) {
  const status = GAME_STATUS[g.status] ?? GAME_STATUS.completed;
  return html`
    <article class="card card--flush card--interactive game-card" data-game-card="${g.slug}" data-status="${g.status}">
      <div class="media">
        ${g.coverUrl
          ? html`<img src="${safeUrl(g.coverUrl)}" alt="" loading="lazy" decoding="async" width="300" height="400">`
          : html`<span class="game-card__cover-fallback" aria-hidden="true">${initials(g.name)}</span>`}
      </div>
      <div class="game-card__body">
        <span class="cluster game-card__badges">
          <span class="badge badge--solid badge--${status.badge === "live" ? "info" : status.badge}">${status.label}</span>
          ${g.featured ? html`<span class="badge badge--solid badge--featured">Featured</span>` : ""}
        </span>
        <h3 class="game-card__title">
          <button class="card__link" type="button" data-game="${g.slug}" data-track="game_select" data-track-target="${g.slug}"
            aria-label="Show videos for ${g.name}">${g.name}</button>
        </h3>
        <p class="game-card__meta">${[g.genre, g.videoCount ? `${g.videoCount} video${g.videoCount === 1 ? "" : "s"}` : ""].filter(Boolean).join(" · ")}</p>
      </div>
    </article>`;
}

export function renderGames({ filters, grid }, { games }, { onSelect }) {
  if (!games.length) {
    render(filters, "");
    render(grid, emptyState({ title: "No games added yet" }));
    return;
  }
  const present = Object.keys(GAME_STATUS).filter((s) => games.some((g) => g.status === s));
  render(filters, [
    html`<button class="chip" type="button" aria-pressed="true" data-status-filter="">All <span class="chip__count">${games.length}</span></button>`,
    ...present.map((s) => html`<button class="chip" type="button" aria-pressed="false" data-status-filter="${s}">${GAME_STATUS[s].label}</button>`),
  ]);
  render(grid, games.map(gameCard));

  filters.onclick = (e) => {
    const chip = e.target.closest("[data-status-filter]");
    if (!chip) return;
    $$("[data-status-filter]", filters).forEach((c) => c.setAttribute("aria-pressed", String(c === chip)));
    $$("[data-game-card]", grid).forEach((card) => {
      card.hidden = Boolean(chip.dataset.statusFilter) && card.dataset.status !== chip.dataset.statusFilter;
    });
  };
  grid.onclick = (e) => {
    const btn = e.target.closest("[data-game]");
    if (btn) onSelect(btn.dataset.game);
  };
}

export function markSelectedGame(grid, slug) {
  $$("[data-game-card]", grid).forEach((c) => {
    if (c.dataset.gameCard === slug) c.setAttribute("aria-current", "true");
    else c.removeAttribute("aria-current");
  });
}
