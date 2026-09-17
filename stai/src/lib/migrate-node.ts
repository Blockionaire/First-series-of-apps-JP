import type Database from "better-sqlite3";
import { MIGRATIONS, SEEDS, type SqlFile } from "./schema/sql.generated";

/**
 * Apply the D1 migration and seed files to a local SQLite database.
 *
 * Node-only. In production Wrangler applies exactly the same files with
 * `wrangler d1 migrations apply`; this runner exists so development and the
 * test suite exercise the real migrations rather than a parallel schema that
 * can drift from them. There is one source of truth for the schema, and it is
 * the .sql files.
 *
 * Tracking mirrors Wrangler's: a `d1_migrations` table with a unique name per
 * applied file. Seeds are tracked the same way in `d1_seeds`, which is an
 * optimisation rather than a correctness mechanism — the seed files are
 * idempotent by construction (see the seed_ledger guard on every statement),
 * so re-applying one is a no-op whether or not it is tracked.
 */

const TRACKING = {
  migrations: "d1_migrations",
  seeds: "d1_seeds",
} as const;

export type { SqlFile };

/**
 * The SQL comes from the generated mirror, not from disk.
 *
 * Reading migrations/*.sql at runtime looks obvious and does not work: Next's
 * standalone server chdir()s into .next/standalone, where no such directory
 * exists, so readdir finds nothing, no migrations apply, and the app boots
 * against an empty database while reporting a successful start.
 */
export function readSqlFiles(dir: "migrations" | "seeds"): SqlFile[] {
  return dir === "migrations" ? MIGRATIONS : SEEDS;
}

function ensureTracking(d: Database.Database, table: string) {
  d.exec(`
    CREATE TABLE IF NOT EXISTS ${table} (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT UNIQUE,
      applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

function applied(d: Database.Database, table: string): Set<string> {
  return new Set(
    (d.prepare(`SELECT name FROM ${table}`).all() as { name: string }[]).map((r) => r.name)
  );
}

/**
 * Apply any unapplied files from `dir`, each inside a transaction so a failure
 * part-way through a file leaves nothing behind.
 *
 * Returns the names actually applied, so a caller (and the tests) can tell the
 * difference between "migrated" and "already up to date".
 */
function applyDir(d: Database.Database, dir: "migrations" | "seeds"): string[] {
  const table = TRACKING[dir];
  ensureTracking(d, table);
  const done = applied(d, table);
  const pending = readSqlFiles(dir).filter((f) => !done.has(f.name));

  const ran: string[] = [];
  for (const file of pending) {
    const tx = d.transaction(() => {
      d.exec(file.sql);
      d.prepare(`INSERT INTO ${table} (name) VALUES (?)`).run(file.name);
    });
    tx();
    ran.push(file.name);
  }
  return ran;
}

export function applyMigrations(d: Database.Database): string[] {
  return applyDir(d, "migrations");
}

export function applySeeds(d: Database.Database): string[] {
  return applyDir(d, "seeds");
}

/** Forget that a seed ran, so the next boot re-applies it. Tests only. */
export function resetSeedTracking(d: Database.Database) {
  ensureTracking(d, TRACKING.seeds);
  d.prepare(`DELETE FROM ${TRACKING.seeds}`).run();
}
