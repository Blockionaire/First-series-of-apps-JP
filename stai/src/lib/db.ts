import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { dataDir } from "./config";

/**
 * SQLite is the platform's content store and CMS backing.
 * Chosen deliberately: zero external services on the critical path
 * (audit-firm firewalls), single-file portability, and better-sqlite3's
 * synchronous API is faster than a network round-trip for every read
 * this site does. Swapping to Postgres later means replacing this file.
 */

let _db: Database.Database | null = null;

/** Absolute path to the database file. Its -wal and -shm siblings sit beside it. */
export function dbPath(): string {
  return path.join(dataDir(), "stai.db");
}

export function db(): Database.Database {
  if (_db) return _db;
  const dir = dataDir();
  fs.mkdirSync(dir, { recursive: true });
  _db = new Database(dbPath());
  _db.pragma("journal_mode = WAL");
  _db.pragma("foreign_keys = ON");
  // Without this SQLite's busy timeout is 0: any two concurrent writers (a
  // signup arriving during a Stripe webhook, say) throw SQLITE_BUSY instantly
  // and surface as a 500. Five seconds is far longer than any write here takes.
  _db.pragma("busy_timeout = 5000");
  migrate(_db);
  registerShutdownHook();
  return _db;
}

let _hookRegistered = false;
/**
 * Checkpoint and close on process exit so a redeploy never leaves a hot WAL.
 *
 * Registered here rather than in instrumentation.ts because that file is
 * compiled for the edge runtime too, which has no `path`/`fs`. Reaching this
 * function at all proves we are in the Node runtime.
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

/** Checkpoint and close — called on SIGTERM so a redeploy leaves no hot WAL. */
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

const SEED_VERSION = "2";

