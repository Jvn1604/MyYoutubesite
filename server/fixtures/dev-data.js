/**
 * DEVELOPMENT FIXTURE for YouTube-owned data, used only until sync runs (phase 9).
 * Website content (settings, games, schedule, goal, socials) lives in
 * ../db/seed-data.js and is re-exported here so tests/dev share one source.
 * Video ids/titles/views are real values from the channel as of 2026-10-16.
 */

export { settings, games, schedule, goal, socials } from "../db/seed-data.js";

export const channel = {
  title: "DePhantom தமிழ்",
  subscriberCount: 1352,
  subscribersHidden: false,
  viewCount: 219369,
  videoCount: 434,
  streamCount: 490,
  avatarUrl: "/src/assets/fallback/avatar.svg",
  bannerUrl: "https://yt3.googleusercontent.com/7NGWBrbpjAhMf7Y7CNqnwwQDpSQc8RGPT1m-Qgwbl0s7cq2OcTBs32KmpDkU0UomlAsj3SIG5w=w1138-fcrop64=1,00005a57ffffa5a8-k-c0xffffffff-no-nd-rj",
  syncedAt: "2026-10-16T10:00:00Z",
};

const stream = (id, title, publishedAt, views, gameSlug, extra = {}) => ({
  id, title, description: "", publishedAt, durationSeconds: null, kind: "stream", liveState: "ended",
  scheduledStart: null, actualStart: publishedAt, concurrentViewers: null,
  views, likes: null, comments: null, gameSlug, hidden: false, featured: false, priority: 0, ...extra,
});

export const videos = [
  stream("7utpCWTZQpg", "Valor Mortis – Napoleonic era Soulslike – Pt 1", "2026-10-14T13:00:00Z", 1297, "valor-mortis", { featured: true }),
  stream("Y-anq79KB2g", "CONTROL Resonant – Part 4", "2026-10-08T13:00:00Z", 332, "control-resonant"),
  stream("f7PiOS6YpH0", "CONTROL Resonant – Part 3", "2026-10-07T13:00:00Z", 757, "control-resonant"),
  stream("P-Plichv868", "CONTROL Resonant – Part 2", "2026-09-29T13:00:00Z", 1094, "control-resonant"),
  stream("RcEgafYb7HM", "CONTROL Resonant – Part 1", "2026-09-27T13:00:00Z", 791, "control-resonant"),
  stream("DfGnpgtTiXo", "The Blood of Dawnwalker – Part 5", "2026-09-26T13:00:00Z", 1254, "blood-of-dawnwalker"),
  stream("9kQwis2kJFs", "Party Animals with Friends", "2026-09-19T15:00:00Z", 257, "party-animals"),
  stream("T955-y3p-RI", "The Blood of Dawnwalker – Part 4", "2026-09-19T13:00:00Z", 1122, "blood-of-dawnwalker"),
  stream("Ntr3K9VO7LE", "The Blood of Dawnwalker – Part 3", "2026-09-17T13:00:00Z", 934, "blood-of-dawnwalker"),
  stream("l80h8U2d7_E", "The Blood of Dawnwalker – Part 2", "2026-09-16T13:00:00Z", 1831, "blood-of-dawnwalker"),
  stream("yy3khOOd4sQ", "The Blood of Dawnwalker – Part 1", "2026-09-15T13:00:00Z", 2379, "blood-of-dawnwalker"),
  stream("YQAtIyPbd0A", "Onimusha: Way of the Sword – NO DAMAGE / CARNAGE Difficulty (Bishamon sword)", "2026-09-14T13:00:00Z", 784, "onimusha-way-of-the-sword"),
  stream("H4H0Ro3s2eo", "Onimusha: Way of the Sword – ACTION Difficulty 🥲 17 Boss NO DAMAGE", "2026-09-09T13:00:00Z", 1347, "onimusha-way-of-the-sword"),
  stream("lyyB-gKsOBs", "Onimusha: Way of the Sword – Try 18 Rematch boss no damage 🥲", "2026-09-08T13:00:00Z", 417, "onimusha-way-of-the-sword"),
  stream("vWT9NvoMocs", "Onimusha: Way of the Sword – ENDING", "2026-09-07T13:00:00Z", 546, "onimusha-way-of-the-sword"),
];

