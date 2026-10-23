/**
 * "Game worlds": a cinematic scroll story, one pinned full-screen scene per top game.
 * Each scene: blurred-to-sharp background still, a haze layer and a huge title moving
 * at different speeds (layered parallax), revealed through a spotlight mask.
 * Below it, the game's info and a gallery that opens in the lightbox.
 * All motion is CSS driven by --enter/--hold/--exit from ui/scenes.js.
 */
import { html, render, safeUrl } from "../core/dom.js";
import { formatDate, formatViews } from "../core/format.js";
import { icon } from "../ui/icons.js";
import { openLightbox } from "../ui/lightbox.js";
import { initScenes } from "../ui/scenes.js";
import { GAME_STATUS } from "./games.js";
import { FALLBACK_THUMB } from "./templates.js";

const pad = (n) => String(n).padStart(2, "0");
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

function shotMeta(s) {
  return [s.kind === "stream" ? "Livestream" : "Video", formatDate(s.publishedAt), s.views != null ? formatViews(s.views) : ""].filter(Boolean).join(" · ");
}

function worldScene(w, i, total) {
  const lead = w.shots[0];
  const status = GAME_STATUS[w.status] ?? GAME_STATUS.completed;
  const titleId = `world-${w.slug}-title`;
  return html`
    <article class="world" id="world-${w.slug}" aria-labelledby="${titleId}" data-world-status="${w.status}">
      <div class="world__scene" data-scene>
        <div class="world__stage">
          <div class="world__layer world__layer--bg" aria-hidden="true">
            <img src="${safeUrl(lead.thumbnails.maxres, FALLBACK_THUMB)}" data-src-fallback="${safeUrl(lead.thumbnails.high, FALLBACK_THUMB)}"
              alt="" width="1280" height="720" loading="lazy" decoding="async">
          </div>
          <div class="world__layer world__layer--haze" aria-hidden="true"></div>
          <div class="world__layer world__layer--fg">
            <p class="world__index"><span>World ${pad(i + 1)}</span> / ${pad(total)}</p>
            <h3 class="world__title" id="${titleId}">${w.name}</h3>
            <p class="world__tag">${[status.label, w.genre].filter(Boolean).join(" · ")}</p>
          </div>
          <div class="world__progress" aria-hidden="true"><span></span></div>
        </div>
      </div>
      <div class="container world__body">
        <div class="world__info" data-reveal="fade-up">
          ${w.description ? html`<p class="world__desc">${w.description}</p>` : ""}
          <p class="world__counts">${[w.streamCount ? plural(w.streamCount, "stream") : "", plural(w.videoCount, "video")].filter(Boolean).join(" · ")} on the channel</p>
          <div class="cluster">
            <button class="btn btn--primary" type="button" data-play="${lead.id}" data-title="${lead.title}" data-track="world_play_latest" data-track-target="${w.slug}">${icon("play")}Play latest</button>
            <button class="btn btn--ghost" type="button" data-world-videos="${w.slug}" data-track="world_all_videos" data-track-target="${w.slug}">All videos${icon("arrowRight")}</button>
          </div>
        </div>
        <ul class="world__gallery" role="list" data-stagger="fade-up">
          ${w.shots.map((s, j) => html`
            <li>
              <button class="world__shot" type="button" data-world-shot="${w.slug}" data-shot="${j}" aria-label="${s.title}: view larger">
                <img src="${safeUrl(j === 0 ? s.thumbnails.maxres : s.thumbnails.medium, FALLBACK_THUMB)}" data-src-fallback="${safeUrl(s.thumbnails.high, FALLBACK_THUMB)}"
                  alt="" width="480" height="270" loading="lazy" decoding="async">
              </button>
            </li>`)}
        </ul>
      </div>
    </article>`;
}

export function renderWorlds(slot, { worlds = [] }, { onShowVideos }) {
  const section = slot?.closest("[data-section]");
  if (!slot || !section) return;
  if (!worlds.length) {
    section.hidden = true; // nothing to tell yet: skip the whole story rather than show an empty stage
    return;
  }
  render(slot, worlds.map((w, i) => worldScene(w, i, worlds.length)));

  slot.onclick = (e) => {
    const shot = e.target.closest("[data-world-shot]");
    if (shot) {
      const world = worlds.find((w) => w.slug === shot.dataset.worldShot);
      openLightbox(world.shots.map((s) => ({
        src: s.thumbnails.maxres, fallback: s.thumbnails.high, title: s.title, meta: shotMeta(s), url: s.url, playId: s.id,
      })), Number(shot.dataset.shot));
      return;
    }
    const all = e.target.closest("[data-world-videos]");
    if (all) onShowVideos(all.dataset.worldVideos);
  };

  initScenes(section); // the intro statement (static markup) and every world scene
}
