/**
 * Where public content comes from. Today: the dev fixture.
 * Phase 9 replaces loadContent() with database reads; callers stay the same.
 */
import * as fixture from "../fixtures/dev-data.js";
import { runtimeEnv } from "../config.js";

export async function loadContent() {
  return structuredClone({
    settings: fixture.settings,
    channel: fixture.channel,
    videos: fixture.videos,
    games: fixture.games,
    schedule: fixture.schedule,
    goal: fixture.goal,
    socials: fixture.socials,
  });
}

/**
 * Dev-only: ?mock=live|upcoming|empty|goal lets us exercise every homepage state.
 * Ignored outside `netlify dev`.
 */
export function applyDevMock(content, mock, now = Date.now()) {
  if (!mock || runtimeEnv() !== "dev") return content;
  const iso = (ms) => new Date(ms).toISOString();
  if (mock === "live") {
    content.videos.unshift({
      id: "7utpCWTZQpg", title: "🔴 Valor Mortis – Pt 2 | Napoleon boss tonight", description: "", publishedAt: iso(now - 40 * 60e3),
      durationSeconds: null, kind: "stream", liveState: "live", scheduledStart: iso(now - 45 * 60e3), actualStart: iso(now - 40 * 60e3),
      concurrentViewers: 148, views: null, likes: null, comments: null, gameSlug: "valor-mortis", hidden: false, featured: false, priority: 0,
    });
  }
  if (mock === "upcoming") {
    content.videos.unshift({
      id: "7utpCWTZQpg", title: "Valor Mortis – Pt 2 | Napoleon boss", description: "", publishedAt: iso(now),
      durationSeconds: null, kind: "stream", liveState: "upcoming", scheduledStart: iso(now + (2 * 3600 + 14 * 60 + 37) * 1000), actualStart: null,
      concurrentViewers: null, views: null, likes: null, comments: null, gameSlug: "valor-mortis", hidden: false, featured: false, priority: 0,
    });
  }
  if (mock === "empty") {
    content.channel = null;
    content.videos = [];
    content.games = [];
  }
  if (mock === "goal") content.channel.subscriberCount = content.goal.target + 12;
  return content;
}
