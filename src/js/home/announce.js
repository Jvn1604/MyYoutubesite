/**
 * Slim announcement strip above the nav: "LIVE NOW" while streaming, otherwise a
 * video uploaded in the last week. Dismissible per video (session only), and it
 * tucks away once the visitor scrolls so the nav slides back to the top.
 */
import { html, render, safeUrl } from "../core/dom.js";
import { icon } from "../ui/icons.js";

const NEW_FOR_MS = 7 * 24 * 3600e3;
const DISMISS_KEY = "dp_announce_dismissed";
const root = globalThis.document?.documentElement; // absent in unit tests (pure helpers only)

/** Pure: what (if anything) the strip should say. */
export function pickAnnouncement({ live, latest }, now = Date.now()) {
  if (live?.state === "live" && live.video) return { kind: "live", label: "Live now", cta: "Watch live", video: live.video };
  const upload = latest?.upload;
  if (upload && now - new Date(upload.publishedAt).getTime() < NEW_FOR_MS) return { kind: "new", label: "New video", cta: "Watch now", video: upload };
  return null;
}

const dismissed = () => { try { return sessionStorage.getItem(DISMISS_KEY); } catch { return null; } };
const dismiss = (id) => { try { sessionStorage.setItem(DISMISS_KEY, id); } catch { /* private mode: just hide */ } };

function hide(slot) {
  slot.hidden = true;
  root.removeAttribute("data-announce");
}

let tuckListening = false;
function tuckOnScroll() {
  if (tuckListening) return;
  tuckListening = true;
  let frame = 0;
  const update = () => {
    frame = 0;
    if (root.hasAttribute("data-announce")) root.setAttribute("data-announce", scrollY > 40 ? "tucked" : "shown");
  };
  addEventListener("scroll", () => { frame ||= requestAnimationFrame(update); }, { passive: true });
  update();
}

export function renderAnnounce(slot, data) {
  if (!slot) return;
  const a = pickAnnouncement(data);
  if (!a || dismissed() === a.video.id) return hide(slot);

  render(slot, html`
    <div class="container announce__inner">
      <span class="announce__label">${a.kind === "live" ? html`<span class="pill__dot" aria-hidden="true"></span>` : ""}${a.label}</span>
      <a class="announce__link" href="${safeUrl(a.video.url)}" target="_blank" rel="noopener" data-track="announce_${a.kind}" data-track-target="${a.video.id}">
        <span class="announce__title">${a.video.title}</span>
        <span class="announce__cta">${a.cta}${icon("arrowRight")}</span>
      </a>
      <button class="icon-btn announce__close" type="button" aria-label="Dismiss announcement">${icon("close")}</button>
    </div>`);
  slot.dataset.kind = a.kind;
  slot.hidden = false;
  root.setAttribute("data-announce", scrollY > 40 ? "tucked" : "shown");
  slot.querySelector(".announce__close").onclick = () => { dismiss(a.video.id); hide(slot); };
  tuckOnScroll();
}
