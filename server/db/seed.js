/**
 * Idempotent seed of website-owned content (never YouTube data).
 * Safe to run repeatedly: existing rows are left untouched, so admin edits survive.
 */
import * as data from "./seed-data.js";

export async function seed(db) {
  const inserted = { settings: 0, games: 0, socials: 0, scheduleRules: 0, goals: 0 };

  await db.transaction(async (tx) => {
    for (const [key, value] of Object.entries(data.settings)) {
      const rows = await tx.query(
        "insert into site_settings (key, value) values ($1, $2::jsonb) on conflict (key) do nothing returning key",
        [key, JSON.stringify(value)]
      );
      inserted.settings += rows.length;
    }

    for (const g of data.games) {
      const rows = await tx.query(
        `insert into games (slug, name, status, genre, release_year, description, playlist_url, title_keywords, featured, sort_order)
         values ($1, $2, $3, $4, $5, $6, $7, $8::text[], $9, $10)
         on conflict (slug) do nothing returning id`,
        [g.slug, g.name, g.status, g.genre, g.releaseYear ?? null, g.description, g.playlistUrl ?? "", data.gameKeywords[g.slug] ?? [], g.featured, g.sortOrder]
      );
      inserted.games += rows.length;
    }

    // Socials, goal: only when the table is empty (no natural unique key to conflict on)
    const [{ n: socialCount }] = await tx.query("select count(*)::int as n from social_links");
    if (socialCount === 0) {
      for (const s of data.socials) {
        await tx.query(
          `insert into social_links (platform, label, description, url, icon, accent, enabled, sort_order)
           values ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [s.platform, s.label, s.description, s.url, s.icon ?? s.platform, s.accent ?? null, s.enabled, s.sortOrder]
        );
        inserted.socials += 1;
      }
    }

    for (const r of data.scheduleRules) {
      const rows = await tx.query(
        `insert into schedule_rules (weekday, start_time, timezone, title, enabled) values ($1, $2::time, $3, $4, $5)
         on conflict (weekday, start_time) do nothing returning id`,
        [r.weekday, r.time, data.settings.schedule.timezone, r.title, r.enabled]
      );
      inserted.scheduleRules += rows.length;
    }

    const [{ n: goalCount }] = await tx.query("select count(*)::int as n from subscriber_goals");
    if (goalCount === 0) {
      const g = data.goal;
      await tx.query(
        `insert into subscriber_goals (title, description, start_value, goal_value, deadline, enabled, celebrate)
         values ($1, $2, $3, $4, $5::date, $6, $7)`,
        [g.title, g.description, g.start, g.target, g.deadline, g.enabled, g.celebrate]
      );
      inserted.goals = 1;
    }
  });

  return inserted;
}
