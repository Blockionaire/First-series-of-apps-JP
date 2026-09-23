/**
 * D1 schema, migrations and seeding.
 *
 * The migrations in migrations/*.sql are what Wrangler applies to production
 * D1. D1 is SQLite, so the same files can be applied to a throwaway local
 * database and asserted against directly — which is what most of this file
 * does, with no server and no Next.js in the way.
 *
 * The parts that need the real application (an admin editing through the real
 * API, then a redeploy re-applying the seed) are covered by
 * tests/prompt-cms.test.mjs and tests/retrieval-freshness.test.mjs.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import fs from "fs";
import os from "os";
import path from "path";

const ROOT = path.resolve(import.meta.dirname, "..");

const sqlFiles = (dir) =>
  fs
    .readdirSync(path.join(ROOT, dir))
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((name) => ({ name, sql: fs.readFileSync(path.join(ROOT, dir, name), "utf8") }));

/** Apply files exactly as the runner does, tracking in a Wrangler-shaped table. */
function apply(d, files, table) {
  d.exec(`CREATE TABLE IF NOT EXISTS ${table} (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE,
    applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  );`);
  const done = new Set(d.prepare(`SELECT name FROM ${table}`).all().map((r) => r.name));
  const ran = [];
  for (const f of files) {
    if (done.has(f.name)) continue;
    d.transaction(() => {
      d.exec(f.sql);
      d.prepare(`INSERT INTO ${table} (name) VALUES (?)`).run(f.name);
    })();
    ran.push(f.name);
  }
  return ran;
}

/** A clean database with migrations applied, and optionally seeded. */
function freshDb({ seed = false } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "stai-d1-"));
  const d = new Database(path.join(dir, "t.db"));
  d.pragma("foreign_keys = ON");
  const migrated = apply(d, sqlFiles("migrations"), "d1_migrations");
  const seeded = seed ? apply(d, sqlFiles("seeds"), "d1_seeds") : [];
  return { d, dir, migrated, seeded, cleanup: () => { d.close(); fs.rmSync(dir, { recursive: true, force: true }); } };
}

const count = (d, sql) => d.prepare(sql).get().n;

describe("D1 migrations", () => {
  test("[1] a clean database migrates from zero", () => {
    const { d, migrated, cleanup } = freshDb();
    const tables = d
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
      .all()
      .map((r) => r.name);

    // Every table the free launch needs, named explicitly so a dropped one is
    // a failure rather than a smaller list nobody notices.
    for (const t of [
      "articles", "prompts", "signals", "podcasts", "research",
      "users", "sessions", "subscriptions",
      "bookmarks", "saved_answers", "usage_counters",
      "newsletter", "early_access", "enquiries", "firm_enquiries", "assessments",
      "outbox", "events", "settings", "seed_ledger",
    ]) {
      assert.ok(tables.includes(t), `missing table: ${t}`);
    }
    // Compared against the directory rather than a hardcoded list: the point
    // is that EVERY migration applied, in name order. Pinning the filenames
    // here just means the next migration fails this test for existing.
    const onDisk = sqlFiles("migrations").map((f) => f.name);
    assert.ok(onDisk.length >= 3, "the migration set should not have shrunk");
    assert.deepEqual(migrated, onDisk, "every migration applied, in order");
    cleanup();
  });

  test("[2] migrations are tracked and do not re-apply", () => {
    const { d, cleanup } = freshDb();
    const second = apply(d, sqlFiles("migrations"), "d1_migrations");
    assert.deepEqual(second, [], "a second run applies nothing");

    const tracked = d.prepare("SELECT name FROM d1_migrations ORDER BY id").all().map((r) => r.name);
    assert.deepEqual(tracked, sqlFiles("migrations").map((f) => f.name));

    // Re-applying without tracking must fail — proof the tracking is what
    // prevents it, not luck. CREATE TABLE has no IF NOT EXISTS in 0001.
    assert.throws(() => d.exec(sqlFiles("migrations")[0].sql), /already exists/);
    cleanup();
  });

  test("migrations carry no SQLite-file assumptions", () => {
    // Comments stripped first: the header of 0001 says "no WAL, no PRAGMA",
    // and a test that reads its own documentation as a violation is useless.
    const statements = sqlFiles("migrations")
      .map((f) => f.sql.replace(/^\s*--.*$/gm, ""))
      .join("\n");
    for (const forbidden of [/PRAGMA/i, /journal_mode/i, /\bWAL\b/i, /busy_timeout/i, /ATTACH\s/i, /VACUUM/i]) {
      assert.ok(!forbidden.test(statements), `migrations must not contain ${forbidden}`);
    }
    // These belong to the local file and live in the Node driver only.
    const nodeDb = fs.readFileSync(path.join(ROOT, "src/lib/db.ts"), "utf8");
    assert.match(nodeDb, /journal_mode = WAL/, "the Node driver keeps its own file-level PRAGMAs");
  });

  test("the local runner mirrors the .sql files byte-for-byte", async () => {
    // The Node path applies an embedded copy, because Next's standalone server
    // chdir()s away from the repository and cannot read migrations/ from disk.
    // If the mirror drifts, local and production schemas diverge silently.
    const before = fs.readFileSync(path.join(ROOT, "src/lib/schema/sql.generated.ts"), "utf8");
    const { execFileSync } = await import("node:child_process");
    execFileSync("node", ["scripts/sync-sql.mjs"], { cwd: ROOT, stdio: "ignore" });
    const after = fs.readFileSync(path.join(ROOT, "src/lib/schema/sql.generated.ts"), "utf8");
    assert.equal(after, before, "run `npm run sql:sync` — the embedded SQL is stale");
  });
});

