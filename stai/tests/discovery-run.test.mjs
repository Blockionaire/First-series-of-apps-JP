/**
 * A discovery run, end to end, against a real server and a real database.
 *
 * A local stub serves the feeds, so the whole path runs for real — fetcher,
 * parser, normaliser, deduplication, clusterer, gates, cap, fetch log and
 * audit trail — with nothing mocked inside the application.
 *
 * ── The one thing bypassed, and why ─────────────────────────────────────
 * Source rows are inserted straight into the database rather than through
 * /api/admin/newsroom/source, because the registry requires https feed URLs
 * that belong to their registered domain — correct in production, and
 * impossible to satisfy with a local stub. That validation is covered
 * separately in tests/newsroom-admin.test.mjs. Everything downstream of the
 * registry is exercised here exactly as it ships.
 */
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import http from "node:http";
import Database from "better-sqlite3";
import fs from "fs";
import os from "os";
import path from "path";

const PORT = Number(process.env.DISCOVERY_TEST_PORT ?? 3215);
const FEED_PORT = PORT + 1;
const BASE = `http://127.0.0.1:${PORT}`;
const FEEDS = `http://127.0.0.1:${FEED_PORT}`;
const ROOT = path.resolve(import.meta.dirname, "..");
const STANDALONE = path.join(ROOT, ".next/standalone/server.js");
const hasBuild = fs.existsSync(STANDALONE);

const ADMIN_EMAIL = "discovery-admin@test.eu";
const ADMIN_PASSWORD = "discovery-admin-password";

let dataDir, server, feedServer, cookie;

/* ── The stub publisher ──────────────────────────────────────────────────
 * Mutable so a later run can serve a new item and exercise living stories.
 */
const state = { extraPressItem: false, regulatorDown: false, correctedDate: false };

const rss = (items) =>
  `<?xml version="1.0"?><rss version="2.0"><channel><title>Stub</title>${items}</channel></rss>`;

const item = (title, link, date, description) =>
  `<item><title>${title}</title><link>${link}</link><pubDate>${date}</pubDate><description>${description}</description></item>`;

/** Recent enough to pass the freshness gate whenever this suite runs. */
const recent = (hoursAgo = 2) => new Date(Date.now() - hoursAgo * 3_600_000).toUTCString();

function feedHandler(req, res) {
  const send = (status, body, type = "application/rss+xml") => {
    res.writeHead(status, { "content-type": type });
    res.end(body);
  };

  switch (req.url.split("?")[0]) {
    case "/regulator.xml":
      if (state.regulatorDown) return send(500, "boom", "text/plain");
      return send(
        200,
        rss(
          item(
            "European Commission adopts implementing act on AI Act audit documentation",
            `${FEEDS}/doc/ip-26-1234`,
            recent(),
            state.correctedDate
              ? "Correction: the requirement applies from 1 July 2027 for regulated entities across the European Union."
              : "The requirement applies from 1 January 2027 for regulated entities across the European Union."
          ) +
            item(
              "AFM publishes findings on Dutch audit firm quality management",
              `${FEEDS}/doc/afm-2026-09`,
              recent(3),
              "The Netherlands regulator reviewed ISQM 1 implementation at Dutch audit firms."
            )
        )
      );

    case "/press.xml":
      return send(
        200,
        rss(
          item(
            "EU adopts AI Act audit documentation rules",
            `${FEEDS}/doc/press-aiact`,
            recent(1),
            "The European Commission adopted an implementing act on AI Act audit documentation, applying from 1 January 2027 for regulated entities."
          ) +
            (state.extraPressItem
              ? item(
                  "Analysts respond to the AI Act audit documentation implementing act",
                  `${FEEDS}/doc/press-aiact-followup`,
                  recent(0),
                  "Reaction to the European Commission implementing act on AI Act audit documentation, which applies from 1 January 2027."
                )
              : "")
        )
      );

    case "/community.json":
      return send(
        200,
        JSON.stringify({
          items: [
            {
              url: `${FEEDS}/doc/forum-thread`,
              title: "Anyone else seeing odd behaviour in their audit automation tooling?",
              date_published: new Date(Date.now() - 3_600_000).toISOString(),
              summary:
                "A discussion thread about audit automation and AI tooling in practice across European firms.",
            },
          ],
        }),
        "application/json"
      );

    case "/moved.xml":
      // The most common real failure: the feed URL moved and the server
      // answers 200 with a landing page.
      return send(200, "<!doctype html><html><body>Not found</body></html>", "text/html");

    case "/empty.xml":
      return send(200, rss(""));

    case "/broken.xml":
      return send(503, "unavailable", "text/plain");

    default:
      return send(404, "no such feed", "text/plain");
  }
}

