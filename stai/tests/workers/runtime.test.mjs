/**
 * STAI Free under the actual Cloudflare Workers runtime.
 *
 * Not Node, not `next start`, not a mocked D1: this boots `wrangler dev`,
 * which runs the OpenNext-built Worker inside workerd against Wrangler's real
 * local D1 implementation. Every assertion below is a fact about the runtime
 * the site will actually deploy to.
 *
 * The database starts EMPTY and is built the way production will be:
 *   wrangler d1 migrations apply   →  0001_initial_schema, 0002_indexes
 *   wrangler d1 execute --file     →  the verified corpus seed
 * No migration or seeding happens at Worker boot, deliberately — a Worker
 * boots on every cold isolate, and writing schema or content as a side effect
 * of that is the behaviour the seeding rules exist to prevent.
 *
 * Requires a Workers build first:  npm run cf:build
 */
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import fs from "fs";
import os from "os";
import path from "path";

const ROOT = path.resolve(import.meta.dirname, "../..");
const WORKER = path.join(ROOT, ".open-next/worker.js");
const hasBuild = fs.existsSync(WORKER);
const skip = hasBuild ? false : "no Workers build — run `npm run cf:build` first";

const PORT = Number(process.env.WORKERS_TEST_PORT ?? 8799);
const BASE = `http://127.0.0.1:${PORT}`;
const ADMIN_EMAIL = "workers-admin@test.eu";
const ADMIN_PASSWORD = "workers-admin-password";

let stateDir, server, adminCookie;

/** Run a wrangler subcommand against the isolated local D1 for this test. */
function wrangler(args) {
  return execFileSync("npx", ["wrangler", ...args, "--local", "--persist-to", stateDir], {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, CI: "1" },
  });
}

/** Query the local D1 directly, the way an operator would. */
function d1(sql) {
  const out = wrangler(["d1", "execute", "stai-production", "--command", sql, "--json"]);
  const json = JSON.parse(out.slice(out.indexOf("[")));
  return json[0].results;
}

before(async () => {
  if (!hasBuild) return;
  stateDir = fs.mkdtempSync(path.join(os.tmpdir(), "stai-wstate-"));

  // A clean database, built from the same files production will use.
  wrangler(["d1", "migrations", "apply", "stai-production"]);
  wrangler(["d1", "execute", "stai-production", "--file", "seeds/0001_verified_corpus.sql"]);

  // The admin account is an operator action on Workers, never a boot-time
  // write. scripts/admin-sql.mjs hashes the password so no plaintext lands in
  // the database or in a file.
  const sqlFile = path.join(stateDir, "admin.sql");
  fs.writeFileSync(
    sqlFile,
    execFileSync("node", ["scripts/admin-sql.mjs", ADMIN_EMAIL, ADMIN_PASSWORD], {
      cwd: ROOT,
      encoding: "utf8",
    })
  );
  wrangler(["d1", "execute", "stai-production", "--file", sqlFile]);
  fs.rmSync(sqlFile);

  server = spawn("npx", ["wrangler", "dev", "--port", String(PORT), "--local", "--persist-to", stateDir], {
    cwd: ROOT,
    stdio: "ignore",
    detached: true,
  });

  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    try {
      if ((await fetch(`${BASE}/api/health`)).ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 1000));
  }

  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  adminCookie = res.headers.getSetCookie()?.find((c) => c.startsWith("stai_session="))?.split(";")[0];
});

after(() => {
  // Kill by port, not by process name: `pkill -f wrangler` also matches the
  // test runner's own command line.
  try {
    if (server?.pid) process.kill(-server.pid, "SIGTERM");
  } catch {}
  try {
    execFileSync("fuser", ["-k", `${PORT}/tcp`], { stdio: "ignore" });
  } catch {}
  if (stateDir) fs.rmSync(stateDir, { recursive: true, force: true });
});

/**
 * `wrangler dev` occasionally drops a connection when requests arrive faster
 * than workerd re-warms — a property of the local dev server, not of the
 * application. Retrying only on a TRANSPORT failure keeps that flakiness out
 * of the results without ever masking an HTTP status: any response at all,
 * including a 500, is returned immediately and asserted on.
 */
async function req(p, init, attempts = 4) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fetch(BASE + p, init);
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 300 * (i + 1)));
    }
  }
  throw new Error(`transport failure after ${attempts} attempts for ${p}: ${lastErr?.message}`);
}