describe("retiring H3C and registering H2A", () => {
  // Migration 0010 is the first migration in this project that touches DATA
  // rather than schema, so what it may do is worth pinning down: it removes
  // capability from one row and adds a dormant one. Nothing it does can cause
  // a page to be fetched.

  /** Migrations up to but not including 0010, so the "before" state is real. */
  const before0010 = () => sqlFiles("migrations").filter((f) => !f.name.startsWith("0010"));
  const mig0010 = () => sqlFiles("migrations").filter((f) => f.name.startsWith("0010"));

  function registry(rows = []) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "stai-h2a-"));
    const d = new Database(path.join(dir, "t.db"));
    d.pragma("foreign_keys = ON");
    apply(d, before0010(), "d1_migrations");
    for (const r of rows) {
      d.prepare(
        `INSERT INTO newsroom_sources
           (name, domain, source_type, authority_tier, jurisdictions, topics,
            ingestion_method, feed_url, fetch_frequency, fetch_allowed,
            license_notes, snapshot_retention, active, review_status)
         VALUES (@name, @domain, 'regulator', 1, '["FR"]', '["audit"]',
                 'html_scrape', @feed_url, 30, @fetch_allowed, '', 'indefinite',
                 @active, @review_status)`
      ).run(r);
    }
    return {
      d,
      run: () => apply(d, mig0010(), "d1_migrations"),
      row: (domain) =>
        d.prepare("SELECT * FROM newsroom_sources WHERE domain=?").get(domain),
      cleanup: () => { d.close(); fs.rmSync(dir, { recursive: true, force: true }); },
    };
  }

  const H3C = {
    name: "H3C / Haute autorité de l'audit",
    domain: "h3c.org",
    feed_url: "https://www.h3c.org/actualites",
    fetch_allowed: 1,
    active: 1,
    review_status: "feed_verified",
  };

  test("an active H3C row is switched off and its retrieval withdrawn", () => {
    const r = registry([H3C]);
    r.run();
    const h3c = r.row("h3c.org");
    assert.equal(h3c.active, 0);
    assert.equal(h3c.fetch_allowed, 0, "retrieval permission must be withdrawn, not just the switch");
    assert.equal(h3c.review_status, "do_not_use");
    assert.match(h3c.review_note, /Superseded by H2A/);
    assert.ok(h3c.reviewed_at, "a review decision records when it was made");
    assert.ok(h3c.reviewed_by, "and by what");
    r.cleanup();
  });

  test("the row is not deleted — the decision stays visible", () => {
    // Deleting it would lose the record that somebody looked at this source
    // and why it went. `do_not_use` is a decision; absence is not.
    const r = registry([H3C]);
    r.run();
    assert.ok(r.row("h3c.org"), "H3C should still be in the registry, switched off");
    r.cleanup();
  });

  test("H2A arrives inactive and not retrievable", () => {
    // The property the whole registry rests on: registering a source has
    // never implied permission to read it, and a migration is not the place
    // to start. Decision D5.
    const r = registry([H3C]);
    r.run();
    const h2a = r.row("h2a-france.org");
    assert.ok(h2a, "H2A was not registered");
    assert.equal(h2a.active, 0);
    assert.equal(h2a.fetch_allowed, 0);
    assert.equal(h2a.authority_tier, 1);
    assert.equal(h2a.jurisdictions, '["FR"]');
    assert.equal(h2a.ingestion_method, "html_scrape");
    assert.match(h2a.feed_url, /^https:\/\/www\.h2a-france\.org\//);
    // The Tier 1 defaults, matching DEFAULT_FREQUENCY and DEFAULT_RETENTION.
    assert.equal(h2a.fetch_frequency, 30);
    assert.equal(h2a.snapshot_retention, "indefinite");
    assert.equal(h2a.review_status, "unreviewed", "nobody has looked at it yet");
    r.cleanup();
  });

  test("a registry that never loaded the proposal still gets H2A", () => {
    const r = registry([]);
    r.run();
    assert.ok(r.row("h2a-france.org"));
    assert.equal(r.row("h3c.org"), undefined, "nothing to retire, and no error");
    r.cleanup();
  });

  test("an H2A row already added by hand is left completely alone", () => {
    // The case that matters most: the operator did it themselves first. Their
    // decisions — the URL they chose, the permission they granted — are not
    // the migration's to overwrite.
    const r = registry([
      {
        name: "H2A by hand",
        domain: "h2a-france.org",
        feed_url: "https://www.h2a-france.org/publications/",
        fetch_allowed: 1,
        active: 1,
        review_status: "retrieval_approved",
      },
    ]);
    r.run();
    const h2a = r.row("h2a-france.org");
    assert.equal(h2a.name, "H2A by hand");
    assert.equal(h2a.active, 1, "an operator's own activation must survive");
    assert.equal(h2a.fetch_allowed, 1);
    assert.equal(h2a.review_status, "retrieval_approved");
    assert.equal(
      count(r.d, "SELECT COUNT(*) n FROM newsroom_sources WHERE domain='h2a-france.org'"),
      1,
      "the domain is UNIQUE, and a second insert would have failed the migration"
    );
    r.cleanup();
  });

  test("it switches nothing else in the registry on or off", () => {
    // A data migration that reached beyond its two rows would be the kind of
    // thing nobody notices until a source starts fetching.
    const r = registry([
      H3C,
      {
        name: "Some other source",
        domain: "example-regulator.eu",
        feed_url: "https://example-regulator.eu/feed.xml",
        fetch_allowed: 1,
        active: 1,
        review_status: "retrieval_approved",
      },
    ]);
    r.run();
    const other = r.row("example-regulator.eu");
    assert.equal(other.active, 1);
    assert.equal(other.fetch_allowed, 1);
    assert.equal(other.review_status, "retrieval_approved");
    r.cleanup();
  });

  test("nothing in the registry is left active after it runs on a fresh database", () => {
    const { d, cleanup } = freshDb();
    assert.equal(
      count(d, "SELECT COUNT(*) n FROM newsroom_sources WHERE active=1 OR fetch_allowed=1"),
      0,
      "a migration must never leave a source able to fetch"
    );
    cleanup();
  });
});

