/**
 * Scroll reveal for [data-reveal] elements.
 * Children of [data-stagger] get --i so they cascade.
 * Call again after rendering new content; already-revealed nodes are skipped.
 */
import { $$ } from "../core/dom.js";

let observer;

function getObserver() {
  observer ??= new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.setAttribute("data-revealed", "");
        observer.unobserve(entry.target);
      }
    },
    { rootMargin: "0px 0px -8% 0px", threshold: 0.05 }
  );
  return observer;
}

export function initReveal(root = document) {
  $$("[data-stagger]", root).forEach((parent) => {
    [...parent.children].forEach((child, i) => {
      if (!child.hasAttribute("data-reveal")) child.setAttribute("data-reveal", parent.dataset.stagger || "fade-up");
      child.style.setProperty("--i", String(Math.min(i, 8)));
    });
  });

  const targets = $$("[data-reveal]:not([data-revealed])", root);
  if (!("IntersectionObserver" in window)) {
    targets.forEach((el) => el.setAttribute("data-revealed", ""));
    return;
  }
  targets.forEach((el) => getObserver().observe(el));
}
