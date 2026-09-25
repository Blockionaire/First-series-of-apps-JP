import { cache } from "react";
import { sql } from "./sql";

/**
 * The key/value settings table.
 *
 * These live here rather than in db.ts for a build reason, not a tidiness one.
 * db.ts imports better-sqlite3 at module scope, so ANY module importing
 * anything from it — even a pure helper like getSetting — drags the native
 * addon into the bundle graph. content.ts imported getSetting, and content.ts
 * is imported by every public page, so the entire free-launch site statically
 * depended on a native addon Workers cannot load.
 *
 * Nothing in this file touches the database engine directly; it goes through
 * the seam like everything else.
 */

export async function getSetting(key: string): Promise<string | null> {
  const row = await sql().first<{ value: string }>("SELECT value FROM settings WHERE key=?", [key]);
  return row?.value ?? null;
}

/**
 * Every setting, read once per request.
 *
 * The Header and the Footer each ask for all 13 page switches, the page guard
 * asks for one more, and the homepage reads eight copy fields on top. Answered
 * key by key that was 27–39 queries per page view — each a billed D1 round
 * trip, against a Workers Free ceiling of 50 per invocation (CODE_AUDIT.md,
 * H1). The table is a few dozen short rows, so reading all of it once is
 * cheaper than reading any three of them separately.
 *
 * `cache` scopes the snapshot to one server render: every component in the
 * same request shares it, and the next request reads afresh, so a switch
 * flipped in the admin takes effect on the very next page view. Outside a
 * render — route handlers, the cron — React does not memoise, and each call
 * is one query, which is still never more than the per-key read it replaces.
 *
 * `getSetting` above is deliberately left as it was: frozen billing code reads
 * through it, and nothing here needs to change what that code does.
 */
export const settingsSnapshot = cache(async (): Promise<ReadonlyMap<string, string>> => {
  const rows = await sql().all<{ key: string; value: string }>("SELECT key, value FROM settings");
  return new Map(rows.map((r) => [r.key, r.value]));
});

export async function setSetting(key: string, value: string): Promise<void> {
  await sql().run(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
    [key, value]
  );
}
