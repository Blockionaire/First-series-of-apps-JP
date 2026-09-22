/**
 * The Editorial admin surface, against a real server and a real database.
 *
 * The rules being defended here cannot be checked by reading a module: they
 * are about what the HTTP boundary does and what actually ends up in D1.
 *
 *   · The approval gate. Registering a source must never activate it, and
 *     there must be no way to ask for both in one call. This is operator
 *     decision D5, and it is the difference between an allowlist somebody
 *     read and whatever a seed file happened to contain.
 *   · Retrieval permission is never assumed. Every row lands unfetchable.
 *   · The whole surface is admin-only.
 *   · Phase 1 adds no public surface and changes nothing readers can see.
 */
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import Database from "better-sqlite3";
import fs from "fs";
import os from "os";
import path from "path";

const PORT = Number(process.env.NEWSROOM_TEST_PORT ?? 3211);
const BASE = `http://127.0.0.1:${PORT}`;
const ROOT = path.resolve(import.meta.dirname, "..");
const STANDALONE = path.join(ROOT, ".next/standalone/server.js");
const hasBuild = fs.existsSync(STANDALONE);

const ADMIN_EMAIL = "newsroom-admin@test.eu";
const ADMIN_PASSWORD = "newsroom-admin-password";

let dataDir, server, cookie;

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

const get = (p, opts = {}) => fetch(BASE + p, { redirect: "manual", ...opts });
const authed = (p) => get(p, { headers: { Cookie: cookie } });

/** POST to the newsroom source route. `auth` false sends no session. */
async function post(body, auth = true) {
  const res = await fetch(`${BASE}/api/admin/newsroom/source`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(auth ? { Cookie: cookie } : {}),
    },
    body: JSON.stringify(body),
  });
  return { status: res.status, json: await res.json().catch(() => ({})) };
}

const db = (writable = false) =>
  new Database(path.join(dataDir, "stai.db"), { readonly: !writable });

function query(sql, params = []) {
  const d = db();
  const rows = d.prepare(sql).all(...params);
  d.close();
  return rows;
}

const one = (sql, params = []) => query(sql, params)[0];

/**
 * A direct write, used only to set up a state the API cannot produce —
 * stale ETags and a failure record from a previous address. Everything the
 * application is responsible for still goes through the real route.
 */
function exec(sql, params = []) {
  const d = db(true);
  d.prepare(sql).run(...params);
  d.close();
}

before(async () => {
  if (!hasBuild) return;
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "stai-newsroom-"));
  server = startServer();
  await waitHealthy();
  cookie = await login();
});

after(async () => {
  if (server) {
    const exited = new Promise((r) => server.once("exit", r));
    server.kill("SIGTERM");
    await Promise.race([exited, new Promise((r) => setTimeout(r, 10_000))]);
  }
  if (dataDir) fs.rmSync(dataDir, { recursive: true, force: true });
});

const skip = hasBuild ? false : "no standalone build";

describe("the newsroom schema is actually applied", { skip }, () => {
  test("every phase-1 table exists", () => {
    const expected = [
      "newsroom_sources",
      "newsroom_source_items",
      "newsroom_stories",
      "newsroom_story_sources",
      "newsroom_evidence_packs",
      "newsroom_evidence_claims",
      "newsroom_drafts",
      "newsroom_ai_reviews",
      "newsroom_editorial_decisions",
      "newsroom_pipeline_runs",
      "newsroom_pipeline_events",
      "newsroom_ai_spend",
    ];
    const present = query("SELECT name FROM sqlite_master WHERE type='table'").map((r) => r.name);
    const missing = expected.filter((t) => !present.includes(t));
    assert.deepEqual(missing, [], `missing tables: ${missing.join(", ")}`);
  });

  test("articles gained a jurisdictions column without losing anything", () => {
    const cols = query("PRAGMA table_info(articles)").map((c) => c.name);
    assert.ok(cols.includes("jurisdictions"), "articles.jurisdictions should exist");
    // The columns the public site depends on are untouched.
    for (const c of ["slug", "title", "body_md", "status", "published_at", "updated_at", "kind"]) {
      assert.ok(cols.includes(c), `articles.${c} must survive the migration`);
    }
  });

  test("existing articles are not retro-tagged with a guess", () => {
    const rows = query("SELECT jurisdictions FROM articles LIMIT 20");
    assert.ok(rows.length > 0, "the seed should have articles");
    for (const r of rows) {
      assert.equal(r.jurisdictions, "[]", "a migration must not invent a jurisdiction");
    }
  });
});

