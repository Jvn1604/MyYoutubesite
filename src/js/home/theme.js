/**
 * Applies admin appearance settings to the design tokens and remembers them
 * (public/boot.js re-applies the cached copy before first paint next visit).
 */
const HEX = /^#[0-9a-f]{6}$/i;

export function applyAppearance(appearance = {}) {
  const root = document.documentElement;
  const { primary, secondary, background, radiusScale, motion } = appearance;
  if (HEX.test(primary ?? "")) root.style.setProperty("--brand-primary", primary);
  if (HEX.test(secondary ?? "")) root.style.setProperty("--brand-secondary", secondary);
  if (HEX.test(background ?? "")) root.style.setProperty("--brand-bg", background);
  if (Number.isFinite(radiusScale)) root.style.setProperty("--radius-scale", String(Math.min(1.5, Math.max(0, radiusScale))));
  if (motion === "subtle" || motion === "off") root.dataset.motion = motion;
  else delete root.dataset.motion;
  if (HEX.test(background ?? "")) document.querySelector('meta[name="theme-color"]')?.setAttribute("content", background);
  try { localStorage.setItem("dp:appearance", JSON.stringify({ primary, secondary, background, radiusScale, motion })); } catch { /* ignore */ }
}
