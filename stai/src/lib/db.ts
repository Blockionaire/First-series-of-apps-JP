import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { applyMigrations, applySeeds } from "./migrate-node";

/**
 * The LOCAL SQLite database, for development and the test suite.
 *
 * Production runs on Cloudflare D1, which is also SQLite but reached over a
 * binding rather than a file. Everything in this module is therefore
 * Node-specific by definition — the file path, WAL, the PRAGMA setup, the
 * shutdown checkpoint — and nothing outside the Node driver may import it.
 * src/lib/sql.ts names no driver at all; src/instrumentation.ts installs this
 * one when NEXT_RUNTIME is nodejs, and the Worker entry installs the D1 one.
 *
 * What USED to be here and is now gone: an inline CREATE TABLE block, a stack
 * of addColumn() calls, and four corrective data migrations. All of it moved
 * to migrations/*.sql, which Wrangler applies in production and the runner in
 * migrate-node.ts applies here — one source of truth for the schema, exercised
 * by every local boot and every test.
 *
 * The corrective migrations are absent rather than ported. They repaired a
 * corpus that had already been seeded wrong; a clean database is seeded right
 * in the first place (see scripts/generate-seed.mjs). On a database with no
 * subscriptions the two payment-related ones were no-ops in any case, and no
 * payment logic changed.
 */

let _db: Database.Database | null = null;

/**
 * Where ALL persistent local state lives: stai.db plus its -wal and -shm
 * sidecars. In Docker this is the mounted volume (/data); in development it
 * defaults to <project>/data.
 *
 * Lives here rather than in lib/config.ts because it is Node-only — it calls
 * process.cwd() and joins a filesystem path, neither of which means anything
 * on Workers. config.ts is imported by every page through lib/seo.ts, so
 * keeping this there put a `path` import in the Workers bundle for a function
 * that runtime can never reach.
 */
export function dataDir(): string {
  return process.env.STAI_DATA_DIR || path.join(process.cwd(), "data");
}

/** Absolute path to the database file. Its -wal and -shm siblings sit beside it. */
export function dbPath(): string {
  return path.join(dataDir(), "stai.db");
}

export function db(): Database.Database {
  if (_db) return _db;
  const dir = dataDir();
  fs.mkdirSync(dir, { recursive: true });
  _db = new Database(dbPath());

  // Local-file concerns. None of these exist on D1, and none of them appear in
  // migrations/*.sql for exactly that reason.
  _db.pragma("journal_mode = WAL");
  _db.pragma("foreign_keys = ON");
  // Without this SQLite's busy timeout is 0: any two concurrent writers throw
  // SQLITE_BUSY instantly and surface as a 500.
  _db.pragma("busy_timeout = 5000");

  applyMigrations(_db);
  applySeeds(_db);

  registerShutdownHook();
  return _db;
}

let _hookRegistered = false;
/**
 * Checkpoint and close on process exit so a local restart never leaves a hot
 * WAL. Node-only, and meaningless on D1 — which is why it lives here and not
 * behind the seam.
 *
 * `exit` is the right hook: it is synchronous (as closeDb is), and it fires
 * after Next's own SIGTERM handling calls process.exit(). Attaching a bare
 * SIGTERM listener would suppress Node's default termination instead.
 */
function registerShutdownHook() {
  if (_hookRegistered) return;
  _hookRegistered = true;
  process.on("exit", () => closeDb());
}

/** Checkpoint and close — called on SIGTERM so a restart leaves no hot WAL. */
export function closeDb() {
  if (!_db) return;
  try {
    _db.pragma("wal_checkpoint(TRUNCATE)");
    _db.close();
  } catch {
    // shutting down anyway
  }
  _db = null;
}
