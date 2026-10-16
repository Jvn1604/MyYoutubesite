/** Shared markup builders for homepage cards. All output goes through html``. */
import { html, safeUrl } from "../core/dom.js";
import { formatViews, formatDate, formatDuration, formatNumber, formatRelative } from "../core/format.js";
import { icon } from "../ui/icons.js";

export const FALLBACK_THUMB = "/src/assets/fallback/thumbnail.svg";

const KIND_LABEL = { video: "Video", stream: "Stream", short: "Short" };

export function stateBadge(video) {
  if (video.liveState === "live") return html`<span class="badge badge--solid badge--live">Live</span>`;
  if (video.liveState === "upcoming") return html`<span class="badge badge--solid badge--upcoming">Upcoming</span>`;
  return html`<span class="badge badge--solid">${KIND_LABEL[video.kind] ?? "Video"}</span>`;
}

export function videoMeta(video) {
  const parts = [];
  if (video.liveState === "live" && video.concurrentViewers != null) parts.push(`${formatNumber(video.concurrentViewers)} watching`);
  else if (video.liveState === "upcoming" && video.scheduledStart) parts.push(`Starts ${formatRelative(video.scheduledStart)}`);
  else if (video.views != null) parts.push(formatViews(video.views));
  if (video.liveState !== "upcoming") parts.push(formatDate(video.publishedAt));
  if (video.game) parts.push(video.game.name);
  return html`${parts.map((p) => html`<span>${p}</span>`)}`;
}

export function thumbnailImg(video, size = "medium", { eager = false } = {}) {
  const src = video.thumbnails?.[size] || video.thumbnails?.high || FALLBACK_THUMB;
  return html`<img src="${safeUrl(src, FALLBACK_THUMB)}" data-src-fallback="${FALLBACK_THUMB}" alt="" width="480" height="270"
    ${eager ? "" : html`loading="lazy" decoding="async"`}>`;
}

/** Standard grid card: whole card links to YouTube. */
export function videoCard(video, { track = "watch_video" } = {}) {
  return html`
    <article class="card card--flush card--interactive video-card">
      <div class="media">
        ${thumbnailImg(video)}
        <div class="media__overlay">${stateBadge(video)}</div>
        ${video.durationSeconds ? html`<span class="badge badge--solid media__duration">${formatDuration(video.durationSeconds)}</span>` : ""}
      </div>
      <div class="video-card__body">
        <h3 class="video-card__title truncate-2">
          <a class="card__link" href="${safeUrl(video.url)}" target="_blank" rel="noopener" data-track="${track}" data-track-target="${video.id}">${video.title}</a>
        </h3>
        <p class="video-card__meta">${videoMeta(video)}</p>
      </div>
    </article>`;
}

export function skeletonCards(count, { cover = false } = {}) {
  return html`${Array.from({ length: count }, () => html`
    <div class="card card--flush" aria-hidden="true">
      <span class="skeleton skeleton--media ${cover ? "skeleton--cover" : ""}"></span>
      <div class="video-card__body"><span class="skeleton skeleton--title"></span><span class="skeleton skeleton--text"></span></div>
    </div>`)}`;
}

export function emptyState({ title, text = "", iconName = "inbox", error = false, action = "" }) {
  return html`
    <div class="empty ${error ? "empty--error" : ""}">
      ${icon(iconName, { className: "empty__icon" })}
      <p class="empty__title">${title}</p>
      ${text ? html`<p class="text-sm">${text}</p>` : ""}
      ${action}
    </div>`;
}

export function ctaButton({ label, url, style = "ghost", key }, extraClass = "") {
  const external = /^https?:/i.test(url);
  const iconName = { live: "youtube", subscribe: "bell", discord: "discord", latest: "play" }[key];
  return html`
    <a class="btn btn--${style} ${extraClass}" href="${safeUrl(url)}" ${external ? html`target="_blank" rel="noopener"` : ""} data-track="cta_${key}">
      ${iconName ? icon(iconName) : ""}${label}
    </a>`;
}