/* ── Harness ─────────────────────────────────────────────────────────────── */

function startServer() {
  return spawn("node", [STANDALONE], {
    cwd: ROOT,
    env: {
      ...process.env,
      NODE_ENV: "production",
      PORT: String(PORT),
      HOSTNAME: "127.0.0.1",
      STAI_DATA_DIR: dataDir,
      APP_URL: BASE,
      STRIPE_SECRET_KEY: "",
      ANTHROPIC_API_KEY: "",
      RESEND_API_KEY: "",
      INDEXNOW_KEY: "",
      STAI_ADMIN_EMAIL: ADMIN_EMAIL,
      STAI_ADMIN_PASSWORD: ADMIN_PASSWORD,
    },
    stdio: "ignore",
  });
}

async function waitHealthy() {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    try {
      if ((await fetch(`${BASE}/api/health`)).ok) return true;
    } catch {}
    await new Promise((r) => setTimeout(r, 400));
  }
  return false;
}

async function login() {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  assert.equal(res.status, 200, "admin login should succeed");
  return res.headers.getSetCookie().find((c) => c.startsWith("stai_session=")).split(";")[0];
}

const get = (p) => fetch(BASE + p, { redirect: "manual", headers: { Cookie: cookie } });

const db = () => new Database(path.join(dataDir, "stai.db"));
function query(sql, params = []) {
  const d = db();
  const rows = d.prepare(sql).all(...params);
  d.close();
  return rows;
}
function exec(sql, params = []) {
  const d = db();
  d.prepare(sql).run(...params);
  d.close();
}
const one = (sql, params = []) => query(sql, params)[0];