describe("the approval gate", { skip }, () => {
  test("the registry starts empty — nothing is seeded behind your back", () => {
    assert.equal(query("SELECT * FROM newsroom_sources").length, 0);
  });

  test("loading the proposal registers every source and activates none", async () => {
    const { status, json } = await post({ action: "load_proposal" });
    assert.equal(status, 200);
    assert.deepEqual(json.rejected, [], "every proposed source must pass validation");
    assert.ok(json.inserted >= 40, `expected 40+ sources, got ${json.inserted}`);

    const rows = query("SELECT active, fetch_allowed, activated_at, activated_by FROM newsroom_sources");
    assert.equal(rows.length, json.inserted);
    for (const r of rows) {
      assert.equal(r.active, 0, "no source may be active on registration");
      assert.equal(r.fetch_allowed, 0, "retrieval permission is never assumed");
      assert.equal(r.activated_at, null);
      assert.equal(r.activated_by, null);
    }
  });

  test("re-loading is idempotent rather than duplicating the registry", async () => {
    const before = query("SELECT COUNT(*) n FROM newsroom_sources")[0].n;
    const { status, json } = await post({ action: "load_proposal" });
    assert.equal(status, 200);
    assert.equal(json.inserted, 0, "nothing new to insert");
    const after = query("SELECT COUNT(*) n FROM newsroom_sources")[0].n;
    assert.equal(after, before);
  });

  test("activation is one source at a time, and records who did it", async () => {
    const id = query("SELECT id FROM newsroom_sources ORDER BY id LIMIT 1")[0].id;
    const { status } = await post({ action: "set_flag", id, field: "active", value: true });
    assert.equal(status, 200);

    const row = query("SELECT active, activated_by, activated_at FROM newsroom_sources WHERE id=?", [id])[0];
    assert.equal(row.active, 1);
    assert.equal(row.activated_by, ADMIN_EMAIL, "an activation without a name is not an approval");
    assert.ok(row.activated_at, "and it is stamped");

    // Exactly one source moved.
    assert.equal(query("SELECT COUNT(*) n FROM newsroom_sources WHERE active=1")[0].n, 1);
  });

  test("deactivating clears the approval rather than leaving a stale name on it", async () => {
    const id = query("SELECT id FROM newsroom_sources WHERE active=1")[0].id;
    await post({ action: "set_flag", id, field: "active", value: false });
    const row = query("SELECT active, activated_by FROM newsroom_sources WHERE id=?", [id])[0];
    assert.equal(row.active, 0);
    assert.equal(row.activated_by, null);
  });

  test("retrieval permission is a separate switch from activation", async () => {
    const id = query("SELECT id FROM newsroom_sources ORDER BY id LIMIT 1")[0].id;
    await post({ action: "set_flag", id, field: "fetch_allowed", value: true });
    const row = query("SELECT active, fetch_allowed FROM newsroom_sources WHERE id=?", [id])[0];
    assert.equal(row.fetch_allowed, 1);
    assert.equal(row.active, 0, "wanting a source must not imply being allowed to take it");
    await post({ action: "set_flag", id, field: "fetch_allowed", value: false });
  });

  test("there is no bulk activate", async () => {
    // Each of these would be a way to approve everything at once. None may work.
    for (const body of [
      { action: "set_flag", field: "active", value: true },
      { action: "set_flag", id: "all", field: "active", value: true },
      { action: "activate_all" },
      { action: "load_proposal", active: true },
    ]) {
      await post(body);
    }
    assert.equal(
      query("SELECT COUNT(*) n FROM newsroom_sources WHERE active=1")[0].n,
      0,
      "no call may activate sources en masse"
    );
  });

  test("an unknown field or action is refused", async () => {
    const id = query("SELECT id FROM newsroom_sources ORDER BY id LIMIT 1")[0].id;
    assert.equal((await post({ action: "set_flag", id, field: "tier", value: true })).status, 400);
    assert.equal((await post({ action: "delete_everything" })).status, 400);
  });
});