/**
 * Read a response ONCE and return both status and parsed body.
 *
 * A Response body is single-use, so `assert(res.status === 200, await res.text())`
 * followed by `await res.json()` throws "Body has already been read" — and the
 * thrown error replaces the assertion that would have told you what actually
 * went wrong. Every failure in this file's first run was that, not the app.
 */
async function readJson(res) {
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { status: res.status, text, json };
}

const get = (p, cookie) =>
  req(p, { redirect: "manual", headers: cookie ? { Cookie: cookie } : {} });
const post = (p, body, cookie) =>
  req(p, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
    body: JSON.stringify(body),
  });

describe("Workers runtime — it is genuinely D1, not SQLite", { skip }, () => {
  test("health reports the Workers runtime and a reachable D1", async () => {
    const h = await (await get("/api/health")).json();
    assert.equal(h.status, "ok");
    assert.equal(h.runtime, "workers", "must be running as a Worker");
    assert.equal(h.db.driver, "d1", "the D1 driver must be installed, not the Node one");
    assert.equal(h.db.reachable, true);
    assert.equal(h.db.publishedArticles, 11, "and it must be reading the seeded corpus");
  });

  test("the Worker bundle contains no native SQLite", () => {
    const addons = [];
    const walk = (dir) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) walk(full);
        else if (e.name.endsWith(".node")) addons.push(path.relative(ROOT, full));
      }
    };
    walk(path.join(ROOT, ".open-next"));
    assert.deepEqual(addons, [], "Workers cannot load native addons at all");

    const handler = fs.readFileSync(
      path.join(ROOT, ".open-next/server-functions/default/handler.mjs"),
      "utf8"
    );
    for (const forbidden of ["better_sqlite3", "journal_mode", "wal_checkpoint", "litestream"]) {
      assert.ok(!handler.includes(forbidden), `the Worker must not contain ${forbidden}`);
    }
  });

  test("migrations and seed were applied by wrangler, not by the Worker", () => {
    const migrations = d1("SELECT name FROM d1_migrations ORDER BY id").map((r) => r.name);
    assert.deepEqual(migrations, ["0001_initial_schema.sql", "0002_indexes.sql"]);

    const [a] = d1("SELECT COUNT(*) n, SUM(status='published') pub FROM articles");
    assert.equal(a.n, 11);
    assert.equal(a.pub, 11);

    const [p] = d1("SELECT COUNT(*) n, SUM(premium=1) prem, SUM(status='published') pub FROM prompts");
    assert.equal(p.n, 31);
    assert.equal(p.prem, 11);
    assert.equal(p.pub, 31);

    assert.equal(d1("SELECT COUNT(*) n FROM seed_ledger")[0].n, 46);
    assert.equal(d1("SELECT COUNT(*) n FROM podcasts")[0].n, 0, "no fabricated episodes");
    assert.equal(d1("SELECT COUNT(*) n FROM research")[0].n, 0, "no fabricated citations");
  });

  test("the published corpus is exactly the approved slugs", () => {
    const slugs = d1("SELECT slug FROM articles WHERE status='published' ORDER BY slug").map((r) => r.slug);
    assert.deepEqual(slugs, [
      "compliance-stack-converges-nis2-dora-aiact",
      "csrd-assurance-ai-toolkit",
      "dutch-german-regulators-ai-act-divergence",
      "eu-ai-act-reaches-the-audit-file",
      "isa-240-synthetic-evidence",
      "isqm1-ai-inventory",
      "journal-entry-testing-llms",
      "professional-scepticism-system-property",
      "prompt-is-the-new-working-paper",
      "the-junior-problem",
      "vendor-due-diligence-ai-tools-12-questions",
    ]);
  });
});

