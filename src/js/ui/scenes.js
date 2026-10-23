/**
 * Scroll scenes: a tall [data-scene] wrapper holds a sticky full-screen stage.
 * While it passes through the viewport we write three CSS variables (0…1) and
 * let CSS do every visual change (transform, opacity, mask — no layout work):
 *
 *   --enter  wrapper top travels from the viewport bottom to the top (stage slides in)
 *   --hold   the stage is pinned; scrolling advances the scene
 *   --exit   the wrapper bottom leaves (stage slides out)
 *
 * One passive scroll listener, one rAF per frame, and only scenes near the
 * viewport are measured. With reduced motion nothing runs and CSS shows a
 * static, un-pinned version.
 */
import { motionAllowed } from "../core/motion.js";

const clamp01 = (n) => (n < 0 ? 0 : n > 1 ? 1 : n);

/** Pure so it can be tested: progress of a scene from its bounding box. */
export function sceneProgress(top, height, viewport) {
  const travel = Math.max(height - viewport, 1);
  return {
    enter: clamp01((viewport - top) / viewport),
    hold: clamp01(-top / travel),
    exit: clamp01((-top - travel) / viewport),
  };
}

const active = new Set();
let observer;
let frame = 0;
let listening = false;

function update() {
  frame = 0;
  const vh = innerHeight;
  for (const el of active) {
    const r = el.getBoundingClientRect();
    const p = sceneProgress(r.top, r.height, vh);
    el.style.setProperty("--enter", p.enter.toFixed(4));
    el.style.setProperty("--hold", p.hold.toFixed(4));
    el.style.setProperty("--exit", p.exit.toFixed(4));
    el.toggleAttribute("data-pinned", p.enter === 1 && p.exit === 0);
  }
}

const schedule = () => { frame ||= requestAnimationFrame(update); };

export function initScenes(root = document) {
  const scenes = [...root.querySelectorAll("[data-scene]")];
  if (!scenes.length || !motionAllowed() || !("IntersectionObserver" in window)) return;
  document.documentElement.setAttribute("data-scenes", "");

  observer ??= new IntersectionObserver((entries) => {
    entries.forEach((e) => (e.isIntersecting ? active.add(e.target) : active.delete(e.target)));
    schedule();
  }, { rootMargin: "50% 0px" });
  scenes.forEach((el) => observer.observe(el));

  if (!listening) {
    listening = true;
    addEventListener("scroll", schedule, { passive: true });
    addEventListener("resize", schedule, { passive: true });
  }
  schedule();
}
