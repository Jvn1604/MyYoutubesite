/**
 * Full-screen image viewer on native <dialog> (focus trap, Esc, inert page for free).
 * ← / → keys, swipe, prev/next buttons, live "3 / 6" counter, focus returns to the opener.
 *
 * openLightbox(items, startIndex)
 *   items: [{ src, fallback, title, meta, url, playId }]
 *   playId → a "Play here" button ([data-play], handled by the page's player)
 */
import { html, render, safeUrl } from "../core/dom.js";
import { icon } from "./icons.js";

const SWIPE_PX = 50;

export function openLightbox(items, start = 0) {
  if (!items.length) return null;
  const opener = document.activeElement;
  let index = Math.min(Math.max(start, 0), items.length - 1);

  const dialog = document.createElement("dialog");
  dialog.className = "lightbox";
  dialog.setAttribute("aria-label", "Image viewer");
  const many = items.length > 1;
  render(dialog, html`
    <figure class="lightbox__figure">
      <div class="lightbox__frame"><img class="lightbox__img" alt="" decoding="async"></div>
      <figcaption class="lightbox__caption">
        ${many ? html`<p class="lightbox__count" aria-live="polite"></p>` : ""}
        <h2 class="lightbox__title"></h2>
        <p class="lightbox__meta"></p>
        <div class="cluster lightbox__actions"></div>
      </figcaption>
    </figure>
    ${many ? html`
      <button class="icon-btn lightbox__nav lightbox__nav--prev" type="button" data-step="-1" aria-label="Previous image">${icon("arrowRight")}</button>
      <button class="icon-btn lightbox__nav lightbox__nav--next" type="button" data-step="1" aria-label="Next image">${icon("arrowRight")}</button>` : ""}
    <button class="icon-btn lightbox__close" type="button" data-close aria-label="Close image viewer">${icon("close")}</button>`);

  const img = dialog.querySelector(".lightbox__img");
  const preload = (i) => { const item = items[(i + items.length) % items.length]; if (item) new Image().src = item.src; };

  function show(i) {
    index = (i + items.length) % items.length;
    const item = items[index];
    img.onerror = () => { img.onerror = null; if (item.fallback) img.src = safeUrl(item.fallback, ""); };
    img.src = safeUrl(item.src, "");
    img.alt = item.title;
    const count = dialog.querySelector(".lightbox__count");
    if (count) count.textContent = `${index + 1} / ${items.length}`;
    dialog.querySelector(".lightbox__title").textContent = item.title;
    dialog.querySelector(".lightbox__meta").textContent = item.meta || "";
    render(dialog.querySelector(".lightbox__actions"), html`
      ${item.playId ? html`<button class="btn btn--primary btn--sm" type="button" data-play="${item.playId}" data-title="${item.title}" data-track="world_play">${icon("play")}Play here</button>` : ""}
      ${item.url ? html`<a class="btn btn--ghost btn--sm" href="${safeUrl(item.url)}" target="_blank" rel="noopener" data-track="world_youtube">${icon("youtube")}Watch on YouTube</a>` : ""}`);
    if (many) { preload(index + 1); preload(index - 1); }
  }

  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    if (dialog.open) dialog.close();
    dialog.remove();
    if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
  };

  let swiped = false;
  dialog.addEventListener("click", (e) => {
    if (swiped) { swiped = false; return; } // the click that ends a swipe isn't a "close" click
    const step = e.target.closest("[data-step]");
    if (step) return show(index + Number(step.dataset.step));
    // Play: close first so the player opens over the page, not over the viewer
    if (e.target.closest("[data-close], [data-play]") || e.target === dialog) close();
  });
  dialog.addEventListener("keydown", (e) => {
    if (!many) return;
    if (e.key === "ArrowRight") { e.preventDefault(); show(index + 1); }
    if (e.key === "ArrowLeft") { e.preventDefault(); show(index - 1); }
  });
  let startX = null;
  dialog.addEventListener("pointerdown", (e) => { startX = e.isPrimary ? e.clientX : null; });
  dialog.addEventListener("pointerup", (e) => {
    if (startX == null || !many) return;
    const dx = e.clientX - startX;
    startX = null;
    if (Math.abs(dx) > SWIPE_PX) { swiped = true; show(index + (dx < 0 ? 1 : -1)); }
  });
  dialog.addEventListener("close", close);

  show(index);
  document.body.append(dialog);
  dialog.showModal();
  dialog.querySelector(many ? ".lightbox__nav--next" : ".lightbox__close").focus();
  return { dialog, close, show };
}
