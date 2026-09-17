-- STAI initial schema.
--
-- Applied to a CLEAN D1 database. There is no production deployment and no
-- live user data, so this is the schema as it should be rather than the
-- accumulated result of eighteen ALTER TABLE statements. Columns that were
-- added incrementally in the SQLite build (prompts.status, articles.updated_at,
-- the subscription lifecycle fields, the assessment demographics) are declared
-- here in their final form.
--
-- Nothing in this file is engine-specific: no WAL, no PRAGMA, no filesystem
-- path, no busy_timeout. Those are properties of a local SQLite file and are
-- set by the Node driver, which is the only place that still has a file.
--
-- Applied by `wrangler d1 migrations apply` in production, and by the local
-- runner in src/lib/migrate-node.ts for development and tests. Both track
-- applied migrations in d1_migrations, which Wrangler creates itself.

CREATE TABLE settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Which seeded slugs this database has already been offered.
--
-- The protection that makes re-running a seed safe. `INSERT OR IGNORE` alone
-- protects a row only while it still carries its seeded slug: rename an
-- article in the admin editor and the next seed would happily insert the
-- original back as a duplicate of something deliberately moved. A slug is
-- recorded here the first time it is offered and never offered again.
CREATE TABLE seed_ledger (
  kind      TEXT NOT NULL,           -- 'article' | 'prompt' | 'signal'
  slug      TEXT NOT NULL,
  seeded_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (kind, slug)
);

-- ─── Editorial content ───────────────────────────────────────────────────

CREATE TABLE articles (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  slug         TEXT UNIQUE NOT NULL,
  title        TEXT NOT NULL,
  dek          TEXT NOT NULL,
  category     TEXT NOT NULL,
  tags         TEXT NOT NULL DEFAULT '[]',
  author       TEXT NOT NULL,
  author_role  TEXT NOT NULL DEFAULT '',
  published_at TEXT NOT NULL,
  reading_min  INTEGER NOT NULL DEFAULT 6,
  featured     INTEGER NOT NULL DEFAULT 0,
  urgency      INTEGER NOT NULL DEFAULT 2,
  premium      INTEGER NOT NULL DEFAULT 0,
  body_md      TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'published',
  -- Millisecond resolution, and load-bearing: the Ask STAI retrieval index
  -- decides whether to rebuild by comparing COUNT(*) and MAX(updated_at) over
  -- published articles. At second resolution two saves in the same second
  -- would produce an unchanged fingerprint and a stale index.
  updated_at   TEXT
);

CREATE TABLE prompts (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  slug        TEXT UNIQUE NOT NULL,
  title       TEXT NOT NULL,
  category    TEXT NOT NULL,
  description TEXT NOT NULL,
  body        TEXT NOT NULL,
  variables   TEXT NOT NULL DEFAULT '[]',
  model_note  TEXT NOT NULL DEFAULT '',
  premium     INTEGER NOT NULL DEFAULT 1,
  uses        INTEGER NOT NULL DEFAULT 0,
  status      TEXT NOT NULL DEFAULT 'published',
  updated_at  TEXT
);

CREATE TABLE podcasts (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  slug         TEXT UNIQUE NOT NULL,
  episode_no   INTEGER NOT NULL,
  title        TEXT NOT NULL,
  guest        TEXT NOT NULL DEFAULT '',
  description  TEXT NOT NULL,
  duration_min INTEGER NOT NULL,
  published_at TEXT NOT NULL
);

CREATE TABLE research (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  slug     TEXT UNIQUE NOT NULL,
  title    TEXT NOT NULL,
  source   TEXT NOT NULL,
  authors  TEXT NOT NULL,
  year     INTEGER NOT NULL,
  topic    TEXT NOT NULL,
  summary  TEXT NOT NULL,
  takeaway TEXT NOT NULL DEFAULT ''
);

CREATE TABLE signals (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  label        TEXT NOT NULL,
  detail       TEXT NOT NULL DEFAULT '',
  kind         TEXT NOT NULL DEFAULT 'reg',
  published_at TEXT NOT NULL
);

-- ─── Accounts and sessions ───────────────────────────────────────────────

CREATE TABLE users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name          TEXT NOT NULL DEFAULT '',
  firm          TEXT NOT NULL DEFAULT '',
  role          TEXT NOT NULL DEFAULT 'member',
  plan          TEXT NOT NULL DEFAULT 'free',
  founding      INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE sessions (
  token      TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL
);

