/**
 * Modals built on native <dialog>: the browser handles focus trapping,
 * Esc to close and inert background. We add backdrop-click close,
 * focus return, and promise-based helpers.
 */
import { html, raw, render } from "../core/dom.js";

let modalCount = 0; // unique ids for aria-labelledby (crypto.randomUUID needs a secure context)

const CLOSE_ICON = html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>`;

/**
 * openModal({ title, body, footer, wide, media, onClose }) → { dialog, close }
 * body/footer are html`` results. Buttons with [data-close="value"] close the dialog with that value.
 */
export function openModal({ title, body, footer, wide = false, media = false, dismissible = true, onClose } = {}) {
  const opener = document.activeElement;
  const dialog = document.createElement("dialog");
  dialog.className = ["modal", wide && "modal--wide", media && "modal--media"].filter(Boolean).join(" ");
  const titleId = `modal-title-${++modalCount}`;
  dialog.setAttribute("aria-labelledby", titleId);

  render(dialog, html`
    <header class="modal__header">
      <h2 class="modal__title" id="${titleId}">${title}</h2>
      ${dismissible ? html`<button class="icon-btn" type="button" data-close="" aria-label="Close dialog">${CLOSE_ICON}</button>` : ""}
    </header>
    <div class="modal__body">${body}</div>
    ${footer ? html`<footer class="modal__footer">${footer}</footer>` : ""}`);

  // Settle exactly once, whichever happens first: our own close() or the browser's
  // "close" event (Esc). We don't rely on the event alone because Chrome delivers it
  // with rendering, which is paused in background tabs.
  let settled = false;
  const finish = (value) => {
    if (settled) return;
    settled = true;
    onClose?.(value);
    dialog.remove();
    if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
  };
  const close = (value = "") => {
    if (dialog.open) dialog.close(value);
    finish(value);
  };

  dialog.addEventListener("click", (e) => {
    const closer = e.target.closest("[data-close]");
    if (closer) return close(closer.dataset.close);
    // Click on the backdrop = click on the dialog element itself, outside its box
    if (dismissible && e.target === dialog) {
      const r = dialog.getBoundingClientRect();
      const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
      if (!inside) close("");
    }
  });
  if (!dismissible) dialog.addEventListener("cancel", (e) => e.preventDefault());

  dialog.addEventListener("close", () => finish(dialog.returnValue));

  document.body.append(dialog);
  dialog.showModal();
  // Focus the first meaningful control rather than the close button
  (dialog.querySelector("[autofocus]") || dialog.querySelector(".modal__body :is(input,select,textarea,button,a[href])"))?.focus();
  return { dialog, close };
}

/** await confirmDialog({ title, message, confirmLabel, danger }) → boolean */
export function confirmDialog({ title = "Are you sure?", message = "", confirmLabel = "Confirm", cancelLabel = "Cancel", danger = false } = {}) {
  return new Promise((resolve) => {
    openModal({
      title,
      body: html`<p class="text-soft">${message}</p>`,
      footer: html`
        <button class="btn btn--ghost" type="button" data-close="cancel" ${danger ? raw("autofocus") : ""}>${cancelLabel}</button>
        <button class="btn ${danger ? "btn--danger" : "btn--primary"}" type="button" data-close="confirm" ${danger ? "" : raw("autofocus")}>${confirmLabel}</button>`,
      onClose: (value) => resolve(value === "confirm"),
    });
  });
}

/** Lightweight YouTube player modal (privacy-enhanced embed, loads only on open). */
export function openVideoModal({ id, title }) {
  const src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?autoplay=1&rel=0`;
  return openModal({
    title,
    wide: true,
    media: true,
    body: html`<iframe src="${src}" title="${title}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>`,
  });
}