describe("initial seed", () => {
  test("[3] produces the verified corpus and nothing else", () => {
    const { d, seeded, cleanup } = freshDb({ seed: true });
    assert.deepEqual(seeded, ["0001_verified_corpus.sql"]);

    assert.equal(count(d, "SELECT COUNT(*) n FROM articles"), 11, "11 verified articles");
    assert.equal(
      count(d, "SELECT COUNT(*) n FROM articles WHERE status='published'"),
      11,
      "all of them published — the unverifiable six are never seeded at all"
    );
    assert.equal(count(d, "SELECT COUNT(*) n FROM prompts"), 31);
    assert.equal(count(d, "SELECT COUNT(*) n FROM prompts WHERE premium=1"), 11);
    assert.equal(count(d, "SELECT COUNT(*) n FROM signals"), 4);

    // Fabricated content stays out of a clean database rather than being
    // inserted and then repaired.
    assert.equal(count(d, "SELECT COUNT(*) n FROM podcasts"), 0, "no invented episodes");
    assert.equal(count(d, "SELECT COUNT(*) n FROM research"), 0, "no invented citations");
    assert.equal(
      d.prepare("SELECT COALESCE(SUM(uses),0) n FROM prompts").get().n,
      0,
      "no fabricated usage counters"
    );
    assert.deepEqual(
      d.prepare("SELECT DISTINCT author FROM articles").all().map((r) => r.author),
      ["STAI Editorial"],
      "one transparent byline"
    );

    for (const withheld of [
      "afm-thematic-review-ai-audit-firms",
      "esma-cra-model-governance-fine",
      "iaasb-signals-isa-500-refresh",
      "copilot-audit-room-90-day-field-report",
      "materiality-for-model-risk",
      "big-four-ai-arms-race-audited",
    ]) {
      assert.equal(
        d.prepare("SELECT 1 FROM articles WHERE slug=?").get(withheld),
        undefined,
        `${withheld} must not be seeded`
      );
    }

    // Fabricated scarcity is a prohibited practice under the EU UCPD.
    assert.equal(
      d.prepare("SELECT value FROM settings WHERE key='founding_claimed'").get().value,
      "0"
    );
    cleanup();
  });

  test("every seeded row is recorded in the ledger", () => {
    const { d, cleanup } = freshDb({ seed: true });
    assert.equal(count(d, "SELECT COUNT(*) n FROM seed_ledger WHERE kind='article'"), 11);
    assert.equal(count(d, "SELECT COUNT(*) n FROM seed_ledger WHERE kind='prompt'"), 31);
    assert.equal(count(d, "SELECT COUNT(*) n FROM seed_ledger WHERE kind='signal'"), 4);
    cleanup();
  });

  test("re-applying the seed file changes nothing at all", () => {
    const { d, cleanup } = freshDb({ seed: true });
    const snapshot = () =>
      JSON.stringify({
        a: d.prepare("SELECT slug, title, body_md, status, premium FROM articles ORDER BY slug").all(),
        p: d.prepare("SELECT slug, title, body, status, premium FROM prompts ORDER BY slug").all(),
        s: d.prepare("SELECT label FROM signals ORDER BY label").all(),
      });
    const before = snapshot();
    // Apply the raw file again, bypassing the tracking table entirely — so this
    // tests the ledger guard, not the bookkeeping.
    for (const f of sqlFiles("seeds")) d.exec(f.sql);
    assert.equal(snapshot(), before, "the seed is idempotent by construction");
    cleanup();
  });
});