describe("the registry shows the feed URL it will actually fetch", { skip }, () => {
  test("the proposal preview links every feed before anything is registered", async () => {
    // Shown BEFORE registration on purpose: these URLs are documented
    // locations nobody has fetched, and checking one is the difference
    // between registering a working source and registering a 404.
    const html = await (await authed("/admin/editorial/sources")).text();
    assert.match(html, /https:\/\/eur-lex\.europa\.eu\/EN\/display-feed\.rss/);
    assert.match(html, /target="_blank"/);
  });

  test("each registered row shows its exact feed URL, as a link", async () => {
    await post({ action: "load_proposal" });
    const html = await (await authed("/admin/editorial/sources")).text();

    // The full string, not a shortened one: a feed URL that 404s and one that
    // serves a landing page are indistinguishable from the health column, so
    // the operator has to be able to read and open the exact value.
    const rows = query(
      "SELECT name, feed_url FROM newsroom_sources WHERE feed_url != '' ORDER BY id LIMIT 8"
    );
    assert.ok(rows.length >= 5, "there should be registered sources with feeds");

    // As TEXT, not merely somewhere in the markup. Checking `includes(url)`
    // is satisfied by the href alone, so a truncated label like
    // "https://eur-lex.europa.eu/EN/dis…" would pass it while defeating the
    // entire purpose — reading the exact value before approving retrieval.
    // A text node sits between tags, hence the delimiters.
    const escape = (u) => u.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    for (const r of rows) {
      const text = escape(r.feed_url);
      assert.ok(
        html.includes(`>${text}<`),
        `${r.name}: the exact URL must be readable on the page, not only in an href`
      );
      assert.ok(html.includes(`href="${text}"`), `${r.name}: and it must be the link target`);
    }
    assert.match(html, /Open feed/, "with a labelled control");
    assert.match(html, /rel="noreferrer/, "external links must not leak the admin referrer");
  });

  test("a source with no feed says so rather than showing an empty link", async () => {
    const html = await (await authed("/admin/editorial/sources")).text();
    // LinkedIn is registered `manual` because its terms forbid retrieval.
    assert.match(html, /no feed — entered by hand/);
  });
});

describe("hand-registered sources are validated at the boundary", { skip }, () => {
  const base = {
    action: "create",
    name: "Test Regulator",
    domain: "example-regulator.eu",
    source_type: "regulator",
    authority_tier: 1,
    jurisdictions: ["EU"],
    topics: ["regulation"],
    ingestion_method: "rss",
    feed_url: "https://example-regulator.eu/feed.xml",
  };

  test("a valid source is accepted and lands inactive", async () => {
    const { status, json } = await post(base);
    assert.equal(status, 200);
    const row = query("SELECT active, fetch_allowed FROM newsroom_sources WHERE id=?", [json.id])[0];
    assert.equal(row.active, 0);
    assert.equal(row.fetch_allowed, 0);
  });

  test("the same domain cannot be registered twice at two tiers", async () => {
    const { status } = await post({ ...base, authority_tier: 3, name: "Same domain, lower tier" });
    assert.equal(status, 409);
  });

  test("a feed on someone else's host is refused", async () => {
    const { status, json } = await post({
      ...base,
      domain: "another-regulator.eu",
      feed_url: "https://random-blog.example.com/feed",
    });
    assert.equal(status, 400);
    assert.match(json.error, /does not belong/);
  });

  test("a bad tier is refused rather than clamped", async () => {
    const { status } = await post({ ...base, domain: "tier-four.eu", authority_tier: 4 });
    assert.equal(status, 400);
  });

  test("a caller cannot register a source as already permitted", async () => {
    const { json } = await post({
      ...base,
      domain: "presumptuous.eu",
      feed_url: "https://presumptuous.eu/feed.xml",
      fetch_allowed: true,
      active: true,
    });
    const row = query("SELECT active, fetch_allowed FROM newsroom_sources WHERE id=?", [json.id])[0];
    assert.equal(row.fetch_allowed, 0, "the route must ignore a fetch_allowed it was handed");
    assert.equal(row.active, 0, "and an active flag too");
  });
});

describe("correcting a moved feed URL", { skip }, () => {
  /** The AFM row, whose feed URL was the first found to 404 in production. */
  const afm = () => one("SELECT * FROM newsroom_sources WHERE domain='afm.nl'");

  test("an operator can replace a feed URL from the browser", async () => {
    const before = afm();
    assert.ok(before, "the AFM should be registered");

    const { status, json } = await post({
      action: "set_feed_url",
      id: before.id,
      feed_url: "https://www.afm.nl/en/sector/actueel/rss",
    });
    assert.equal(status, 200, JSON.stringify(json));

    const after = afm();
    // Stored canonically — validateSource strips the www from the DOMAIN but
    // keeps the URL as given, since a feed host is not ours to rewrite.
    assert.equal(after.feed_url, "https://www.afm.nl/en/sector/actueel/rss");
  });

  test("the retrieval method travels with the address", async () => {
    // The dead end the feed tester would otherwise walk an operator into.
    // A source registered as html_scrape whose real feed is then found is
    // still skipped as unsupported however correct its URL is, so it would
    // be verified, approved, activated — and silently never fetched.
    const iaasb = () => one("SELECT * FROM newsroom_sources WHERE domain='iaasb.org'");
    const before = iaasb();
    assert.equal(before.ingestion_method, "html_scrape", "registered without a known feed");

    const { status, json } = await post({
      action: "set_feed_url",
      id: before.id,
      feed_url: "https://www.iaasb.org/feed.xml",
      ingestion_method: "rss",
    });
    assert.equal(status, 200, JSON.stringify(json));
    assert.equal(iaasb().ingestion_method, "rss");
    assert.equal(json.ingestion_method, "rss");
  });

  test("an unknown retrieval method is refused, not stored", async () => {
    const iaasb = () => one("SELECT * FROM newsroom_sources WHERE domain='iaasb.org'");
    const { status, json } = await post({
      action: "set_feed_url",
      id: iaasb().id,
      feed_url: "https://www.iaasb.org/feed.xml",
      ingestion_method: "telepathy",
    });
    assert.equal(status, 400);
    assert.match(json.error, /ingestion method/i);
    assert.equal(iaasb().ingestion_method, "rss", "the previous method stands");
  });

  test("omitting the method keeps the one already registered", async () => {
    const iaasb = () => one("SELECT * FROM newsroom_sources WHERE domain='iaasb.org'");
    await post({
      action: "set_feed_url",
      id: iaasb().id,
      feed_url: "https://www.iaasb.org/news-events/feed",
    });
    assert.equal(iaasb().ingestion_method, "rss", "unchanged, not reset to a default");
  });

  test("changing the URL revokes retrieval permission", async () => {
    // The whole premise of the two-switch gate: permission was granted for a
    // SPECIFIC address whose robots.txt and terms a human checked. A new
    // address has not been checked, so the tick cannot carry over.
    const s = afm();
    await post({ action: "set_flag", id: s.id, field: "fetch_allowed", value: true });
    assert.equal(afm().fetch_allowed, 1);

    await post({
      action: "set_feed_url",
      id: s.id,
      feed_url: "https://www.afm.nl/nl-nl/professionals/nieuws/rss",
    });
    assert.equal(afm().fetch_allowed, 0, "a corrected URL is an unchecked URL");
  });

  test("the old address's cache validators and health do not carry over", async () => {
    // An ETag from the previous URL would make the first fetch of the new one
    // answer 304 and look healthy while returning nothing.
    const s = afm();
    exec(
      "UPDATE newsroom_sources SET etag=?, last_modified_header=?, last_outcome=?, last_error=?, consecutive_failures=? WHERE id=?",
      ['"abc123"', "Mon, 01 Jan 2026 00:00:00 GMT", "http_error", "404 Not Found", 4, s.id]
    );

    await post({
      action: "set_feed_url",
      id: s.id,
      feed_url: "https://www.afm.nl/nl-nl/rss/actueel",
    });

    const after = afm();
    assert.equal(after.etag, "");
    assert.equal(after.last_modified_header, "");
    assert.equal(after.last_error, "");
    assert.equal(after.consecutive_failures, 0, "the new address starts with a clean record");
  });

  test("the change is on the audit trail", () => {
    const row = one(
      "SELECT * FROM newsroom_fetch_log WHERE source_id=(SELECT id FROM newsroom_sources WHERE domain='afm.nl') ORDER BY id DESC LIMIT 1"
    );
    assert.ok(row, "a URL change must leave a record");
    assert.match(row.error, /feed URL changed by/);
    assert.match(row.error, new RegExp(ADMIN_EMAIL.replace(".", "\\.")));
  });

  test("a correction cannot repoint a source at another host", async () => {
    // This is what stops a Tier-1 row quietly becoming a laundering route for
    // somebody's blog. Same rule as registration, same function.
    const s = afm();
    const { status, json } = await post({
      action: "set_feed_url",
      id: s.id,
      feed_url: "https://random-blog.example.com/feed.xml",
    });
    assert.equal(status, 400);
    assert.match(json.error, /does not belong/);
    assert.match(afm().feed_url, /afm\.nl/, "and the stored URL is untouched");
  });

  test("http, javascript: and empty are all refused", async () => {
    const s = afm();
    const original = afm().feed_url;
    for (const bad of [
      "http://www.afm.nl/rss",
      "javascript:alert(1)",
      "not a url",
      "",
      "   ",
    ]) {
      const { status } = await post({ action: "set_feed_url", id: s.id, feed_url: bad });
      assert.equal(status, 400, `${bad || "(empty)"} must be refused`);
    }
    assert.equal(afm().feed_url, original, "nothing was written");
  });

  test("a subdomain of the registered domain is accepted", async () => {
    const arxiv = one("SELECT * FROM newsroom_sources WHERE domain='arxiv.org'");
    const { status } = await post({
      action: "set_feed_url",
      id: arxiv.id,
      feed_url: "https://export.arxiv.org/api/query?search_query=cat:cs.AI+OR+cat:cs.CL",
    });
    assert.equal(status, 200);
  });

  test("an unknown source id is a 404, not a silent no-op", async () => {
    const { status } = await post({
      action: "set_feed_url",
      id: 999999,
      feed_url: "https://afm.nl/rss",
    });
    assert.equal(status, 404);
  });

  test("a signed-out caller cannot change a feed URL", async () => {
    const s = afm();
    const original = s.feed_url;
    const { status } = await post(
      { action: "set_feed_url", id: s.id, feed_url: "https://www.afm.nl/hacked" },
      false
    );
    assert.equal(status, 403);
    assert.equal(afm().feed_url, original);
  });

  test("the registry page offers the control", async () => {
    const html = await (await authed("/admin/editorial/sources")).text();
    assert.match(html, /Edit</, "each row needs an edit control");
  });

  test("the form warns that saving costs the retrieval tick", () => {
    // Asserted against the component rather than the HTML: the warning sits
    // inside the edit form, which only exists once a row is open, so it is
    // client-rendered and never appears in a server response.
    const src = fs.readFileSync(
      path.join(ROOT, "src/components/admin/SourceRegistry.tsx"),
      "utf8"
    );
    assert.match(src, /Saving resets Retrievable/, "the operator must be told what it costs");
    assert.match(src, /belong to \{s\.domain\}/, "and which host the new URL must belong to");
  });
});

describe("the newsroom is admin-only", { skip }, () => {
  test("the Editorial pages redirect a signed-out visitor", async () => {
    for (const p of ["/admin/editorial", "/admin/editorial/sources", "/admin/editorial/1"]) {
      const res = await get(p);
      assert.ok([302, 307, 308].includes(res.status), `${p} should redirect, got ${res.status}`);
      assert.match(res.headers.get("location") ?? "", /\/login/);
    }
  });

  test("and an admin can open them", async () => {
    for (const p of ["/admin/editorial", "/admin/editorial/sources"]) {
      assert.equal((await authed(p)).status, 200, `${p} should render for an admin`);
    }
  });

  test("the write route refuses an unauthenticated caller", async () => {
    const { status } = await post({ action: "load_proposal" }, false);
    assert.equal(status, 403);
  });

  test("a signed-out caller cannot activate a source", async () => {
    const id = query("SELECT id FROM newsroom_sources ORDER BY id LIMIT 1")[0].id;
    await post({ action: "set_flag", id, field: "active", value: true }, false);
    assert.equal(query("SELECT active FROM newsroom_sources WHERE id=?", [id])[0].active, 0);
  });
});

describe("phase 1 adds nothing readers can see", { skip }, () => {
  test("there is no public newsroom route", async () => {
    for (const p of ["/editorial", "/newsroom", "/api/newsroom"]) {
      assert.equal((await get(p)).status, 404, `${p} must not exist`);
    }
  });

  test("the public pages still work", async () => {
    for (const p of ["/", "/news", "/insights", "/sitemap.xml", "/feed.xml"]) {
      assert.equal((await get(p)).status, 200, `${p} should still be 200`);
    }
  });

  test("the sitemap does not advertise anything from the newsroom", async () => {
    const xml = await (await get("/sitemap.xml")).text();
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname);
    // Path-level, not a text search: the public author page is
    // /authors/stai-editorial, so grepping the whole document for "editorial"
    // flags the byline and tells you nothing about the newsroom.
    const leaked = locs.filter((p) => p.startsWith("/admin") || p.startsWith("/api"));
    assert.deepEqual(leaked, [], "no admin or API path may be advertised to crawlers");
    assert.ok(locs.length > 5, "and the sitemap should still have real entries");
  });

  test("the manual content editor is untouched and still reachable", async () => {
    assert.equal((await authed("/admin/content")).status, 200);
    assert.equal((await authed("/admin/content/new")).status, 200);
  });
});