describe("Workers runtime — public surface", { skip }, () => {
  test("every public route answers 200", async () => {
    const routes = [
      "/", "/briefing", "/prompts", "/ask", "/firms", "/training", "/assessment",
      "/plus", "/podcast", "/research", "/about", "/contact", "/ai-act",
      "/legal/company", "/legal/privacy", "/legal/terms", "/login", "/signup",
      "/authors/stai-editorial", "/sitemap.xml", "/robots.txt", "/feed.xml",
    ];
    for (const r of routes) {
      assert.equal((await get(r)).status, 200, `${r} should be 200`);
    }
  });

  test("every published briefing and prompt answers 200", async () => {
    const map = await (await get("/sitemap.xml")).text();
    const urls = [...new Set((map.match(/\/(briefing|prompts)\/[a-z0-9-]+/g) ?? []))].filter(
      (u) => !u.endsWith("/category")
    );
    assert.ok(urls.length >= 42, `expected the full corpus, saw ${urls.length}`);
    for (const u of urls) {
      assert.equal((await get(u)).status, 200, `${u} should be 200`);
    }
  });

  test("next/og renders real PNGs under Workers", async () => {
    // satori + resvg in WebAssembly. This is the route most likely to need a
    // native dependency, so it is asserted rather than assumed.
    for (const r of ["/opengraph-image", "/briefing/isqm1-ai-inventory/opengraph-image"]) {
      const res = await get(r);
      assert.equal(res.status, 200, `${r} should render`);
      assert.equal(res.headers.get("content-type"), "image/png");
      const bytes = new Uint8Array(await res.arrayBuffer());
      assert.ok(bytes.length > 1000, "a real image, not an error page");
      assert.deepEqual([...bytes.slice(0, 4)], [0x89, 0x50, 0x4e, 0x47], "PNG magic number");
    }
  });
});

describe("Workers runtime — accounts and authorization", { skip }, () => {
  const email = `w-user-${Date.now()}@test.eu`;
  const password = "workers-user-password";
  let cookie;

  test("signup writes to D1 and issues a session", async () => {
    assert.equal((await post("/api/auth/signup", { email, password, name: "W User", firm: "F" })).status, 200);
    const [u] = d1(`SELECT role, plan, password_hash FROM users WHERE email='${email}'`);
    assert.ok(u, "the user row is in D1");
    assert.equal(u.role, "member");
    assert.match(u.password_hash, /^\$2[aby]\$/, "bcrypt runs under Workers");
  });

  test("login, session lookup and logout", async () => {
    assert.equal((await post("/api/auth/login", { email, password: "wrong" })).status, 401);
    const res = await post("/api/auth/login", { email, password });
    assert.equal(res.status, 200);
    cookie = res.headers.getSetCookie().find((c) => c.startsWith("stai_session=")).split(";")[0];

    const account = await get("/account", cookie);
    assert.equal(account.status, 200);
    assert.ok((await account.text()).includes("W User"));

    assert.equal((await post("/api/auth/logout", {}, cookie)).status, 200);
    assert.equal((await get("/account", cookie)).status, 307, "the cookie no longer authenticates");
  });

  test("a member cannot reach /admin; an admin can", async () => {
    const res = await post("/api/auth/login", { email, password });
    const member = res.headers.getSetCookie().find((c) => c.startsWith("stai_session=")).split(";")[0];
    assert.equal((await get("/admin", member)).status, 307);
    assert.equal((await get("/admin", adminCookie)).status, 200);
    assert.equal((await get("/admin/prompts", adminCookie)).status, 200);
    assert.equal((await get("/admin/content", adminCookie)).status, 200);
  });

  test("account deletion cascades in D1 and leaves other accounts intact", async () => {
    const keep = `w-keep-${Date.now()}@test.eu`;
    await post("/api/auth/signup", { email: keep, password, name: "Keep", firm: "F" });
    const keepCookie = (await post("/api/auth/login", { email: keep, password })).headers
      .getSetCookie().find((c) => c.startsWith("stai_session=")).split(";")[0];
    await post("/api/bookmarks", { kind: "article", refId: 1 }, keepCookie);

    const login = await post("/api/auth/login", { email, password });
    const doomed = login.headers.getSetCookie().find((c) => c.startsWith("stai_session=")).split(";")[0];
    await post("/api/bookmarks", { kind: "article", refId: 1 }, doomed);
    await post("/api/newsletter", { email });

    assert.equal((await post("/api/account/delete", { password }, doomed)).status, 200);

    assert.equal(d1(`SELECT COUNT(*) n FROM users WHERE email='${email}'`)[0].n, 0);
    assert.equal(
      d1("SELECT COUNT(*) n FROM bookmarks WHERE user_id NOT IN (SELECT id FROM users)")[0].n,
      0,
      "foreign-key cascade must work on D1"
    );
    assert.equal(
      d1("SELECT COUNT(*) n FROM sessions WHERE user_id NOT IN (SELECT id FROM users)")[0].n,
      0
    );
    assert.equal(
      d1(`SELECT COUNT(*) n FROM newsletter WHERE email='${email}'`)[0].n,
      0,
      "keyed by email, so removed explicitly rather than cascaded"
    );
    assert.equal(d1(`SELECT COUNT(*) n FROM users WHERE email='${keep}'`)[0].n, 1, "unrelated account survives");
    assert.equal(
      d1(`SELECT COUNT(*) n FROM bookmarks WHERE user_id=(SELECT id FROM users WHERE email='${keep}')`)[0].n,
      1,
      "and so does its data — the batch is scoped, not a wipe"
    );
  });
});

