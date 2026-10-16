import { describe, it, expect } from "vitest";
import { contrast, appearanceWarnings } from "../src/js/admin/contrast.js";
import { PRESETS } from "../src/js/admin/pages/appearance.js";

describe("contrast", () => {
  it("matches known WCAG ratios", () => {
    expect(contrast("#000000", "#ffffff")).toBeCloseTo(21, 0);
    expect(contrast("#ffffff", "#ffffff")).toBeCloseTo(1, 5);
  });
  it.each(Object.entries(PRESETS))("preset %s has no readability warnings", (_key, preset) => {
    expect(appearanceWarnings(preset)).toEqual([]);
  });
  it("flags a light background as an error", () => {
    const w = appearanceWarnings({ primary: "#a855f7", secondary: "#e04bff", background: "#f0f0f0" });
    expect(w.some((x) => x.level === "error")).toBe(true);
  });
});
