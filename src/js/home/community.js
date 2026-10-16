/** Community links, support options and the About profile. */
import { $$, html, render, safeUrl } from "../core/dom.js";
import { formatDate } from "../core/format.js";
import { icon, ICON_NAMES } from "../ui/icons.js";
import { emptyState } from "./templates.js";

const HEX = /^#[0-9a-f]{6}$/i;

export function renderSocials(slot, { socials }) {
  if (!socials.length) return render(slot, emptyState({ title: "Community links coming soon" }));
  render(slot, socials.map((s) => html`
    <article class="card card--interactive social-card" data-accent="${HEX.test(s.accent ?? "") ? s.accent : ""}">
      ${icon(ICON_NAMES.includes(s.icon) ? s.icon : "link", { className: "social-card__icon" })}
      <h3 class="social-card__title">
        <a class="card__link" href="${safeUrl(s.url)}" target="_blank" rel="noopener" data-track="${s.platform}_click">${s.label}</a>
      </h3>
      ${s.description ? html`<p class="social-card__desc">${s.description}</p>` : ""}
    </article>`));
  $$("[data-accent]", slot).forEach((el) => el.dataset.accent && el.style.setProperty("--accent", el.dataset.accent));
}

export function renderSupport(slot, { settings }) {
  const s = settings.support;
  const methods = s.methods.filter((m) => m.enabled);
  const section = slot.closest("[data-section]");
  if (!methods.length) { section.hidden = true; return; }
  render(slot, html`
    <div class="card card--glow support" data-reveal="fade-up">
      <div class="stack">
        <p class="eyebrow">Support the channel</p>
        <h2 class="section-header__title" id="support-title">${s.title}</h2>
        <p class="text-soft">${s.text}</p>
        ${s.perksEnabled && s.perks.length ? html`
          <ul class="support__perks" role="list" aria-label="Member perks">${s.perks.map((p) => html`<li>${p}</li>`)}</ul>` : ""}
      </div>
      <div class="support__methods">
        ${methods.map((m, i) => html`
          <div class="support__method">
            <div><strong>${m.label}</strong>${m.description ? html`<p>${m.description}</p>` : ""}</div>
            <a class="btn ${i === 0 ? "btn--primary" : "btn--ghost"} btn--sm" href="${safeUrl(m.url)}" target="_blank" rel="noopener"
              data-track="${m.key}_click" aria-label="${m.label}">${icon("arrowRight")}</a>
          </div>`)}
      </div>
    </div>`);
}

export function renderAbout(slot, { settings, channel }) {
  const a = settings.about;
  const photo = a.photoUrl || channel?.avatarUrl || settings.brand.logoUrl;
  const milestoneDate = (d) => (/^\d{4}-\d{2}$/.test(d) ? formatDate(`${d}-01`, { month: "short", year: "numeric" }) : formatDate(d));
  render(slot, html`
    <div class="split about">
      <img class="about__photo" src="${safeUrl(photo)}" alt="${settings.brand.name} profile picture" loading="lazy" width="420" height="420" data-reveal="scale">
      <div class="stack about__text" data-reveal="fade-up">
        <p class="eyebrow">About</p>
        <h2 class="section-header__title" id="about-title">${a.title}</h2>
        ${a.paragraphs.map((p) => html`<p>${p}</p>`)}
        ${a.channelStart ? html`<p class="text-sm text-muted">Streaming since ${formatDate(a.channelStart, { month: "long", year: "numeric" })}</p>` : ""}
        ${a.genres?.length ? html`<div class="cluster" aria-label="Favourite genres">${a.genres.map((g) => html`<span class="chip">${g}</span>`)}</div>` : ""}
        ${a.features?.length ? html`<ul class="about__features" role="list">${a.features.map((f) => html`<li>${f}</li>`)}</ul>` : ""}
        ${a.milestones?.length ? html`
          <h3 class="eyebrow">Milestones</h3>
          <ol class="timeline" role="list">
            ${a.milestones.map((m) => html`<li><time datetime="${m.date}">${milestoneDate(m.date)}</time><span>${m.title}</span></li>`)}
          </ol>` : ""}
      </div>
    </div>`);
}