describe("Workers runtime — the two CMSes against D1", { skip }, () => {
  const MARKER = "Zarvex";
  let articleId, promptId;

  const saveArticle = (o) =>
    post("/api/admin/article", {
      slug: "w-probe", title: `${MARKER} Protocol Article`, dek: "Probe standfirst.",
      category: "Analysis", tags: "probe", author: "STAI Editorial", author_role: "Editorial desk",
      published_at: "2026-01-01", reading_min: 1, featured: 0, urgency: 1, premium: false,
      body_md: `## ${MARKER} Protocol\n\nThe ${MARKER} Protocol is a unique retrieval marker.`,
      ...o,
    }, adminCookie);

  test("a draft article is invisible everywhere", async () => {
    const { status, text, json } = await readJson(await saveArticle({ status: "draft" }));
    assert.equal(status, 200, text);
    articleId = json.id;

    assert.equal((await get("/briefing/w-probe")).status, 404);
    assert.ok(!(await (await get("/sitemap.xml")).text()).includes("w-probe"));
    const ask = await (await post("/api/ask", { question: `${MARKER} Protocol` })).text();
    assert.ok(!ask.includes("w-probe"), "a draft must never be cited");
  });

  test("publishing makes it public and retrievable", async () => {
    assert.equal((await saveArticle({ id: articleId, status: "published" })).status, 200);
    assert.equal((await get("/briefing/w-probe")).status, 200);
    assert.ok((await (await get("/sitemap.xml")).text()).includes("w-probe"));
    const ask = await (await post("/api/ask", { question: `${MARKER} Protocol` })).text();
    assert.ok(ask.includes("w-probe"), "retrieval must see a newly published article");
  });

  test("an edit is visible to the next retrieval", async () => {
    // A marker that exists only in the NEW body. If the index were stale there
    // would be no match at all.
    await saveArticle({
      id: articleId,
      status: "published",
      body_md: `## ${MARKER} Protocol\n\nQuindalor amendment adds a second clause.`,
    });
    const ask = await (await post("/api/ask", { question: "Quindalor" })).text();
    assert.ok(ask.includes("w-probe"), "retrieval must see the edited body");
  });

  test("unpublishing removes it from every public surface", async () => {
    await saveArticle({ id: articleId, status: "draft" });
    assert.equal((await get("/briefing/w-probe")).status, 404);
    assert.ok(!(await (await get("/sitemap.xml")).text()).includes("w-probe"));
    const ask = await (await post("/api/ask", { question: `${MARKER} Protocol` })).text();
    assert.ok(!ask.includes("w-probe"), "an unpublished article must not be citable");
  });

  test("retrieval freshness is detected without reading article bodies", () => {
    const plan = d1(
      "EXPLAIN QUERY PLAN SELECT COUNT(*) AS n, COALESCE(MAX(updated_at),'') AS edited FROM articles WHERE status='published'"
    )
      .map((r) => r.detail)
      .join(" | ");
    assert.match(plan, /COVERING INDEX/i, `D1 must answer from the index alone — plan was: ${plan}`);
    assert.match(plan, /idx_articles_fingerprint/);
  });

  test("the prompt CMS: draft, publish, gate, unpublish", async () => {
    const savePrompt = (o) =>
      post("/api/admin/prompt", {
        slug: "w-prompt", title: "Workers probe prompt", category: "Tax",
        description: "d", body: "Body {{x}}", variables: "x", model_note: "n",
        premium: false, ...o,
      }, adminCookie);

    const created = await readJson(await savePrompt({ status: "draft" }));
    assert.equal(created.status, 200, created.text);
    promptId = created.json.id;
    assert.equal((await get("/prompts/w-prompt")).status, 404, "a draft prompt is not public");

    await savePrompt({ id: promptId, status: "published" });
    assert.equal((await get("/prompts/w-prompt")).status, 200);

    await savePrompt({ id: promptId, status: "published", premium: true, title: "Gated probe" });
    assert.equal(d1("SELECT premium FROM prompts WHERE slug='w-prompt'")[0].premium, 1, "gating is in D1");

    await savePrompt({ id: promptId, status: "published", premium: false });
    assert.equal(d1("SELECT premium FROM prompts WHERE slug='w-prompt'")[0].premium, 0);

    await savePrompt({ id: promptId, status: "draft" });
    assert.equal((await get("/prompts/w-prompt")).status, 404);
    assert.ok(!(await (await get("/prompts")).text()).includes("Gated probe"));
  });

  test("admin edits live in D1, so they survive anything the isolate forgets", () => {
    // The row is queried through wrangler, a separate process from the Worker.
    // If the edit had only existed in isolate memory it would not be here.
    const [row] = d1("SELECT slug, status FROM prompts WHERE slug='w-prompt'");
    assert.equal(row.status, "draft");
    assert.equal(d1("SELECT COUNT(*) n FROM prompts")[0].n, 32, "31 seeded plus the probe");
  });
});

