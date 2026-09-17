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

export async function setSetting(key: string, value: string): Promise<void> {
  await sql().run(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
    [key, value]
  );
}