/* ── Phase 2.5: the feed tester and the review status ───────────────────── */

describe("the feed tester", { skip }, () => {
  /**
   * A domain that can never resolve.
   *
   * RFC 2606 reserves `.invalid` precisely for this. Pointing the probe at a
   * real publisher would make the suite both flaky and rude — it would send
   * traffic to a regulator every time anyone runs the tests — and the parsing
   * path is covered without a network in tests/discovery.test.mjs. What is
   * being defended here is the HTTP boundary: who may call this, what it may
   * be aimed at, and what it must not touch.
   */
  const DOMAIN = "stai-probe-test.invalid";
  let sourceId;

  before(async () => {
    if (!hasBuild) return;
    const { json } = await post({
      action: "create",
      name: "Probe test source",
      domain: DOMAIN,
      source_type: "regulator",
      authority_tier: 1,
      jurisdictions: ["EU"],
      topics: ["audit"],
      ingestion_method: "rss",
      feed_url: `https://${DOMAIN}/rss`,
      license_notes: "",
    });
    sourceId = json.id;
  });

  const source = () => one("SELECT * FROM newsroom_sources WHERE id=?", [sourceId]);
  const probeRows = () =>
    query("SELECT * FROM newsroom_source_probes WHERE source_id=? ORDER BY id", [sourceId]);

  test("the source starts off and unapproved, as everything does", () => {
    assert.equal(source().active, 0);
    assert.equal(source().fetch_allowed, 0);
  });

  test("a source that is off and unapproved can still be tested", async () => {
    // The whole point: deciding whether a URL is worth approving has to be
    // possible before approving it.
    const { status, json } = await post({ action: "test_source", id: sourceId });
    assert.equal(status, 200, JSON.stringify(json));
    assert.equal(json.ok, true);
    assert.equal(json.probe.ok, false, "the domain cannot resolve");
    assert.equal(json.probe.httpStatus, null);
    assert.ok(json.probe.error, "and it says why rather than throwing");
  });

  test("testing grants nothing", () => {
    const s = source();
    assert.equal(s.active, 0, "still off");
    assert.equal(s.fetch_allowed, 0, "still unapproved");
    assert.equal(s.etag, "", "no conditional-GET validator was stored");
    assert.equal(s.last_outcome, "", "the source's health record is untouched");
  });

  test("testing ingests nothing", () => {
    // A probe that created a source item would have quietly become an
    // ingestion path around the permission gate.
    const items = one("SELECT COUNT(*) n FROM newsroom_source_items WHERE source_id=?", [sourceId]);
    const stories = one("SELECT COUNT(*) n FROM newsroom_stories");
    assert.equal(items.n, 0);
    assert.equal(stories.n, 0);
  });

  test("every attempt is recorded, including the failure", () => {
    const rows = probeRows();
    assert.equal(rows.length, 1);
    assert.equal(rows[0].url, `https://${DOMAIN}/rss`);
    assert.equal(rows[0].ok, 0);
    assert.match(rows[0].actor, /@/, "attributed to the admin who ran it");
  });

  test("a candidate path on the same domain may be tried", async () => {
    const { status, json } = await post({
      action: "test_source",
      id: sourceId,
      url: `https://${DOMAIN}/news/feed.xml`,
    });
    assert.equal(status, 200);
    assert.equal(json.url, `https://${DOMAIN}/news/feed.xml`);
    // Trying a candidate must not commit it.
    assert.equal(source().feed_url, `https://${DOMAIN}/rss`, "the stored feed URL is unchanged");
    assert.equal(probeRows().length, 2, "and the sequence of attempts is kept");
  });

  test("it cannot be aimed at another origin", async () => {
    const before = probeRows().length;
    for (const url of [
      "https://evil.example.com/x",
      "http://169.254.169.254/latest/meta-data/",
      "https://127.0.0.1/admin",
      `http://${DOMAIN}/rss`,
    ]) {
      const { status, json } = await post({ action: "test_source", id: sourceId, url });
      assert.equal(status, 400, `${url} should be refused`);
      assert.match(json.error, new RegExp(DOMAIN));
    }
    assert.equal(probeRows().length, before, "refused before any request was made");
  });

  test("it is admin-only", async () => {
    const { status } = await post({ action: "test_source", id: sourceId }, false);
    assert.equal(status, 403);
  });

  test("an unknown source is a 404, not a fetch", async () => {
    const { status } = await post({ action: "test_source", id: 999999 });
    assert.equal(status, 404);
  });
});

