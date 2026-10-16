/** Latest section: live stream (if any), latest upload, latest finished stream. */
import { html, render, safeUrl } from "../core/dom.js";
import { icon } from "../ui/icons.js";
import { openVideoModal } from "../ui/modal.js";
import { stateBadge, videoMeta, thumbnailImg, emptyState, videoCard } from "./templates.js";

function latestCard(video, label, { live = false } = {}) {
  return html`
    <article class="card card--flush card--interactive video-card latest-card ${live ? "latest-card--live" : ""}" data-reveal="fade-up">
      <div class="media">
        ${thumbnailImg(video, "high")}
        <div class="media__overlay">${stateBadge(video)}</div>
        <button class="play-btn" type="button" data-play="${video.id}" data-title="${video.title}" data-track="${live ? "watch_live" : "watch_video"}" data-track-target="${video.id}" aria-label="Play ${video.title} here">
          <span>${icon("play")}</span>
        </button>
      </div>
      <div class="video-card__body">
        <p class="latest-card__label eyebrow">${label}</p>
        <h3 class="video-card__title"><a href="${safeUrl(video.url)}" target="_blank" rel="noopener" data-track="${live ? "watch_live" : "watch_video"}" data-track-target="${video.id}">${video.title}</a></h3>
        <p class="video-card__meta">${videoMeta(video)}</p>
        ${video.note ? html`<p class="video-card__note">${video.note}</p>` : ""}
      </div>
    </article>`;
}

/** Videos the creator marked "featured" in the admin (already ordered by priority). */
export function renderFeatured(slot, { featured }, shownIds) {
  const items = featured.filter((v) => !shownIds.has(v.id)).slice(0, 4);
  const block = slot.closest("[data-featured-block]");
  block.hidden = !items.length;
  render(slot, items.map((v) => videoCard(v, { track: "watch_featured" })));
}

/** Renders the latest cards; returns the ids shown so other blocks can avoid repeating them. */
export function renderLatest(slot, { live, latest }) {
  const cards = [];
  const shown = new Set();
  const add = (video, label, opts) => { cards.push(latestCard(video, label, opts)); shown.add(video.id); };
  if (live.state === "live") add(live.video, "Live right now", { live: true });
  if (latest.upload) add(latest.upload, "Latest upload");
  if (latest.stream && cards.length < 2) add(latest.stream, "Latest livestream");
  if (!latest.upload && cards.length < 2) {
    cards.push(emptyState({ title: "No uploads yet", text: "New videos appear here automatically after they're published on YouTube." }));
  }
  render(slot, cards);
  return shown;
}

/** Delegated: any [data-play] button opens the privacy-enhanced player. */
export function initPlayButtons(root) {
  root.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-play]");
    if (btn) openVideoModal({ id: btn.dataset.play, title: btn.dataset.title });
  });
}
