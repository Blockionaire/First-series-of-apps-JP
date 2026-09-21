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
