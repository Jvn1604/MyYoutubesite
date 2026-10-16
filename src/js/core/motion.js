/** Single source of truth for "may we animate?" (OS setting or the admin's motion setting). */
const reduced = matchMedia("(prefers-reduced-motion: reduce)");

export function motionAllowed() {
  return !reduced.matches && document.documentElement.dataset.motion !== "off";
}

/** Fine pointer (mouse/trackpad) that can hover: pointer-follow effects only make sense here. */
export const hasFinePointer = () => matchMedia("(hover: hover) and (pointer: fine)").matches;

/**
 * Pause infinite CSS animations on elements that are off-screen (saves CPU/battery).
 * Elements opt in with [data-pause-offscreen]; CSS pauses anything under [data-offscreen].
 */
export function pauseWhenOffscreen(root = document) {
  if (!("IntersectionObserver" in window)) return;
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => e.target.toggleAttribute("data-offscreen", !e.isIntersecting));
  });
  root.querySelectorAll("[data-pause-offscreen]").forEach((el) => io.observe(el));
}
