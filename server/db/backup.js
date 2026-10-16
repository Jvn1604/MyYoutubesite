/**
 * Website-content backup format (everything edited in the admin).
 * YouTube data is excluded (sync rebuilds it); admins/sessions are excluded (security).
 */

// Order matters for restore (foreign keys): media before games, games before video_overrides.
export const BACKUP_TABLES = ["site_settings", "media", "games", "social_links", "schedule_rules", "schedule_events", "subscriber_goals", "video_overrides"];
const IDENTITY = ["media", "games", "social_links", "schedule_rules", "schedule_events", "subscriber_goals"];
export const BACKUP_FORMAT = "dephantom-website-backup";

export async function exportWebsite(db) {
  const data = { format: BACKUP_FORMAT, version: 1, createdAt: new Date().toISOString(), tables: {} };
  for (const t of BACKUP_TABLES) data.tables[t] = await db.query(`select * from ${t} order by 1`);
  return data;
}

/** Replaces website content with the backup. Returns { skippedOverrides }. */
export async function restoreWebsite(db, data) {
  if (data?.format !== BACKUP_FORMAT) throw new Error("That file isn't a DePhantom website backup.");
  await db.transaction(async (tx) => {
    for (const t of [...BACKUP_TABLES].reverse()) await tx.query(`delete from ${t}`);
    for (const t of BACKUP_TABLES) {
      const rows = data.tables[t] ?? [];
      if (!rows.length) continue;
      const overriding = IDENTITY.includes(t) ? "overriding system value" : "";
      // Overrides only for videos present in this database (videos come from YouTube sync)
      const filter = t === "video_overrides" ? "where r.youtube_id in (select youtube_id from videos)" : "";
      await tx.query(
        `insert into ${t} ${overriding} select r.* from json_populate_recordset(null::${t}, $1::json) r ${filter}`,
        [JSON.stringify(rows)]
      );
    }
    for (const t of IDENTITY) {
      await tx.query(`select setval(pg_get_serial_sequence('${t}', 'id'), greatest(coalesce((select max(id) from ${t}), 0), 1))`);
    }
  });
  const [{ n }] = await db.query("select count(*)::int as n from video_overrides");
  return { skippedOverrides: Math.max(0, (data.tables.video_overrides?.length ?? 0) - n) };
}