/** Insert a source directly — see the note at the top of this file. */
function addSource(o) {
  exec(
    `INSERT INTO newsroom_sources
       (name, domain, source_type, authority_tier, jurisdictions, topics,
        ingestion_method, feed_url, fetch_frequency, fetch_allowed,
        license_notes, snapshot_retention, active)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      o.name,
      o.domain,
      o.type,
      o.tier,
      JSON.stringify(o.jurisdictions ?? ["EU"]),
      "[]",
      o.method ?? "rss",
      o.url,
      o.frequency ?? 30,
      o.fetchAllowed === false ? 0 : 1,
      "",
      "ninety_days",
      o.active === false ? 0 : 1,
    ]
  );
}

async function runDiscovery() {
  const res = await fetch(`${BASE}/api/admin/newsroom/discover`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ force: true }),
  });
  return { status: res.status, json: await res.json().catch(() => ({})) };
}

async function setCap(n) {
  const res = await fetch(`${BASE}/api/admin/settings`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ values: { "newsroom.research_cap_per_day": String(n) } }),
  });
  assert.equal(res.status, 200);
}

before(async () => {
  if (!hasBuild) return;
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "stai-discovery-"));

  feedServer = http.createServer(feedHandler);
  await new Promise((r) => feedServer.listen(FEED_PORT, "127.0.0.1", r));

  server = startServer();
  await waitHealthy();
  cookie = await login();

  addSource({
    name: "Stub Regulator",
    domain: "stub-regulator.eu",
    type: "regulator",
    tier: 1,
    url: `${FEEDS}/regulator.xml`,
    jurisdictions: ["EU"],
  });
  addSource({
    name: "Stub Press",
    domain: "stub-press.eu",
    type: "news",
    tier: 2,
    url: `${FEEDS}/press.xml`,
    jurisdictions: ["EU"],
  });
  addSource({
    name: "Stub Community",
    domain: "stub-community.eu",
    type: "community",
    tier: 3,
    method: "json_api",
    url: `${FEEDS}/community.json`,
    jurisdictions: ["EU"],
  });
  addSource({
    name: "Stub Moved Feed",
    domain: "stub-moved.eu",
    type: "news",
    tier: 2,
    url: `${FEEDS}/moved.xml`,
  });
  addSource({
    name: "Stub Empty Feed",
    domain: "stub-empty.eu",
    type: "news",
    tier: 2,
    url: `${FEEDS}/empty.xml`,
  });
  addSource({
    name: "Stub Broken Feed",
    domain: "stub-broken.eu",
    type: "news",
    tier: 2,
    url: `${FEEDS}/broken.xml`,
  });
  // Active, but nobody has confirmed retrieval is permitted.
  addSource({
    name: "Stub Unapproved",
    domain: "stub-unapproved.eu",
    type: "news",
    tier: 2,
    url: `${FEEDS}/regulator.xml`,
    fetchAllowed: false,
  });
  // Approved for retrieval, but switched off.
  addSource({
    name: "Stub Inactive",
    domain: "stub-inactive.eu",
    type: "news",
    tier: 2,
    url: `${FEEDS}/regulator.xml`,
    active: false,
  });
  // Registered as a scrape target, which phase 2 does not implement.
  addSource({
    name: "Stub Scrape Target",
    domain: "stub-scrape.eu",
    type: "standard_setter",
    tier: 1,
    method: "html_scrape",
    url: `${FEEDS}/moved.xml`,
  });
});

after(async () => {
  if (server) {
    const exited = new Promise((r) => server.once("exit", r));
    server.kill("SIGTERM");
    await Promise.race([exited, new Promise((r) => setTimeout(r, 10_000))]);
  }
  if (feedServer) await new Promise((r) => feedServer.close(r));
  if (dataDir) fs.rmSync(dataDir, { recursive: true, force: true });
});

const skip = hasBuild ? false : "no standalone build";

/* ── The run ─────────────────────────────────────────────────────────────── */

describe("a discovery run", { skip }, () => {
  test("ingests, clusters and evaluates", async () => {
    const { status, json } = await runDiscovery();
    assert.equal(status, 200, JSON.stringify(json));
    assert.ok(json.itemsIngested >= 4, `expected 4+ items, got ${json.itemsIngested}`);
    assert.ok(json.storiesCreated >= 1);
    assert.ok(json.evaluated >= 1);
  });

  test("the run is recorded, and so is every fetch attempt including the skips", () => {
    const run = one("SELECT * FROM newsroom_pipeline_runs WHERE workflow='discovery' ORDER BY id DESC LIMIT 1");
    assert.ok(run, "the run must be on the record");
    assert.equal(run.status, "succeeded");
    assert.ok(run.finished_at);

    const logs = query("SELECT * FROM newsroom_fetch_log WHERE run_id=?", [run.id]);
    assert.equal(logs.length, 9, "every registered source gets a row, fetched or skipped");

    const byOutcome = (o) => logs.filter((l) => l.outcome === o).length;
    assert.ok(byOutcome("ok") >= 3, "the working feeds");
    assert.equal(byOutcome("skipped_not_permitted"), 1);
    assert.equal(byOutcome("skipped_inactive"), 1);
    assert.equal(byOutcome("skipped_unsupported"), 1, "html_scrape is not silently scraped");
    assert.equal(byOutcome("empty_feed"), 1);
    assert.equal(byOutcome("parse_error"), 1, "an HTML page is a parse error, not a quiet source");
    assert.equal(byOutcome("http_error"), 1);
  });

  test("a source without retrieval permission is never contacted", () => {
    const s = one("SELECT * FROM newsroom_sources WHERE name='Stub Unapproved'");
    assert.equal(s.last_attempt_at, null, "no attempt may be recorded against it");
    assert.equal(s.last_outcome, "");
    assert.equal(
      query("SELECT COUNT(*) n FROM newsroom_source_items WHERE source_id=?", [s.id])[0].n,
      0
    );
  });

  test("an inactive source is never contacted either", () => {
    const s = one("SELECT * FROM newsroom_sources WHERE name='Stub Inactive'");
    assert.equal(s.last_attempt_at, null);
  });

  test("a skip does not count as a failure against the source", () => {
    for (const name of ["Stub Unapproved", "Stub Inactive", "Stub Scrape Target"]) {
      const s = one("SELECT * FROM newsroom_sources WHERE name=?", [name]);
      assert.equal(s.consecutive_failures, 0, `${name} has not failed at anything`);
    }
  });

  test("a failing feed records the reason, not just that it is quiet", () => {
    const broken = one("SELECT * FROM newsroom_sources WHERE name='Stub Broken Feed'");
    assert.equal(broken.last_outcome, "http_error");
    assert.equal(broken.last_http_status, 503);
    assert.match(broken.last_error, /503/);
    assert.equal(broken.consecutive_failures, 1);
    assert.equal(broken.last_success_at, null);

    const moved = one("SELECT * FROM newsroom_sources WHERE name='Stub Moved Feed'");
    assert.equal(moved.last_outcome, "parse_error");
    assert.match(moved.last_error, /HTML page/);
  });

  test("an empty but valid feed is healthy, and says so distinctly", () => {
    const s = one("SELECT * FROM newsroom_sources WHERE name='Stub Empty Feed'");
    assert.equal(s.last_outcome, "empty_feed");
    assert.equal(s.consecutive_failures, 0);
    assert.ok(s.last_success_at, "it answered; it just had nothing to say");
  });

  test("items carry the normalised fields", () => {
    const i = one(
      "SELECT * FROM newsroom_source_items WHERE canonical_url LIKE '%ip-26-1234%'"
    );
    assert.ok(i, "the regulator's item should be stored");
    assert.ok(i.content_hash && i.content_hash.length === 64, "a SHA-256 fingerprint");
    assert.ok(i.url_hash && i.url_hash.length === 64);
    assert.ok(i.published_at, "the feed's date, parsed");
    assert.ok(i.retrieved_at);
    assert.ok(i.lead.length > 0);
    assert.equal(JSON.parse(i.jurisdictions).includes("EU"), true);
  });

  test("jurisdiction is refined from the text, not just inherited", () => {
    const nl = one("SELECT * FROM newsroom_source_items WHERE canonical_url LIKE '%afm-2026-09%'");
    const codes = JSON.parse(nl.jurisdictions);
    assert.ok(codes.includes("NL"), `a Dutch item on an EU feed should be NL too: ${nl.jurisdictions}`);
  });
});

describe("deduplication", { skip }, () => {
  test("running again ingests nothing new", async () => {
    const before = one("SELECT COUNT(*) n FROM newsroom_source_items").n;
    const { json } = await runDiscovery();
    assert.equal(json.itemsIngested, 0, "the same entries must not re-enter");
    assert.equal(one("SELECT COUNT(*) n FROM newsroom_source_items").n, before);
  });

  test("and creates no duplicate stories", async () => {
    const before = one("SELECT COUNT(*) n FROM newsroom_stories").n;
    await runDiscovery();
    assert.equal(one("SELECT COUNT(*) n FROM newsroom_stories").n, before);
  });

  test("repeated runs inside the hour each have their own run row", () => {
    // A retry is a new run with its own outcome; it never rewrites the
    // record of the one before it (CODE_AUDIT.md M2). Overlap is refused by
    // the run lease instead.
    const rows = query("SELECT idempotency_key, status FROM newsroom_pipeline_runs WHERE workflow='discovery'");
    assert.equal(new Set(rows.map((r) => r.idempotency_key)).size, rows.length, "keys are unique");
    assert.ok(rows.length >= 3, `three runs, ${rows.length} rows`);
    assert.ok(rows.every((r) => r.status === "succeeded"));
  });
});

describe("clustering", { skip }, () => {
  test("a regulator's announcement and the coverage of it are one story", () => {
    const story = one(
      `SELECT * FROM newsroom_stories WHERE canonical_title LIKE '%AI Act audit documentation%' ORDER BY source_count DESC LIMIT 1`
    );
    assert.ok(story, "the AI Act story should exist");
    assert.ok(story.source_count >= 2, `expected 2+ sources, got ${story.source_count}`);
    assert.ok(story.tier1_source_count >= 1, "the Commission's own announcement");
    assert.ok(story.tier2_source_count >= 1, "and the coverage of it");
    assert.ok(story.primary_source_count >= 1);
  });

  test("the cluster's label comes from the primary source", () => {
    const story = one(
      `SELECT * FROM newsroom_stories WHERE canonical_title LIKE '%AI Act audit documentation%' ORDER BY source_count DESC LIMIT 1`
    );
    assert.match(story.canonical_title, /European Commission adopts/);
  });

  test("unrelated items stay in separate stories", () => {
    const afm = query(
      `SELECT s.* FROM newsroom_stories s
         JOIN newsroom_story_sources ss ON ss.story_id = s.id
         JOIN newsroom_source_items i ON i.id = ss.source_item_id
        WHERE i.canonical_url LIKE '%afm-2026-09%'`
    );
    assert.equal(afm.length, 1);
    assert.ok(!/AI Act audit documentation/.test(afm[0].canonical_title));
  });

  test("clustering decisions are on the record", () => {
    const events = query(
      "SELECT * FROM newsroom_pipeline_events WHERE reason LIKE '%source joined%' OR reason LIKE '%new story%'"
    );
    assert.ok(events.length >= 2, "both creating and joining a story are recorded");
    for (const e of events) assert.ok(e.run_id, "every event names its run");
  });
});

describe("living stories", { skip }, () => {
  test("a later report joins the existing story instead of forking one", async () => {
    const before = one(
      `SELECT * FROM newsroom_stories WHERE canonical_title LIKE '%AI Act audit documentation%' ORDER BY source_count DESC LIMIT 1`
    );
    const storyCountBefore = one("SELECT COUNT(*) n FROM newsroom_stories").n;

    state.extraPressItem = true;
    const { json } = await runDiscovery();
    assert.equal(json.itemsIngested, 1, "exactly the new item");

    const after = one("SELECT * FROM newsroom_stories WHERE id=?", [before.id]);
    assert.equal(after.source_count, before.source_count + 1, "the story grew");
    assert.ok(after.update_count > before.update_count, "and records that it moved");
    assert.ok(after.last_source_added_at, "with when");
    assert.equal(
      one("SELECT COUNT(*) n FROM newsroom_stories").n,
      storyCountBefore,
      "no second story for the same development"
    );
  });
});

describe("revisions", { skip }, () => {
  test("a corrected document at a known address is picked up, not dropped", async () => {
    // Deduplication keys on the URL, so a naive implementation drops this —
    // and for a regulation desk a corrected effective date is often the most
    // consequential edit there is.
    const item = one("SELECT * FROM newsroom_source_items WHERE canonical_url LIKE '%ip-26-1234%'");
    assert.match(item.lead, /1 January 2027/);
    assert.equal(item.revised_at, null);

    const storyBefore = one(
      `SELECT s.* FROM newsroom_stories s
         JOIN newsroom_story_sources ss ON ss.story_id = s.id
        WHERE ss.source_item_id = ?`,
      [item.id]
    );
    const itemsBefore = one("SELECT COUNT(*) n FROM newsroom_source_items").n;

    state.correctedDate = true;
    const { json } = await runDiscovery();

    assert.equal(json.itemsIngested, 0, "a revision is not a new item");
    assert.equal(json.itemsRevised, 1, "but it is not nothing either");
    assert.equal(
      one("SELECT COUNT(*) n FROM newsroom_source_items").n,
      itemsBefore,
      "and it must not duplicate the row"
    );

    const after = one("SELECT * FROM newsroom_source_items WHERE id=?", [item.id]);
    assert.match(after.lead, /1 July 2027/, "the corrected text replaces the old");
    assert.notEqual(after.content_hash, item.content_hash);
    assert.ok(after.revised_at, "and the revision is stamped");

    const storyAfter = one("SELECT * FROM newsroom_stories WHERE id=?", [storyBefore.id]);
    assert.ok(storyAfter.update_count > storyBefore.update_count, "the story moved");

    const event = one(
      "SELECT * FROM newsroom_pipeline_events WHERE story_id=? AND reason LIKE '%revised%' ORDER BY id DESC LIMIT 1",
      [storyBefore.id]
    );
    assert.ok(event, "and the revision is on the audit trail");
  });

  test("re-serving the same corrected text changes nothing further", async () => {
    const { json } = await runDiscovery();
    assert.equal(json.itemsIngested, 0);
    assert.equal(json.itemsRevised, 0, "a revision is only a revision once");
  });
});

describe("the Tier-3 gate", { skip }, () => {
  test("a discovery-only story is found, shown, and not qualified", () => {
    const story = one(
      `SELECT s.* FROM newsroom_stories s
         JOIN newsroom_story_sources ss ON ss.story_id = s.id
         JOIN newsroom_source_items i ON i.id = ss.source_item_id
        WHERE i.canonical_url LIKE '%forum-thread%'`
    );
    assert.ok(story, "Tier 3 may open a cluster — that is what it is for");
    assert.equal(story.tier3_source_count, 1);
    assert.equal(story.tier1_source_count, 0);
    assert.equal(story.tier2_source_count, 0);
    assert.equal(story.would_research, 0, "but it may not qualify for research");
    assert.match(story.rejected_reason, /Tier 1 or Tier 2|discovery-only/);

    const gates = JSON.parse(story.gate_results);
    const tier = gates.find((g) => g.id === "tier_support");
    assert.equal(tier.passed, false);
    assert.match(tier.detail, /discovery-only/);
  });
});

describe("the daily cap", { skip }, () => {
  test("only the top N are marked for research, and the rest keep their rank", async () => {
    await setCap(1);
    const { json } = await runDiscovery();
    assert.equal(json.cap, 1);
    assert.equal(json.selected, Math.min(1, json.qualified));

    const selected = query("SELECT * FROM newsroom_stories WHERE would_research=1");
    assert.equal(selected.length, 1);
    assert.equal(selected[0].selection_rank, 1);
    assert.ok(selected[0].selected_on, "the day it was picked is recorded");

    const runnersUp = query(
      "SELECT * FROM newsroom_stories WHERE would_research=0 AND selection_rank IS NOT NULL"
    );
    assert.ok(runnersUp.length >= 1, "near-misses keep their rank so a reviewer can see them");
  });

  test("raising the cap selects more, without touching anything else", async () => {
    await setCap(8);
    const { json } = await runDiscovery();
    assert.equal(json.cap, 8);
    assert.equal(json.selected, json.qualified);
    assert.ok(json.selected >= 1);
  });

  test("a cap of zero researches nothing", async () => {
    await setCap(0);
    const { json } = await runDiscovery();
    assert.equal(json.selected, 0);
    assert.equal(one("SELECT COUNT(*) n FROM newsroom_stories WHERE would_research=1").n, 0);
    await setCap(8);
    await runDiscovery();
  });
});

describe("the dry run surfaces it", { skip }, () => {
  test("the page renders the candidates with their verdict", async () => {
    const html = await (await get("/admin/editorial/dry-run")).text();
    assert.match(html, /AI Act audit documentation/);
    assert.match(html, /Would research|Qualified|Filtered out/);
  });

  test("the rejected view shows what was dropped and why", async () => {
    const html = await (await get("/admin/editorial/dry-run?view=rejected")).text();
    assert.match(html, /Rejected:/);
  });

  // The first member of a story, in the order the card lists them, so it is
  // among the originals shown before anything is expanded.
  const firstOriginal = () =>
    one(
      `SELECT ss.story_id, i.canonical_url, i.title
         FROM newsroom_story_sources ss
         JOIN newsroom_source_items i ON i.id = ss.source_item_id
         JOIN newsroom_sources s ON s.id = i.source_id
        WHERE ss.story_id = (SELECT MIN(story_id) FROM newsroom_story_sources)
        ORDER BY s.authority_tier ASC, i.retrieved_at ASC LIMIT 1`
    );
  const html = (s) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");
  const re = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const linkTo = (item) =>
    new RegExp(
      `<a href="${re(html(item.canonical_url))}" target="_blank" rel="noreferrer noopener"[^>]*>${re(html(item.title))}`
    );

  test("every card links to its original articles without being expanded", async () => {
    const item = firstOriginal();
    assert.ok(item, "the run produced stories with items");
    const page = await (await get("/admin/editorial/dry-run")).text();
    // Server-rendered with every card closed, so a match here is a link the
    // reviewer sees without clicking "Gates and sources".
    assert.match(page, linkTo(item), `no link to ${item.canonical_url} labelled "${item.title}"`);
    // React separates adjacent text nodes with <!-- --> in server HTML.
    assert.match(page.replace(/<!-- -->/g, ""), /Original articles?</);
  });

  test("the story's full record links to its original articles too", async () => {
    const item = firstOriginal();
    const page = await (await get(`/admin/editorial/${item.story_id}`)).text();
    assert.match(page, linkTo(item));
    assert.match(page.replace(/<!-- -->/g, ""), /Original articles \(\d+\)/);
  });

  test("a signed-out visitor cannot see any of it", async () => {
    const res = await fetch(`${BASE}/admin/editorial/dry-run`, { redirect: "manual" });
    assert.ok([302, 307, 308].includes(res.status));
  });
});

describe("feedback becomes permanent labelled data", { skip }, () => {
  test("a verdict is stored with the engine's view frozen alongside it", async () => {
    const story = one("SELECT * FROM newsroom_stories ORDER BY id LIMIT 1");
    const res = await fetch(`${BASE}/api/admin/newsroom/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ storyId: story.id, verdict: "good", note: "exactly right" }),
    });
    assert.equal(res.status, 200);

    const row = one("SELECT * FROM newsroom_discovery_feedback WHERE story_id=?", [story.id]);
    assert.equal(row.verdict, "good");
    assert.equal(row.note, "exactly right");
    assert.equal(row.reviewer, ADMIN_EMAIL);
    assert.equal(row.would_research, story.would_research);
    assert.equal(row.scored, story.relevance_score);
    assert.equal(row.gate_results, story.gate_results, "frozen, not re-read later");
  });

  test("all four verdicts are accepted and anything else is refused", async () => {
    const story = one("SELECT * FROM newsroom_stories ORDER BY id DESC LIMIT 1");
    for (const verdict of ["good", "not_relevant", "duplicate", "wrong_jurisdiction"]) {
      const res = await fetch(`${BASE}/api/admin/newsroom/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({ storyId: story.id, verdict }),
      });
      assert.equal(res.status, 200, verdict);
    }
    const bad = await fetch(`${BASE}/api/admin/newsroom/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ storyId: story.id, verdict: "meh" }),
    });
    assert.equal(bad.status, 400);
  });

  test("it is append-only — a second verdict adds a row rather than replacing one", () => {
    const story = one("SELECT * FROM newsroom_stories ORDER BY id DESC LIMIT 1");
    const rows = query("SELECT * FROM newsroom_discovery_feedback WHERE story_id=?", [story.id]);
    assert.ok(rows.length >= 4, "a changed mind is also data about how clear the case was");
  });

  test("a signed-out caller cannot label anything", async () => {
    const before = one("SELECT COUNT(*) n FROM newsroom_discovery_feedback").n;
    const res = await fetch(`${BASE}/api/admin/newsroom/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storyId: 1, verdict: "good" }),
    });
    assert.equal(res.status, 403);
    assert.equal(one("SELECT COUNT(*) n FROM newsroom_discovery_feedback").n, before);
  });
});

describe("discovery cannot reach the rest of the pipeline", { skip }, () => {
  test("no evidence, no draft, no review, no editorial decision", () => {
    for (const table of [
      "newsroom_evidence_packs",
      "newsroom_evidence_claims",
      "newsroom_drafts",
      "newsroom_ai_reviews",
      "newsroom_editorial_decisions",
    ]) {
      assert.equal(one(`SELECT COUNT(*) n FROM ${table}`).n, 0, `${table} must stay empty in phase 2`);
    }
  });

  test("nothing spent — there is no AI in this phase", () => {
    assert.equal(one("SELECT COUNT(*) n FROM newsroom_ai_spend").n, 0);
  });

  test("no story moved past DISCOVERED", () => {
    const states = query("SELECT DISTINCT state FROM newsroom_stories").map((r) => r.state);
    assert.deepEqual(states, ["DISCOVERED"], `qualifying is a flag, not a state change: ${states}`);
  });

  test("no article was created, changed or published", () => {
    const articles = query("SELECT id, slug, status, updated_at FROM articles ORDER BY id");
    assert.ok(articles.length > 0, "the seed's articles are still there");
    assert.equal(
      articles.filter((a) => a.slug.startsWith("newsroom") || a.slug.startsWith("story-")).length,
      0,
      "discovery must not write articles"
    );
    assert.equal(
      one("SELECT COUNT(*) n FROM newsroom_stories WHERE article_id IS NOT NULL").n,
      0
    );
  });
});

describe("the rest of STAI is unaffected", { skip }, () => {
  test("the public pages still answer", async () => {
    for (const p of ["/", "/news", "/insights", "/prompts", "/sitemap.xml", "/feed.xml", "/robots.txt"]) {
      const res = await fetch(BASE + p, { redirect: "manual" });
      assert.equal(res.status, 200, `${p} should still be 200`);
    }
  });

  test("the sitemap advertises no newsroom URL", async () => {
    const xml = await (await fetch(`${BASE}/sitemap.xml`)).text();
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname);
    assert.deepEqual(
      locs.filter((p) => p.startsWith("/admin") || p.startsWith("/api")),
      []
    );
  });

  test("no public route exposes discovery", async () => {
    for (const p of ["/newsroom", "/discovery", "/api/newsroom/items"]) {
      assert.equal((await fetch(BASE + p, { redirect: "manual" })).status, 404, p);
    }
  });

  test("the discovery endpoint refuses an unauthenticated caller", async () => {
    const res = await fetch(`${BASE}/api/admin/newsroom/discover`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    assert.equal(res.status, 403, "an open crawl trigger would be an amplifier");
  });

  test("there is no unauthenticated way in, by any header", async () => {
    // The scheduled run calls the service directly from the Worker, so no
    // header, token or secret authorises this route. An admin session is the
    // only key, and the route lives under /api/admin for that reason.
    for (const headers of [
      { "x-newsroom-cron": "anything" },
      { authorization: "Bearer anything" },
      { "x-internal": "true" },
    ]) {
      const res = await fetch(`${BASE}/api/admin/newsroom/discover`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: "{}",
      });
      assert.equal(res.status, 403, JSON.stringify(headers));
    }
  });

  test("the old public discovery route no longer exists", async () => {
    const res = await fetch(`${BASE}/api/newsroom/discover`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    assert.equal(res.status, 404, "the endpoint protected by a shared secret is gone");
  });

  test("the manual content editor still works", async () => {
    assert.equal((await get("/admin/content")).status, 200);
    assert.equal((await get("/admin/content/new")).status, 200);
  });
});

describe("the scheduled run is gated by a setting, not a secret", { skip }, () => {
  test("discovery ships switched off", () => {
    // The cron trigger can be deployed before a single source is approved: it
    // fires, finds this off, logs why and does nothing.
    //
    // Asserted against the registry source, because a shipped DEFAULT is
    // precisely the thing a database cannot show — an unset key is the
    // default, so there is no row to read.
    const src = fs.readFileSync(path.join(ROOT, "src/lib/site-config.ts"), "utf8");
    const entry = src.split("\n").find((l) => l.includes('id: "discovery"'));
    assert.ok(entry, "there must be a discovery switch in TOGGLES");
    assert.match(entry, /on: false/, "and it must ship off");
    assert.ok(!/path:/.test(entry), "it guards a schedule, not a page");
  });

  test("the scheduled handler reads that switch and holds no secret", () => {
    const raw = fs.readFileSync(path.join(ROOT, "src/lib/newsroom/scheduled.ts"), "utf8");
    // Comments are stripped first: this file explains the design it replaced,
    // and grepping prose for "secret" finds that explanation rather than any
    // code. The claim is about what the module DOES.
    const code = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

    assert.match(code, /isEnabled\("discovery"\)/, "the schedule is gated by the setting");
    assert.ok(
      !/secret|token|authoriz|bearer/i.test(code),
      "the scheduled path authorises nothing — it calls the service directly"
    );
    assert.ok(!/\bfetch\s*\(/.test(code), "no HTTP hop back into the app");
    assert.match(code, /runDiscovery\(/, "it calls the discovery service");
  });

  test("the Worker entry delegates and holds no logic", () => {
    // entry.ts is the one file tsconfig never sees, so anything beyond
    // delegation there is untypechecked by construction.
    const raw = fs.readFileSync(path.join(ROOT, "worker/entry.ts"), "utf8");
    const code = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    assert.match(code, /runScheduledDiscovery/);
    assert.ok(!/secret|x-newsroom-cron/i.test(code), "no secret in the entry point either");
    assert.ok(!/new Request\(/.test(code), "it does not construct a request into itself");
  });

  test("switching it off does not disable the manual run", async () => {
    await fetch(`${BASE}/api/admin/settings`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ values: { "page.discovery.enabled": "0" } }),
    });
    const { status } = await runDiscovery();
    assert.equal(status, 200, "an operator asking for one run is not the schedule");
  });
});

describe("recovery", { skip }, () => {
  test("a source that starts failing is marked, and recovers when it comes back", async () => {
    state.regulatorDown = true;
    await runDiscovery();
    let s = one("SELECT * FROM newsroom_sources WHERE name='Stub Regulator'");
    assert.equal(s.last_outcome, "http_error");
    assert.ok(s.consecutive_failures >= 1);
    const successBefore = s.last_success_at;
    assert.ok(successBefore, "the earlier success is not erased by a later failure");

    state.regulatorDown = false;
    await runDiscovery();
    s = one("SELECT * FROM newsroom_sources WHERE name='Stub Regulator'");
    assert.equal(s.consecutive_failures, 0, "a working fetch clears the counter");
    assert.equal(s.last_error, "");
    assert.ok(s.last_success_at >= successBefore);
  });
});
