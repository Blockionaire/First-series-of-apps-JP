#!/usr/bin/env node
/**
 * Point-in-time backup of the STAI database.
 *
 * Uses SQLite's online backup API, so it is safe to run against a live
 * database — no need to stop the app, and no risk of copying a torn WAL.
 *
 *   node scripts/backup.mjs [destination-dir]
 *
 * Suggested cron (hourly, keeps 7 days):
 *   0 * * * * cd /srv/stai && node scripts/backup.mjs /srv/backups >> /var/log/stai-backup.log 2>&1
 *
 * This is the floor, not the goal. For continuous replication to EU object
 * storage — which is what you actually want in production — run Litestream
 * against data/stai.db; it ships every write within seconds and can restore
 * to any point in time.
 */
import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

const SRC = path.join(process.cwd(), "data", "stai.db");
const DEST_DIR = process.argv[2] ?? path.join(process.cwd(), "backups");
const KEEP = parseInt(process.env.BACKUP_KEEP ?? "168", 10); // hourly for a week

if (!fs.existsSync(SRC)) {
  console.error(`[backup] No database at ${SRC}`);
  process.exit(1);
}

fs.mkdirSync(DEST_DIR, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const dest = path.join(DEST_DIR, `stai-${stamp}.db`);

const db = new Database(SRC, { readonly: true });
await db.backup(dest);
db.close();

// Verify the copy opens and carries the content we expect, so a silently
// corrupt backup can't sit undetected until the day it's needed.
const check = new Database(dest, { readonly: true });
const { n } = check.prepare("SELECT COUNT(*) n FROM articles").get();
const integrity = check.pragma("integrity_check", { simple: true });
check.close();

if (integrity !== "ok") {
  console.error(`[backup] FAILED integrity check: ${integrity}`);
  fs.unlinkSync(dest);
  process.exit(1);
}

const size = (fs.statSync(dest).size / 1024).toFixed(0);
console.log(`[backup] ${dest} — ${size} KB, ${n} articles, integrity ok`);

// Retention
const olds = fs
  .readdirSync(DEST_DIR)
  .filter((f) => f.startsWith("stai-") && f.endsWith(".db"))
  .sort()
  .reverse()
  .slice(KEEP);
for (const f of olds) fs.unlinkSync(path.join(DEST_DIR, f));
if (olds.length) console.log(`[backup] pruned ${olds.length} old snapshot(s)`);
