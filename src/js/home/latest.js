/** Latest section: live stream (if any), latest upload, latest finished stream. */
import { html, render, safeUrl } from "../core/dom.js";
import { icon } from "../ui/icons.js";
import { openVideoModal } from "../ui/modal.js";
import { stateBadge, videoMeta, thumbnailImg, emptyState } from "./templates.js";

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
      </div>
    </article>`;
}

export function renderLatest(slot, { live, latest }) {
  const cards = [];
  if (live.state === "live") cards.push(latestCard(live.video, "Live right now", { live: true }));
  if (latest.upload) cards.push(latestCard(latest.upload, "Latest upload"));
  if (latest.stream && cards.length < 2) cards.push(latestCard(latest.stream, "Latest livestream"));
  if (!latest.upload && cards.length < 2) {
    cards.push(emptyState({ title: "No uploads yet", text: "New videos appear here automatically after they're published on YouTube." }));
  }
  render(slot, cards);
}

/** Delegated: any [data-play] button opens the privacy-enhanced player. */
export function initPlayButtons(root) {
  root.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-play]");
    if (btn) openVideoModal({ id: btn.dataset.play, title: btn.dataset.title });
  });
}
