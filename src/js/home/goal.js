/** Subscriber goal with animated progress and a one-time celebration. */
import { $, html, render, safeUrl } from "../core/dom.js";
import { formatNumber, formatDate } from "../core/format.js";

const CONFETTI_COLORS = ["var(--color-primary)", "var(--color-secondary)", "var(--color-warning)", "var(--color-success)", "#ffffff"];

function celebrate(card, key) {
  try {
    if (localStorage.getItem(key)) return;
    localStorage.setItem(key, "1");
  } catch { /* storage blocked: celebrate anyway, once per page view */ }
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const layer = document.createElement("div");
  layer.className = "confetti";
  layer.setAttribute("aria-hidden", "true");
  for (let i = 0; i < 36; i++) {
    const piece = document.createElement("i");
    piece.style.setProperty("--x", `${Math.random() * 100}%`);
    piece.style.setProperty("--dx", `${(Math.random() - 0.5) * 160}px`);
    piece.style.setProperty("--r", `${Math.random() * 720 - 360}deg`);
    piece.style.setProperty("--d", `${Math.random() * 400}ms`);
    piece.style.setProperty("--c", CONFETTI_COLORS[i % CONFETTI_COLORS.length]);
    layer.append(piece);
  }
  card.append(layer);
  setTimeout(() => layer.remove(), 3200);
}

export function renderGoal(slot, { goal, settings }) {
  const section = slot.closest("[data-section]");
  if (!goal || goal.current == null) {
    section.hidden = true; // no live subscriber number → don't show a stale goal
    return;
  }
  const need = Math.max(1, goal.target - goal.start);
  const gained = Math.max(0, goal.current - goal.start);
  const remaining = Math.max(0, goal.target - goal.current);
  const pct = Math.min(100, Math.round((gained / need) * 100));
  const achieved = goal.current >= goal.target;

  render(slot, html`
    <div class="card goal ${achieved ? "goal--achieved" : ""}" data-reveal="scale">
      <div class="stack stack--sm">
        <p class="eyebrow">${achieved ? "Goal reached 🎉" : "Subscriber goal"}</p>
        <h2 class="section-header__title" id="goal-title">${goal.title}</h2>
        ${goal.description ? html`<p class="text-soft">${goal.description}</p>` : ""}
      </div>
      <div class="goal__numbers">
        <span class="goal__current text-gradient">${formatNumber(goal.current, "full")}</span>
        <span class="text-muted">of ${formatNumber(goal.target, "full")} subscribers</span>
      </div>
      <div class="progress" role="progressbar" aria-label="${goal.title}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}" aria-valuetext="${pct}% · ${gained} gained, ${remaining} to go">
        <div class="progress__fill"></div>
      </div>
      <div class="goal__legend">
        <span><b>+${formatNumber(gained, "full")}</b> gained (${pct}%)</span>
        <span>${achieved ? "Thank you, Phantom Troupe! 💜" : html`<b>${formatNumber(remaining, "full")}</b> to go${goal.deadline ? ` · by ${formatDate(goal.deadline)}` : ""}`}</span>
      </div>
      ${achieved ? "" : html`<a class="btn btn--youtube" href="${safeUrl(settings.links?.subscribe)}" target="_blank" rel="noopener" data-track="subscribe_click">Help reach the goal: subscribe</a>`}
    </div>`);

  const card = $(".goal", slot);
  new IntersectionObserver(([entry], io) => {
    if (!entry.isIntersecting) return;
    io.disconnect();
    $(".progress__fill", card).style.setProperty("--progress", String(pct / 100));
    if (achieved && goal.celebrate) celebrate(card, `dp:goal-celebrated:${goal.target}`);
  }, { threshold: 0.5 }).observe(card);
}
