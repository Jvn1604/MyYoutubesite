/** WCAG contrast helpers for appearance warnings. */

const hexToRgb = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const toHex = (rgb) => `#${rgb.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("")}`;

export function luminance(hex) {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a, b) {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

/** sRGB mix (close enough to the CSS oklab mix for a warning). */
export const mix = (a, b, weightA) => toHex(hexToRgb(a).map((v, i) => v * weightA + hexToRgb(b)[i] * (1 - weightA)));

const TEXT = "#ececf3";
const MUTED = "#9a9ab0";

/** → [{ level: "error"|"warning", message }] */
export function appearanceWarnings({ primary, secondary, background }) {
  const out = [];
  const check = (fg, bg, min, what) => {
    const ratio = contrast(fg, bg);
    if (ratio < min) out.push({ level: ratio < min * 0.7 ? "error" : "warning", message: `${what}: contrast ${ratio.toFixed(1)}:1 (needs ${min}:1)` });
  };
  if (luminance(background) > 0.18) out.push({ level: "error", message: "Background is too light for the site's light text. Choose a darker background." });
  check(TEXT, background, 7, "Body text on background");
  check(MUTED, background, 4.5, "Muted text on background");
  check(mix(primary, "#ffffff", 0.65), background, 4.5, "Accent text (links, labels) on background");
  check("#ffffff", primary, 3, "White button text on primary colour");
  check("#ffffff", secondary, 3, "White button text on secondary colour");
  return out;
}
