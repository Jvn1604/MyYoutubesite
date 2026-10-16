import { describe, it, expect } from "vitest";
import { zonedToUtc, zonedParts, nextRuleOccurrences, resolveNextStream, splitDuration, tzOffsetMinutes } from "../src/js/core/time.js";

const MYT = "Asia/Kuala_Lumpur";

describe("timezone conversion", () => {
  it("converts Malaysia wall time to UTC", () => {
    expect(zonedToUtc({ year: 2026, month: 10, day: 16, hour: 21, minute: 0 }, MYT).toISOString()).toBe("2026-10-16T13:00:00.000Z");
  });
  it("reports MYT offset as +480 and IST as +330", () => {
    const d = new Date("2026-10-16T00:00:00Z");
    expect(tzOffsetMinutes(d, MYT)).toBe(480);
    expect(tzOffsetMinutes(d, "Asia/Kolkata")).toBe(330);
  });
  it("handles DST zones (London, BST → GMT)", () => {
    expect(zonedToUtc({ year: 2026, month: 7, day: 1, hour: 12 }, "Europe/London").toISOString()).toBe("2026-07-01T11:00:00.000Z");
    expect(zonedToUtc({ year: 2026, month: 12, day: 1, hour: 12 }, "Europe/London").toISOString()).toBe("2026-12-01T12:00:00.000Z");
  });
  it("computes weekday in the target zone, not the host zone", () => {
    // 2026-10-17 20:00 UTC is already Sunday 04:00 in Malaysia
    expect(zonedParts(new Date("2026-10-17T20:00:00Z"), MYT).weekday).toBe(0);
  });
});

describe("schedule", () => {
  const daily = [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, time: "21:00" }));

  it("finds tonight's stream before 9pm MYT", () => {
    const [next] = nextRuleOccurrences(daily, MYT, new Date("2026-10-16T10:00:00Z"));
    expect(next.startsAt.toISOString()).toBe("2026-10-16T13:00:00.000Z");
  });
  it("rolls to tomorrow after 9pm MYT", () => {
    const [next] = nextRuleOccurrences(daily, MYT, new Date("2026-10-16T13:30:00Z"));
    expect(next.startsAt.toISOString()).toBe("2026-10-17T13:00:00.000Z");
  });
  it("respects specific weekdays and wraps the week", () => {
    const saturdayOnly = [{ weekday: 6, time: "20:00" }];
    // Sat 17 Oct 2026 21:00 MYT → next Saturday
    const [next] = nextRuleOccurrences(saturdayOnly, MYT, new Date("2026-10-17T13:00:00Z"));
    expect(next.startsAt.toISOString()).toBe("2026-10-24T12:00:00.000Z");
  });
  it("ignores disabled and malformed rules", () => {
    expect(nextRuleOccurrences([{ weekday: 1, time: "25:00" }, { weekday: 2, time: "20:00", enabled: false }], MYT)).toEqual([]);
  });
});

describe("resolveNextStream", () => {
  const now = new Date("2026-10-16T10:00:00Z");
  const rules = [{ weekday: 5, time: "21:00", title: "Nightly" }];

  it("prefers a real YouTube scheduled stream", () => {
    const r = resolveNextStream({ upcomingVideo: { title: "Boss rush", scheduledStart: "2026-10-18T12:00:00Z" }, rules, timeZone: MYT }, now);
    expect(r.source).toBe("youtube");
  });
  it("uses a special event when it is earlier than the regular slot", () => {
    const r = resolveNextStream({ events: [{ startsAt: "2026-10-16T11:00:00Z", title: "Special" }], rules, timeZone: MYT }, now);
    expect(r).toMatchObject({ source: "event", title: "Special" });
  });
  it("falls back to the regular schedule", () => {
    expect(resolveNextStream({ rules, timeZone: MYT }, now)).toMatchObject({ source: "schedule", title: "Nightly" });
  });
  it("returns null with nothing configured", () => {
    expect(resolveNextStream({ timeZone: MYT }, now)).toBeNull();
  });
});

describe("splitDuration", () => {
  it("splits and clamps", () => {
    expect(splitDuration((2 * 3600 + 14 * 60 + 37) * 1000)).toEqual({ days: 0, hours: 2, minutes: 14, seconds: 37 });
    expect(splitDuration(-5)).toEqual({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  });
});
