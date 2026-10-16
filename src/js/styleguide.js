// Dev-only: wires up styleguide.html demos using the real UI modules.
import { $, $$, html, render } from "./core/dom.js";
import { formatViews, formatDate, formatDuration } from "./core/format.js";
import { icon } from "./ui/icons.js";
import { toast } from "./ui/toast.js";
import { openModal, confirmDialog, openVideoModal } from "./ui/modal.js";
import { initReveal } from "./ui/reveal.js";
import { initCounters } from "./ui/counter.js";
import { initNavigation } from "./ui/menu.js";
import { enhanceImages } from "./core/dom.js";

document.documentElement.classList.add("js");

// Icons declared in markup via data attributes
$$("[data-icon]").forEach((el) => render(el, icon(el.dataset.icon)));
$$("[data-icon-left]").forEach((el) => el.insertAdjacentHTML("afterbegin", icon(el.dataset.iconLeft).value));
$$("[data-icon-prefix]").forEach((el) => el.insertAdjacentHTML("afterbegin", icon(el.dataset.iconPrefix).value));

// Colour swatches read the live token values
const TOKENS = ["--color-bg", "--color-surface", "--color-surface-elevated", "--color-border", "--color-primary", "--color-primary-text",
  "--color-secondary", "--color-youtube", "--color-text", "--color-muted", "--color-live", "--color-success", "--color-warning", "--color-error"];
render($(".sg-swatches"), TOKENS.map((t) => html`
  <div class="sg-swatch"><span class="sg-swatch__chip" data-swatch="${t}"></span><strong>${t.replace("--color-", "")}</strong><code>${t}</code></div>`));
$$("[data-swatch]").forEach((el) => el.style.setProperty("--swatch", `var(${el.dataset.swatch})`));

// Sample data shaped like the future /api/site payload
const FALLBACK_THUMB = "/fallback/thumbnail.svg";
const videos = [
  { id: "7utpCWTZQpg", title: "Valor Mortis – Napoleonic era Soulslike – Pt 1", kind: "stream", liveState: "ended", publishedAt: "2026-10-14T13:00:00Z", views: 1297, duration: 13320 },
  { id: "l80h8U2d7_E", title: "The Blood of Dawnwalker – Part 2", kind: "stream", liveState: "live", publishedAt: "2026-09-16T13:00:00Z", views: 1831, duration: 0 },
  { id: "invalid-id", title: "What is Soulslike? (broken thumbnail → fallback)", kind: "video", liveState: "none", publishedAt: "2026-10-01T10:00:00Z", views: 312, duration: 754 },
];
const kindBadge = (v) => v.liveState === "live" ? html`<span class="badge badge--solid badge--live">Live</span>`
  : v.liveState === "upcoming" ? html`<span class="badge badge--solid badge--upcoming">Upcoming</span>`
  : html`<span class="badge badge--solid">${v.kind === "stream" ? "Stream" : v.kind === "short" ? "Short" : "Video"}</span>`;

render($("#sg-videos"), videos.map((v) => html`
  <article class="card card--flush card--interactive video-card">
    <div class="media">
      <img src="https://i.ytimg.com/vi/${v.id}/mqdefault.jpg" data-src-fallback="${FALLBACK_THUMB}" alt="" loading="lazy" width="320" height="180">
      <div class="media__overlay">${kindBadge(v)}</div>
      ${v.duration ? html`<span class="badge badge--solid media__duration">${formatDuration(v.duration)}</span>` : ""}
    </div>
    <div class="video-card__body">
      <h3 class="video-card__title truncate-2"><a class="card__link" href="https://www.youtube.com/watch?v=${v.id}" target="_blank" rel="noopener">${v.title}</a></h3>
      <p class="video-card__meta"><span>${formatViews(v.views)}</span><span>${formatDate(v.publishedAt)}</span></p>
    </div>
  </article>`));