-- Present because live READ paths depend on it: entitlement is derived from
-- subscription state on every authenticated request, and /account displays it.
-- Payment MUTATION is frozen and quarantined in src/lib/billing-frozen.ts;
-- nothing in this migration changes payment behaviour.
CREATE TABLE subscriptions (
  id                      INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id                 INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan                    TEXT NOT NULL,
  status                  TEXT NOT NULL DEFAULT 'active',
  provider                TEXT NOT NULL DEFAULT 'sandbox',
  stripe_customer         TEXT,
  stripe_subscription     TEXT,
  started_at              TEXT NOT NULL DEFAULT (datetime('now')),
  renews_at               TEXT,
  current_period_end      INTEGER,
  cancel_at_period_end    INTEGER NOT NULL DEFAULT 0,
  updated_at              TEXT,
  first_payment_confirmed INTEGER NOT NULL DEFAULT 0
);

-- ─── Reader state ────────────────────────────────────────────────────────

CREATE TABLE bookmarks (
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind       TEXT NOT NULL,
  ref_id     INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, kind, ref_id)
);

CREATE TABLE saved_answers (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question   TEXT NOT NULL,
  answer     TEXT NOT NULL,
  sources    TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE usage_counters (
  actor   TEXT NOT NULL,
  feature TEXT NOT NULL,
  period  TEXT NOT NULL,
  count   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (actor, feature, period)
);

-- ─── Capture: waitlists, enquiries, assessment ───────────────────────────

CREATE TABLE newsletter (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  email      TEXT UNIQUE NOT NULL,
  source     TEXT NOT NULL DEFAULT 'site',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- STAI+ early access. A waitlist, not a purchase: no payment state here.
CREATE TABLE early_access (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  email      TEXT NOT NULL UNIQUE,
  name       TEXT NOT NULL DEFAULT '',
  firm       TEXT NOT NULL DEFAULT '',
  role       TEXT NOT NULL DEFAULT '',
  interests  TEXT NOT NULL DEFAULT '[]',
  note       TEXT NOT NULL DEFAULT '',
  source     TEXT NOT NULL DEFAULT 'plus',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE enquiries (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  email      TEXT NOT NULL,
  firm       TEXT NOT NULL DEFAULT '',
  programme  TEXT NOT NULL,
  seats      TEXT NOT NULL DEFAULT '',
  message    TEXT NOT NULL DEFAULT '',
  status     TEXT NOT NULL DEFAULT 'new',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE firm_enquiries (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  name         TEXT NOT NULL,
  email        TEXT NOT NULL,
  firm         TEXT NOT NULL,
  role         TEXT NOT NULL DEFAULT '',
  firm_size    TEXT NOT NULL DEFAULT '',
  jurisdiction TEXT NOT NULL DEFAULT '',
  interests    TEXT NOT NULL DEFAULT '[]',
  seats        TEXT NOT NULL DEFAULT '',
  message      TEXT NOT NULL DEFAULT '',
  status       TEXT NOT NULL DEFAULT 'new',
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE assessments (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  email        TEXT NOT NULL DEFAULT '',
  firm         TEXT NOT NULL DEFAULT '',
  answers      TEXT NOT NULL,
  score        INTEGER NOT NULL,
  band         TEXT NOT NULL,
  firm_size    TEXT NOT NULL DEFAULT '',
  jurisdiction TEXT NOT NULL DEFAULT '',
  role         TEXT NOT NULL DEFAULT '',
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ─── Outbound mail ───────────────────────────────────────────────────────

CREATE TABLE outbox (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  to_email   TEXT NOT NULL,
  subject    TEXT NOT NULL,
  body       TEXT NOT NULL,
  channel    TEXT NOT NULL DEFAULT 'email',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  sent_at    TEXT
);

-- ─── Analytics ───────────────────────────────────────────────────────────

-- First-party, aggregate-only. One row per event, no IP address, no user id,
-- no device fingerprint — only a random per-session token that expires with
-- the browsing session.
CREATE TABLE events (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  kind       TEXT NOT NULL,
  path       TEXT NOT NULL DEFAULT '',
  label      TEXT NOT NULL DEFAULT '',
  visitor    TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