function migrate(d: Database.Database) {
  d.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS articles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    dek TEXT NOT NULL,
    category TEXT NOT NULL,
    tags TEXT NOT NULL DEFAULT '[]',
    author TEXT NOT NULL,
    author_role TEXT NOT NULL DEFAULT '',
    published_at TEXT NOT NULL,
    reading_min INTEGER NOT NULL DEFAULT 6,
    featured INTEGER NOT NULL DEFAULT 0,
    urgency INTEGER NOT NULL DEFAULT 2,
    premium INTEGER NOT NULL DEFAULT 0,
    body_md TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'published'
  );

  CREATE TABLE IF NOT EXISTS prompts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT NOT NULL,
    body TEXT NOT NULL,
    variables TEXT NOT NULL DEFAULT '[]',
    model_note TEXT NOT NULL DEFAULT '',
    premium INTEGER NOT NULL DEFAULT 1,
    uses INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS podcasts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT UNIQUE NOT NULL,
    episode_no INTEGER NOT NULL,
    title TEXT NOT NULL,
    guest TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL,
    duration_min INTEGER NOT NULL,
    published_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS research (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    source TEXT NOT NULL,
    authors TEXT NOT NULL,
    year INTEGER NOT NULL,
    topic TEXT NOT NULL,
    summary TEXT NOT NULL,
    takeaway TEXT NOT NULL DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS signals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    label TEXT NOT NULL,
    detail TEXT NOT NULL DEFAULT '',
    kind TEXT NOT NULL DEFAULT 'reg',
    published_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL DEFAULT '',
    firm TEXT NOT NULL DEFAULT '',
    role TEXT NOT NULL DEFAULT 'member',
    plan TEXT NOT NULL DEFAULT 'free',
    founding INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    provider TEXT NOT NULL DEFAULT 'sandbox',
    stripe_customer TEXT,
    stripe_subscription TEXT,
    started_at TEXT NOT NULL DEFAULT (datetime('now')),
    renews_at TEXT
  );

  CREATE TABLE IF NOT EXISTS bookmarks (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind TEXT NOT NULL,
    ref_id INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, kind, ref_id)
  );

  CREATE TABLE IF NOT EXISTS saved_answers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    sources TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS newsletter (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    source TEXT NOT NULL DEFAULT 'site',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS enquiries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    firm TEXT NOT NULL DEFAULT '',
    programme TEXT NOT NULL,
    seats TEXT NOT NULL DEFAULT '',
    message TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'new',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS assessments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL DEFAULT '',
    firm TEXT NOT NULL DEFAULT '',
    answers TEXT NOT NULL,
    score INTEGER NOT NULL,
    band TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS usage_counters (
    actor TEXT NOT NULL,
    feature TEXT NOT NULL,
    period TEXT NOT NULL,
    count INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (actor, feature, period)
  );

  CREATE TABLE IF NOT EXISTS outbox (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    to_email TEXT NOT NULL,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    channel TEXT NOT NULL DEFAULT 'email',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    sent_at TEXT
  );

  CREATE TABLE IF NOT EXISTS firm_enquiries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    firm TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT '',
    firm_size TEXT NOT NULL DEFAULT '',
    jurisdiction TEXT NOT NULL DEFAULT '',
    interests TEXT NOT NULL DEFAULT '[]',
    seats TEXT NOT NULL DEFAULT '',
    message TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'new',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- STAI+ early access. A waitlist, not a purchase: no payment state here.
  CREATE TABLE IF NOT EXISTS early_access (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL DEFAULT '',
    firm TEXT NOT NULL DEFAULT '',
    role TEXT NOT NULL DEFAULT '',
    interests TEXT NOT NULL DEFAULT '[]',
    note TEXT NOT NULL DEFAULT '',
    source TEXT NOT NULL DEFAULT 'plus',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- First-party, aggregate-only analytics. One row per event, no IP address,
  -- no user id, no device fingerprint — only a random per-session token that
  -- expires with the browsing session.
  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kind TEXT NOT NULL,
    path TEXT NOT NULL DEFAULT '',
    label TEXT NOT NULL DEFAULT '',
    visitor TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_events_created ON events(created_at);
  CREATE INDEX IF NOT EXISTS idx_events_kind ON events(kind, created_at);

  CREATE INDEX IF NOT EXISTS idx_articles_pub ON articles(published_at DESC);
  CREATE INDEX IF NOT EXISTS idx_articles_cat ON articles(category);
  CREATE INDEX IF NOT EXISTS idx_prompts_cat ON prompts(category);
  CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
  `);

  // Additive column migrations — safe to run on every boot.
  addColumn(d, "assessments", "firm_size", "TEXT NOT NULL DEFAULT ''");
  addColumn(d, "assessments", "jurisdiction", "TEXT NOT NULL DEFAULT ''");
  addColumn(d, "assessments", "role", "TEXT NOT NULL DEFAULT ''");

  // Stripe subscription lifecycle. Entitlement is derived from these, so they
  // mirror Stripe's own vocabulary rather than a local approximation.
  addColumn(d, "subscriptions", "current_period_end", "INTEGER"); // unix seconds
  addColumn(d, "subscriptions", "cancel_at_period_end", "INTEGER NOT NULL DEFAULT 0");
  addColumn(d, "subscriptions", "updated_at", "TEXT");
  // Positive proof that THIS subscription has received a successful payment at
  // least once. Belongs to the subscription, never to the user: a brand-new
  // Stripe subscription always starts unconfirmed, even for a customer who
  // paid on a previous one. Sticky — set once by invoice.paid, never cleared.
  addColumn(d, "subscriptions", "first_payment_confirmed", "INTEGER NOT NULL DEFAULT 0");
  d.exec(
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_sub_stripe ON subscriptions(stripe_subscription) WHERE stripe_subscription IS NOT NULL"
  );

  const seeded = d.prepare("SELECT value FROM settings WHERE key='seed_version'").get() as
    | { value: string }
    | undefined;
  if (seeded?.value !== SEED_VERSION) {
    // Deferred import keeps seed content out of the hot path after first boot.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { runSeed } = require("./seed/run") as typeof import("./seed/run");
    runSeed(d, SEED_VERSION);
  }

  runDataMigrations(d);
}

/** ALTER TABLE ADD COLUMN, but idempotent. */
function addColumn(d: Database.Database, table: string, column: string, definition: string) {
  const cols = d.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (cols.some((c) => c.name === column)) return;
  d.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

/**
 * One-time data migrations, keyed in settings so they run exactly once.
 * These exist because the seed is additive (it never overwrites editor work),
 * so deliberate changes to already-seeded rows have to be stated explicitly.
 */
function runDataMigrations(d: Database.Database) {
  const done = (key: string) => !!d.prepare("SELECT 1 FROM settings WHERE key=?").get(key);
  const mark = (key: string) =>
    d.prepare("INSERT INTO settings (key, value) VALUES (?, datetime('now'))").run(key);

  // Launch gating strategy: the prompt TEXT is distribution — an auditor who
  // finds a good prompt forwards it to colleagues. What we charge for is the
  // tooling (adapt-with-AI, Ask STAI). So the library opens up and only the
  // deepest, most specialised prompts stay behind the gate. Every category
  // keeps at least one open prompt: a locked category reads as an empty shelf.
  // Align legacy local status values with Stripe's vocabulary, so one set of
  // rules governs entitlement regardless of which provider wrote the row.
  if (!done("mig_sub_status_stripe_vocab")) {
    d.prepare("UPDATE subscriptions SET status='canceled' WHERE status='cancelled'").run();
    mark("mig_sub_status_stripe_vocab");
  }

  // Backfill the payment-confirmation flag for rows that predate it.
  //
  // Any subscription already in an access-granting state was admitted under
  // the previous rule (status alone). Defaulting those to 0 would revoke a
  // paying member's access until their NEXT invoice — so they are grandfathered
  // to 1 exactly once. Every row created after this migration starts at 0 and
  // must earn the flag through invoice.paid.
  if (!done("mig_first_payment_backfill")) {
    d.prepare(
      "UPDATE subscriptions SET first_payment_confirmed = 1 WHERE status IN ('active','past_due','trialing')"
    ).run();
    mark("mig_first_payment_backfill");
  }

  /**
   * Content trust pass before the free public launch.
   *
   * The seeded corpus was written as a demonstration and contains material
   * that cannot be published to auditors as fact. Because seeding is additive,
   * existing databases need these corrections applied explicitly.
   */
  if (!done("mig_content_trust_v1")) {
    const tx = d.transaction(() => {
      // 1. Unpublish articles built on fabricated primary research, invented
      //    enforcement actions, or invented statistics. Kept as drafts rather
      //    than deleted: the writing is salvageable once claims are sourced.
      const UNPUBLISH = [
        "afm-thematic-review-ai-audit-firms", // invented regulatory action, reported as news
        "esma-cra-model-governance-fine", // invented enforcement action and fine amount
        "iaasb-signals-isa-500-refresh", // unverifiable standard-setter news
        "copilot-audit-room-90-day-field-report", // fabricated first-person field study
        "materiality-for-model-risk", // invented industry statistics presented as convergence
        "big-four-ai-arms-race-audited", // unsourced characterisation of named real firms
      ];
      const unpub = d.prepare("UPDATE articles SET status='draft' WHERE slug=?");
      for (const slug of UNPUBLISH) unpub.run(slug);

      // 2. Single transparent byline; no invented personas or credentials.
      d.prepare("UPDATE articles SET author='STAI Editorial', author_role='Editorial desk'").run();

      // 3. Remove fabricated podcast episodes and research citations outright.
      //    These named real institutions and real journals.
      d.prepare("DELETE FROM podcasts").run();
      d.prepare("DELETE FROM research").run();

      // 4. Ticker: replace the mixed set (verifiable milestones alongside
      //    invented enforcement actions) with the verifiable-only list. Data
      //    migrations run AFTER seeding, so this re-inserts rather than just
      //    deleting — otherwise a fresh database would launch with no ticker.
      d.prepare("DELETE FROM signals").run();
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { signals } = require("./seed/media") as typeof import("./seed/media");
      const insSig = d.prepare(
        "INSERT INTO signals (label, detail, kind, published_at) VALUES (@label, @detail, @kind, @publishedAt)"
      );
      for (const s of signals) insSig.run(s);

      // 5. Prompt use counters were seeded fiction presented as social proof.
      d.prepare("UPDATE prompts SET uses = 0").run();

      mark("mig_content_trust_v1");
    });
    tx();
  }

  if (!done("mig_prompt_gating_v2")) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PREMIUM_PROMPT_SLUGS } = require("./seed/gating") as typeof import("./seed/gating");
    const tx = d.transaction(() => {
      d.prepare("UPDATE prompts SET premium = 0").run();
      const setPremium = d.prepare("UPDATE prompts SET premium = 1 WHERE slug = ?");
      for (const slug of PREMIUM_PROMPT_SLUGS) setPremium.run(slug);
      mark("mig_prompt_gating_v2");
    });
    tx();
  }
}

export function getSetting(key: string): string | null {
  const row = db().prepare("SELECT value FROM settings WHERE key=?").get(key) as
    | { value: string }
    | undefined;
  return row?.value ?? null;
}

export function setSetting(key: string, value: string) {
  db()
    .prepare(
      "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value"
    )
    .run(key, value);
}
