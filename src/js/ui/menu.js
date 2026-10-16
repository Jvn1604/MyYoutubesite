/**
 * Site navigation behaviour:
 * - solid background once scrolled
 * - accessible mobile menu (aria-expanded, Esc, outside click, focus return)
 * - active section highlighting via aria-current
 * - back-to-top button visibility
 */
import { $, $$ } from "../core/dom.js";

export function initNavigation({ nav = $(".site-nav"), toTop = $(".to-top") } = {}) {
  if (!nav) return;
  const toggle = $(".nav-toggle", nav);
  const menu = $(".nav-links", nav);

  // Scroll state (rAF-throttled, passive)
  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      nav.toggleAttribute("data-scrolled", scrollY > 16);
      toTop?.toggleAttribute("data-visible", scrollY > innerHeight * 1.2);
      ticking = false;
    });
  };
  addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  toTop?.addEventListener("click", () => {
    scrollTo({ top: 0 });
    $("#main")?.focus({ preventScroll: true });
  });

  // Mobile menu
  if (toggle && menu) {
    const setOpen = (open, { returnFocus = false } = {}) => {
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
      menu.toggleAttribute("data-open", open);
      document.body.style.overflow = open ? "hidden" : "";
      if (open) $("a, button", menu)?.focus();
      else if (returnFocus) toggle.focus();
    };
    toggle.addEventListener("click", () => setOpen(toggle.getAttribute("aria-expanded") !== "true"));
    menu.addEventListener("click", (e) => { if (e.target.closest("a")) setOpen(false); });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && menu.hasAttribute("data-open")) setOpen(false, { returnFocus: true });
    });
    document.addEventListener("click", (e) => {
      if (menu.hasAttribute("data-open") && !nav.contains(e.target)) setOpen(false);
    });
    matchMedia("(min-width: 1025px)").addEventListener("change", (e) => { if (e.matches) setOpen(false); });
  }

  // Active section → aria-current on matching nav link
  const links = $$('.nav-link[href^="#"]', nav);
  const sections = links.map((a) => document.getElementById(a.hash.slice(1))).filter(Boolean);
  if (!sections.length || !("IntersectionObserver" in window)) return;
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      links.forEach((a) => {
        if (a.hash === `#${e.target.id}`) a.setAttribute("aria-current", "true");
        else a.removeAttribute("aria-current");
      });
    });
  }, { rootMargin: "-45% 0px -50% 0px" });
  sections.forEach((s) => io.observe(s));
}