describe("a redeploy cannot undo editorial work", () => {
  /** Apply the seed file directly, as a redeploy would. */
  const reseed = (d) => { for (const f of sqlFiles("seeds")) d.exec(f.sql); };

  test("[4] an edited article survives", () => {
    const { d, cleanup } = freshDb({ seed: true });
    d.prepare("UPDATE articles SET title=?, body_md=? WHERE slug=?")
      .run("Rewritten by the editor", "Editor's replacement body.", "eu-ai-act-reaches-the-audit-file");
    reseed(d);
    const row = d.prepare("SELECT * FROM articles WHERE slug='eu-ai-act-reaches-the-audit-file'").get();
    assert.equal(row.title, "Rewritten by the editor");
    assert.equal(row.body_md, "Editor's replacement body.");
    cleanup();
  });

  test("[5] an edited prompt survives", () => {
    const { d, cleanup } = freshDb({ seed: true });
    d.prepare("UPDATE prompts SET title=?, body=? WHERE slug=?")
      .run("Rewritten prompt", "Editor's prompt body.", "engagement-risk-brainstorm");
    reseed(d);
    const row = d.prepare("SELECT * FROM prompts WHERE slug='engagement-risk-brainstorm'").get();
    assert.equal(row.title, "Rewritten prompt");
    assert.equal(row.body, "Editor's prompt body.");
    cleanup();
  });

  test("[6] a draft article stays a draft", () => {
    const { d, cleanup } = freshDb({ seed: true });
    d.prepare("UPDATE articles SET status='draft' WHERE slug=?").run("eu-ai-act-reaches-the-audit-file");
    reseed(d);
    assert.equal(
      d.prepare("SELECT status FROM articles WHERE slug='eu-ai-act-reaches-the-audit-file'").get().status,
      "draft",
      "a deliberate takedown must not be undone by a deploy"
    );
    cleanup();
  });

  test("[7] a draft prompt stays a draft", () => {
    const { d, cleanup } = freshDb({ seed: true });
    d.prepare("UPDATE prompts SET status='draft' WHERE slug=?").run("whistleblower-triage");
    reseed(d);
    assert.equal(
      d.prepare("SELECT status FROM prompts WHERE slug='whistleblower-triage'").get().status,
      "draft"
    );
    cleanup();
  });

  test("[8] free / STAI+ gating survives", () => {
    const { d, cleanup } = freshDb({ seed: true });
    // Flip one each way: a seeded-free prompt gated, a seeded-premium one opened.
    d.prepare("UPDATE prompts SET premium=1 WHERE slug='engagement-risk-brainstorm'").run();
    d.prepare("UPDATE prompts SET premium=0 WHERE slug='whistleblower-triage'").run();
    reseed(d);
    assert.equal(d.prepare("SELECT premium FROM prompts WHERE slug='engagement-risk-brainstorm'").get().premium, 1);
    assert.equal(d.prepare("SELECT premium FROM prompts WHERE slug='whistleblower-triage'").get().premium, 0);
    cleanup();
  });

  test("a renamed slug is not resurrected, and no duplicate appears", () => {
    const { d, cleanup } = freshDb({ seed: true });
    const before = count(d, "SELECT COUNT(*) n FROM articles");
    d.prepare("UPDATE articles SET slug=? WHERE slug=?")
      .run("renamed-by-the-editor", "eu-ai-act-reaches-the-audit-file");
    reseed(d);

    assert.equal(count(d, "SELECT COUNT(*) n FROM articles"), before, "row count unchanged");
    assert.equal(
      d.prepare("SELECT 1 FROM articles WHERE slug='eu-ai-act-reaches-the-audit-file'").get(),
      undefined,
      "the freed slug must not be re-inserted — the ledger, not the UNIQUE constraint, is what stops this"
    );
    assert.deepEqual(
      d.prepare("SELECT slug, COUNT(*) n FROM articles GROUP BY slug HAVING n > 1").all(),
      []
    );
    cleanup();
  });

  test("a deleted row is not resurrected either", () => {
    const { d, cleanup } = freshDb({ seed: true });
    d.prepare("DELETE FROM prompts WHERE slug='pillar-two-exposure-scan'").run();
    reseed(d);
    assert.equal(
      d.prepare("SELECT 1 FROM prompts WHERE slug='pillar-two-exposure-scan'").get(),
      undefined,
      "the ledger records that the slug was offered; removal is the editor's decision"
    );
    cleanup();
  });
});
