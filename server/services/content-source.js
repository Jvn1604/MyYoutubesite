/**
 * Where public content comes from:
 *   DATABASE_URL set  → the database (production, and local dev via `npm run db:local`)
 *   not set (dev only) → the bundled fixture, so the frontend can be worked on with zero setup
 */
import { env, runtimeEnv, ConfigError } from "../config.js";
import { withDb } from "../db/client.js";
import { loadContentFromDb } from "../repositories/content.js";

async function loadFixture() {
  const fixture = await import("../fixtures/dev-data.js");
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

export async function loadContent() {
  if (env("DATABASE_URL")) return withDb(loadContentFromDb);
  if (runtimeEnv() === "dev") return loadFixture();
  throw new ConfigError("DATABASE_URL");
}

/**
 * Dev-only: ?mock=live|upcoming|empty|goal lets us exercise every homepage state.
 * Ignored outside `netlify dev`.
 */
export function applyDevMock(content, mock, now = Date.now()) {
  if (!mock || runtimeEnv() !== "dev") return content;
  const iso = (ms) => new Date(ms).toISOString();
  const base = { description: "", durationSeconds: null, kind: "stream", likes: null, comments: null, gameSlug: "valor-mortis", hidden: false, featured: false, priority: 0 };
  if (mock === "live") {
    content.videos.unshift({
      ...base, id: "7utpCWTZQpg", title: "🔴 Valor Mortis – Pt 2 | Napoleon boss tonight", publishedAt: iso(now - 40 * 60e3),
      liveState: "live", scheduledStart: iso(now - 45 * 60e3), actualStart: iso(now - 40 * 60e3), concurrentViewers: 148, views: null,
    });
  }
  if (mock === "upcoming") {
    content.videos.unshift({
      ...base, id: "7utpCWTZQpg", title: "Valor Mortis – Pt 2 | Napoleon boss", publishedAt: iso(now),
      liveState: "upcoming", scheduledStart: iso(now + (2 * 3600 + 14 * 60 + 37) * 1000), actualStart: null, concurrentViewers: null, views: null,
    });
  }
  if (mock === "empty") {
    content.channel = null;
    content.videos = [];
    content.games = [];
  }
  if (mock === "goal" && content.channel && content.goal) content.channel.subscriberCount = content.goal.target + 12;
  return content;
}