describe("Workers runtime — capture, analytics and the payment freeze", { skip }, () => {
  test("early access records and updates rather than duplicating", async () => {
    const email = `w-ea-${Date.now()}@test.eu`;
    assert.equal((await post("/api/early-access", { email, role: "Audit partner", interests: ["brief"] })).status, 200);
    assert.equal((await post("/api/early-access", { email, role: "CFO", interests: ["ask"] })).status, 200);
    const [row] = d1(`SELECT COUNT(*) n FROM early_access WHERE email='${email}'`);
    assert.equal(row.n, 1, "a second registration updates the first");
    assert.equal(d1(`SELECT role FROM early_access WHERE email='${email}'`)[0].role, "CFO");
  });

  test("analytics writes to D1 and rejects unknown kinds", async () => {
    const before = d1("SELECT COUNT(*) n FROM events")[0].n;
    assert.equal((await post("/api/track", { kind: "page_view", path: "/briefing" })).status, 200);
    assert.ok(d1("SELECT COUNT(*) n FROM events")[0].n > before);
    assert.equal((await post("/api/track", { kind: "evil", path: "/x" })).status, 400);
    assert.equal((await post("/api/track", { kind: "page_view", path: "https://evil.com" })).status, 400);
  });

  test("analytics still stores nothing identifying", () => {
    const cols = d1("PRAGMA table_info(events)").map((r) => r.name);
    for (const forbidden of ["ip", "ip_address", "user_agent", "user_id", "referrer", "fingerprint"]) {
      assert.ok(!cols.includes(forbidden), `events must not carry ${forbidden}`);
    }
  });

  test("the Brief waitlist records without a mail provider and without crashing", async () => {
    const email = `w-brief-${Date.now()}@test.eu`;
    assert.equal((await post("/api/newsletter", { email })).status, 200);
    assert.equal(d1(`SELECT COUNT(*) n FROM newsletter WHERE email='${email}'`)[0].n, 1);
    assert.equal(
      d1(`SELECT COUNT(*) n FROM outbox WHERE to_email='${email}'`)[0].n,
      0,
      "no mail may be queued for a waitlist that cannot send"
    );
  });

  test("payments stay frozen and cannot be reached", async () => {
    assert.equal((await post("/api/checkout/sandbox", { plan: "founding" })).status, 404);
    assert.equal((await get("/checkout/sandbox")).status, 404);
    assert.equal((await post("/api/stripe/webhook", {})).status, 501);

    const plus = await (await get("/plus")).text();
    assert.ok(plus.includes("Early access"), "/plus offers a waitlist");
    assert.ok(!/Start monthly|Claim seat/.test(plus), "and no purchase path");

    assert.equal(d1("SELECT COUNT(*) n FROM subscriptions")[0].n, 0, "nothing was ever activated");
    assert.equal(d1("SELECT value FROM settings WHERE key='founding_claimed'")[0].value, "0");
  });

  test("the Stripe SDK loads under Workers on a live free-launch route", async () => {
    // /api/account/delete imports stripe-client.ts at module scope. If the
    // Stripe package could not load on workerd, GDPR erasure — a route that
    // has nothing to do with payments — would 500. It answered 200 in the
    // deletion test above; here we confirm the module boundary directly.
    const src = fs.readFileSync(path.join(ROOT, "src/app/api/account/delete/route.ts"), "utf8");
    assert.match(src, /from "@\/lib\/stripe-client"/);
    const res = await post("/api/account/delete", {});
    assert.equal(res.status, 401, "it runs and refuses cleanly rather than failing to load");
  });
});