const games = [
  { name: "Valor Mortis", status: "Currently Playing", badge: "live" },
  { name: "Elden Ring", status: "Completed", badge: "published" },
  { name: "Bloodborne", status: "Favourite", badge: "featured" },
  { name: "Crimson Desert", status: "Upcoming", badge: "upcoming" },
];
render($("#sg-games"), games.map((g) => html`
  <article class="card card--flush card--interactive game-card">
    <div class="media"><img src="${FALLBACK_THUMB}" alt="" width="300" height="400"></div>
    <div class="game-card__body">
      <span class="badge badge--solid badge--${g.badge === "live" ? "info" : g.badge}">${g.status}</span>
      <h3 class="game-card__title"><a class="card__link" href="#cards">${g.name}</a></h3>
    </div>
  </article>`));

const socials = [
  { platform: "discord", label: "Discord", desc: "Chat, play together, stream alerts", accent: "#5865F2" },
  { platform: "whatsapp", label: "WhatsApp Channel", desc: "Going-live alerts on your phone", accent: "#25D366" },
  { platform: "instagram", label: "Instagram", desc: "Clips and behind the scenes", accent: "#E1306C" },
  { platform: "linktree", label: "All links", desc: "Everything in one place", accent: "#43E660" },
];
render($("#sg-socials"), socials.map((s) => html`
  <article class="card card--interactive social-card" data-accent="${s.accent}">
    ${icon(s.platform, { className: "social-card__icon" })}
    <h3 class="social-card__title"><a class="card__link" href="#cards">${s.label}</a></h3>
    <p class="social-card__desc">${s.desc}</p>
  </article>`));
$$("[data-accent]").forEach((el) => el.style.setProperty("--accent", el.dataset.accent));

// Demos
const demos = {
  "toast-success": () => toast.success("Settings saved"),
  "toast-warning": () => toast.warning("YouTube synchronization delayed, retrying"),
  "toast-error": () => toast.error("Unable to upload image: file is larger than 5 MB"),
  modal: () => openModal({
    title: "Edit game",
    body: html`<label class="field"><span class="field__label">Name</span><input class="input" value="Valor Mortis"></label>`,
    footer: html`<button class="btn btn--ghost" type="button" data-close="cancel">Cancel</button><button class="btn btn--primary" type="button" data-close="save">Save</button>`,
    onClose: (v) => v === "save" && toast.success("Game updated"),
  }),
  video: () => openVideoModal({ id: "7utpCWTZQpg", title: "Valor Mortis – Pt 1" }),
  confirm: async () => {
    const ok = await confirmDialog({ title: "Delete game?", message: "This removes “Mortal Shell” from the website. YouTube videos are not affected.", confirmLabel: "Delete", danger: true });
    ok ? toast.success("Game deleted") : toast.info("Cancelled");
  },
};
document.addEventListener("click", (e) => {
  const d = e.target.closest("[data-demo]")?.dataset.demo;
  if (d) demos[d]?.();
});
$("#sg-form").addEventListener("submit", (e) => { e.preventDefault(); toast.success("✓ Changes saved"); });

// Theme presets / motion toggle (same mechanism the admin appearance page will use)
const PRESETS = {
  phantom: { "--brand-primary": "#a855f7", "--brand-secondary": "#e04bff", "--brand-bg": "#0a0a0f" },
  blood: { "--brand-primary": "#e11d48", "--brand-secondary": "#ea580c", "--brand-bg": "#0c0708" },
  abyss: { "--brand-primary": "#0284c7", "--brand-secondary": "#6366f1", "--brand-bg": "#060a12" },
  minimal: { "--brand-primary": "#71717a", "--brand-secondary": "#52525b", "--brand-bg": "#09090b" },
};
$("#sg-preset").addEventListener("change", (e) => {
  Object.entries(PRESETS[e.target.value]).forEach(([k, v]) => document.documentElement.style.setProperty(k, v));
});
$("#sg-motion").addEventListener("change", (e) => {
  if (e.target.checked) document.documentElement.dataset.motion = "off";
  else delete document.documentElement.dataset.motion;
});

// Goal bar animates in when visible
new IntersectionObserver(([entry], io) => {
  if (!entry.isIntersecting) return;
  $("#sg-goal .progress__fill").style.setProperty("--progress", "0.45");
  io.disconnect();
}).observe($("#sg-goal"));

enhanceImages(document, FALLBACK_THUMB);
initNavigation();
initReveal();
initCounters();