describe("the review status is advisory, not a permission", { skip }, () => {
  const DOMAIN = "stai-review-test.invalid";
  let sourceId;

  before(async () => {
    if (!hasBuild) return;
    const { json } = await post({
      action: "create",
      name: "Review test source",
      domain: DOMAIN,
      source_type: "standard_setter",
      authority_tier: 1,
      jurisdictions: ["EU"],
      topics: ["audit"],
      ingestion_method: "rss",
      feed_url: `https://${DOMAIN}/rss`,
      license_notes: "",
    });
    sourceId = json.id;
  });

  const source = () => one("SELECT * FROM newsroom_sources WHERE id=?", [sourceId]);

  test("a new source is unreviewed", () => {
    assert.equal(source().review_status, "unreviewed");
  });

  test("a status records who decided it and when", async () => {
    const { status } = await post({
      action: "set_review",
      id: sourceId,
      status: "feed_verified",
      note: "/rss serves atom, 25 items",
    });
    assert.equal(status, 200);
    const s = source();
    assert.equal(s.review_status, "feed_verified");
    assert.match(s.reviewed_by, /@/);
    assert.ok(s.reviewed_at, "and when");
    assert.match(s.review_note, /25 items/);
  });

  test("'retrieval approved' does NOT grant retrieval", async () => {
    // The point of the whole two-switch design. A reviewer recording that they
    // read the terms must not be the act that starts outbound requests.
    await post({ action: "set_review", id: sourceId, status: "retrieval_approved" });
    const s = source();
    assert.equal(s.review_status, "retrieval_approved");
    assert.equal(s.fetch_allowed, 0, "permission is still a separate, deliberate click");
    assert.equal(s.active, 0);
  });

  test("'do not use' withdraws both permissions", async () => {
    // The one direction a status may move a permission, and it is the
    // restrictive one: a source examined and rejected must not keep fetching.
    await post({ action: "set_flag", id: sourceId, field: "active", value: true });
    await post({ action: "set_flag", id: sourceId, field: "fetch_allowed", value: true });
    assert.equal(source().active, 1, "set up: the source is live");
    assert.equal(source().fetch_allowed, 1);

    await post({ action: "set_review", id: sourceId, status: "do_not_use" });
    const s = source();
    assert.equal(s.review_status, "do_not_use");
    assert.equal(s.active, 0, "switched off");
    assert.equal(s.fetch_allowed, 0, "and retrieval withdrawn");
  });

  test("an unknown status is refused rather than stored", async () => {
    const { status, json } = await post({
      action: "set_review",
      id: sourceId,
      status: "probably_fine",
    });
    assert.equal(status, 400);
    assert.match(json.error, /Unknown review status/);
    assert.equal(source().review_status, "do_not_use", "the previous status stands");
  });

  test("it is admin-only", async () => {
    const { status } = await post(
      { action: "set_review", id: sourceId, status: "unreviewed" },
      false
    );
    assert.equal(status, 403);
  });
});
