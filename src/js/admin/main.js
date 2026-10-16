/**
 * Admin app: verifies the session, renders the shell, routes #/page hashes to
 * lazily-loaded page modules (each page is its own chunk).
 */
import { $, $$, html, render } from "../core/dom.js";
import { icon } from "../ui/icons.js";
import { confirmDialog } from "../ui/modal.js";
import { formatRelative } from "../core/format.js";
import { requireSession, signOut, adminApi } from "./session.js";

const PAGES = [
  { group: "Overview" },
  { id: "dashboard", label: "Dashboard", icon: "grid", load: () => import("./pages/dashboard.js") },
  { group: "Website" },
  { id: "content", label: "Content", icon: "file", load: () => import("./pages/content.js") },
  { id: "sections", label: "Sections", icon: "layers", load: () => import("./pages/sections.js") },
  { id: "appearance", label: "Appearance", icon: "palette", load: () => import("./pages/appearance.js") },
  { id: "seo", label: "SEO & sharing", icon: "globe", load: () => import("./pages/seo.js") },
  { group: "Library" },
  { id: "videos", label: "Videos", icon: "film", load: () => import("./pages/videos.js") },
  { id: "games", label: "Games", icon: "gamepad", load: () => import("./pages/games.js") },
  { id: "media", label: "Media", icon: "image", load: () => import("./pages/media.js") },
  { group: "Channel" },
  { id: "schedule", label: "Schedule", icon: "calendar", load: () => import("./pages/schedule.js") },
  { id: "goals", label: "Goals", icon: "target", load: () => import("./pages/goals.js") },
  { id: "social", label: "Social links", icon: "share", load: () => import("./pages/social.js") },
  { id: "youtube", label: "YouTube sync", icon: "youtube", load: () => import("./pages/youtube.js") },
  { group: "Insights" },
  { id: "analytics", label: "Analytics", icon: "chart", load: () => import("./pages/analytics.js") },
  { group: "Account" },
  { id: "settings", label: "Settings", icon: "settings", load: () => import("./pages/settings.js") },
];
const ROUTES = PAGES.filter((p) => p.id);

const outlet = $('[data-slot="outlet"]');
const sidebar = $("#admin-sidebar");
const scrim = $(".admin-scrim");
const menuBtn = $('[data-action="open-nav"]');
let current = { id: null, leave: null };

function drawNav() {
  render($('[data-slot="nav"]'), PAGES.map((p) => (p.group
    ? html`<p class="admin-nav__group">${p.group}</p>`
    : html`<a class="admin-nav__link" href="#/${p.id}" data-nav="${p.id}">${icon(p.icon)}${p.label}</a>`)));
  $$("[data-icon-left]").forEach((el) => el.insertAdjacentHTML("afterbegin", icon(el.dataset.iconLeft).value));
  $$("[data-icon]").forEach((el) => render(el, icon(el.dataset.icon)));
}

function setNavOpen(open) {
  sidebar.toggleAttribute("data-open", open);
  scrim.hidden = !open;
  menuBtn.setAttribute("aria-expanded", String(open));
  if (open) $("a, button", sidebar)?.focus();
}

async function navigate() {
  const id = location.hash.replace(/^#\/?/, "").split("?")[0] || "dashboard";
  const page = ROUTES.find((p) => p.id === id) ?? ROUTES[0];
  if (page.id === current.id) return;

  // Unsaved changes guard
  if (current.leave?.() && !(await confirmDialog({ title: "Leave without saving?", message: "You have unsaved changes on this page.", confirmLabel: "Leave page", danger: true }))) {
    history.replaceState(null, "", `#/${current.id}`);
    return;
  }

  current = { id: page.id, leave: null };
  $$("[data-nav]").forEach((a) => (a.dataset.nav === page.id ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current")));
  $('[data-slot="page-title"]').textContent = page.label;
  document.title = `${page.label} | DePhantom Admin`;
  setNavOpen(false);
  // Each visit gets its own container: if the user navigates away before a slow
  // page finishes loading, that page renders into a detached element, not over the new one.
  const view = document.createElement("div");
  view.className = "admin-view";
  render(view, html`<div class="card"><span class="skeleton skeleton--title"></span><span class="skeleton skeleton--text"></span><span class="skeleton skeleton--text"></span></div>`);
  outlet.replaceChildren(view);

  try {
    const mod = await page.load();
    if (!view.isConnected) return; // navigated away while loading
    const handle = await mod.mount(view);
    if (view.isConnected) current.leave = handle?.isDirty ?? null;
  } catch (err) {
    console.error(err);
    if (view.isConnected) render(view, html`<div class="empty empty--error">${icon("alert", { className: "empty__icon" })}<p class="empty__title">This page couldn't load</p><p class="text-sm">${err.message}</p></div>`);
  }
  if (!view.isConnected) return;
  outlet.focus({ preventScroll: true });
  scrollTo({ top: 0 });
}

/** Topbar badge: overall YouTube sync health (refreshed every minute). */
export async function refreshSyncBadge() {
  const badge = $('[data-slot="sync-status"]');
  const res = await adminApi("/api/cms/youtube");
  if (!res.ok) return;
  const s = res.data;
  const map = {
    ok: ["badge--synced", `Synced ${s.lastSuccessAt ? formatRelative(s.lastSuccessAt) : ""}`],
    error: ["badge--error", "Sync error"],
    never_synced: ["badge--upcoming", "Never synced"],
    not_configured: ["badge--hidden", "YouTube not connected"],
  };
  const [cls, label] = map[s.health] ?? map.never_synced;
  badge.className = `badge ${cls} admin-sync`;
  badge.textContent = label;
}

async function main() {
  const admin = await requireSession();
  drawNav();
  $('[data-slot="admin-email"]').textContent = admin.email;
  document.documentElement.classList.remove("auth-pending");

  $$('[data-action="logout"]').forEach((b) => b.addEventListener("click", signOut));
  menuBtn.addEventListener("click", () => setNavOpen(true));
  scrim.addEventListener("click", () => setNavOpen(false));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && sidebar.hasAttribute("data-open")) { setNavOpen(false); menuBtn.focus(); } });

  const profileBtn = $('[data-action="profile"]');
  const profileMenu = $('[data-slot="profile-menu"]');
  const setProfile = (open) => { profileMenu.hidden = !open; profileBtn.setAttribute("aria-expanded", String(open)); };
  profileBtn.addEventListener("click", () => setProfile(profileMenu.hidden));
  document.addEventListener("click", (e) => { if (!e.target.closest(".admin-menu")) setProfile(false); });
  profileMenu.addEventListener("click", () => setProfile(false));

  addEventListener("hashchange", navigate);
  addEventListener("beforeunload", (e) => { if (current.leave?.()) e.preventDefault(); });
  await navigate();
  refreshSyncBadge();
  setInterval(() => !document.hidden && refreshSyncBadge(), 60_000);
}

main();
