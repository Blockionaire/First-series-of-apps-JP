/**
 * Prompt Library CMS.
 *
 * Boots the real production server against a throwaway data directory, drives
 * the real admin API with a real admin session, and then FORCES A RE-SEED by
 * resetting seed_version and restarting — which is the only honest way to
 * prove the claim that matters: a redeployment cannot undo an editor's work.
 *
 * Nothing here restates production SQL. The invariants are asserted against
 * the database the application actually wrote.
 */
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import Database from "better-sqlite3";
import fs from "fs";
import os from "os";
import path from "path";

const PORT = Number(process.env.PROMPT_TEST_PORT ?? 3198);
const BASE = `http://127.0.0.1:${PORT}`;
const ROOT = path.resolve(import.meta.dirname, "..");
const STANDALONE = path.join(ROOT, ".next/standalone/server.js");
const hasBuild = fs.existsSync(STANDALONE);

const ADMIN_EMAIL = "prompt-cms-admin@test.eu";
const ADMIN_PASSWORD = "prompt-cms-admin-password";

/** The seeded library, as shipped. Both numbers are load-bearing in the tests. */
const SEEDED_PROMPTS = 31;
const SEEDED_PREMIUM = 11;

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

async function stopServer() {
  if (!server) return;
  const exited = new Promise((r) => server.once("exit", r));
  server.kill("SIGTERM");
  await Promise.race([exited, new Promise((r) => setTimeout(r, 10_000))]);
  server = null;
}

async function login() {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  assert.equal(res.status, 200, "admin login should succeed");
  const set = res.headers.getSetCookie();
  const session = set.find((c) => c.startsWith("stai_session="));
  assert.ok(session, "a session cookie should be issued");
  return session.split(";")[0];
}

/** POST to the real admin prompt endpoint as the signed-in admin. */
async function savePrompt(payload) {
  const res = await fetch(`${BASE}/api/admin/prompt`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify(payload),
  });
  return { status: res.status, json: await res.json().catch(() => ({})) };
}

const open = () => new Database(path.join(dataDir, "stai.db"), { readonly: true });
const readRow = (slug) => {
  const d = open();
  const r = d.prepare("SELECT * FROM prompts WHERE slug=?").get(slug);
  d.close();
  return r;
};

before(async () => {
  if (!hasBuild) return;
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "stai-prompts-"));
  server = startServer();
  await waitHealthy();
  cookie = await login();
});

after(async () => {
  await stopServer();
  if (dataDir) fs.rmSync(dataDir, { recursive: true, force: true });
});

const skip = hasBuild ? false : "no standalone build";

describe("prompt library — schema and seeded corpus", { skip }, () => {
  test("prompts carry a draft/published status and an edit timestamp", () => {
    const d = open();
    const cols = d.prepare("PRAGMA table_info(prompts)").all();
    d.close();
    const status = cols.find((c) => c.name === "status");
    assert.ok(status, "prompts.status must exist");
    assert.equal(status.notnull, 1, "status must be NOT NULL");
    assert.match(String(status.dflt_value), /published/, "existing prompts must stay visible by default");
    assert.ok(cols.some((c) => c.name === "updated_at"), "prompts.updated_at must exist");
  });

  test("the migration preserves the whole seeded library, published", () => {
    const d = open();
    const total = d.prepare("SELECT COUNT(*) AS n FROM prompts").get().n;
    const published = d.prepare("SELECT COUNT(*) AS n FROM prompts WHERE status='published'").get().n;
    d.close();
    assert.equal(total, SEEDED_PROMPTS, `all ${SEEDED_PROMPTS} seeded prompts must survive`);
    assert.equal(published, SEEDED_PROMPTS, "and none may be silently unpublished by the migration");
  });

  test("the free / STAI+ split is exactly what was launched with", () => {
    const d = open();
    const premium = d.prepare("SELECT COUNT(*) AS n FROM prompts WHERE premium=1").get().n;
    const lockedCategories = d
      .prepare(
        "SELECT category FROM prompts GROUP BY category HAVING SUM(premium=0 AND status='published')=0"
      )
      .all();
    d.close();
    assert.equal(premium, SEEDED_PREMIUM, `${SEEDED_PREMIUM} prompts stay behind the gate`);
    assert.deepEqual(lockedCategories, [], "every category must keep at least one open prompt");
  });

  test("public prompt reads filter drafts at the data layer", () => {
    const src = fs.readFileSync(path.join(ROOT, "src/lib/content.ts"), "utf8");
    const all = src.match(/export function allPrompts[\s\S]*?\n}/)[0];
    const one = src.match(/export function promptBySlug[\s\S]*?\n}/)[0];
    assert.match(all, /status\s*=\s*'published'/, "allPrompts must exclude drafts");
    assert.match(one, /status\s*=\s*'published'/, "promptBySlug must exclude drafts");
  });
});

describe("prompt library — admin workflow", { skip }, () => {
  const SLUG = "cms-probe-prompt";

  test("every admin prompt page renders for a signed-in admin", async () => {
    // A 307 for anonymous visitors says nothing about whether the page works.
    // /admin/prompts/new returned a 500 until blankPrompt() was moved out of a
    // "use client" module, and only a real authenticated render catches that.
    const pages = [
      "/admin",
      "/admin/prompts",
      "/admin/prompts?q=fraud&st=published",
      "/admin/prompts?cat=Tax",
      "/admin/prompts/new",
      "/admin/prompts/1",
    ];
    for (const p of pages) {
      const res = await fetch(BASE + p, { headers: { Cookie: cookie } });
      assert.equal(res.status, 200, `${p} should render for an admin`);
    }
    const missing = await fetch(`${BASE}/admin/prompts/999999`, { headers: { Cookie: cookie } });
    assert.equal(missing.status, 404, "an unknown id is a 404, not a crash");

    const nav = await (await fetch(`${BASE}/admin`, { headers: { Cookie: cookie } })).text();
    assert.ok(nav.includes("/admin/prompts"), "the back office links to the prompt library");
  });

  test("an admin can create a prompt, and it starts as a draft", async () => {
    const { status, json } = await savePrompt({
      slug: SLUG,
      title: "CMS probe prompt",
      category: "Risk & Planning",
      description: "A prompt created through the admin API during tests.",
      body: "Probe body for {{client_description}}.",
      variables: "client_description",
      model_note: "Probe.",
      premium: false,
      status: "draft",
    });
    assert.equal(status, 200, JSON.stringify(json));
    assert.equal(json.status, "draft");
    const row = readRow(SLUG);
    assert.ok(row, "the prompt is persisted");
    assert.equal(row.status, "draft");
    assert.deepEqual(JSON.parse(row.variables), ["client_description"]);
    assert.ok(row.updated_at, "an edit timestamp is recorded");
  });

  test("a draft prompt is invisible on every public surface", async () => {
    const list = await (await fetch(`${BASE}/prompts`)).text();
    const page = await fetch(`${BASE}/prompts/${SLUG}`);
    const map = await (await fetch(`${BASE}/sitemap.xml`)).text();
    assert.ok(!list.includes("CMS probe prompt"), "absent from the library index");
    assert.equal(page.status, 404, "its own page must 404");
    assert.ok(!map.includes(`/prompts/${SLUG}`), "absent from the sitemap");
  });

  test("adapt-with-AI resolves prompts through the draft-filtered reader", async () => {
    // Entitlement is frozen for the free launch, so this endpoint refuses
    // everyone before it ever looks a prompt up — which means the runtime
    // status alone proves nothing about drafts. What does prove it is that
    // the route's ONLY way of finding a prompt is promptBySlug(), the reader
    // that excludes drafts (asserted directly in the schema suite above).
    const src = fs.readFileSync(path.join(ROOT, "src/app/api/adapt/route.ts"), "utf8");
    assert.match(src, /promptBySlug\(/, "the route resolves prompts through the filtered reader");
    assert.ok(!/FROM\s+prompts/i.test(src), "and never queries the prompts table directly");

    const res = await fetch(`${BASE}/api/adapt`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ slug: SLUG, situation: "probe" }),
    });
    assert.ok(res.status !== 200, `a draft must not be adaptable (got ${res.status})`);
    assert.ok(!(await res.text()).includes("Probe body"), "no draft text may leak in the response");
  });

  test("publishing puts it on every public surface at once", async () => {
    const row = readRow(SLUG);
    const { status } = await savePrompt({
      id: row.id,
      slug: SLUG,
      title: "CMS probe prompt",
      category: "Risk & Planning",
      description: "A prompt created through the admin API during tests.",
      body: "Probe body for {{client_description}}.",
      variables: "client_description",
      model_note: "Probe.",
      premium: false,
      status: "published",
    });
    assert.equal(status, 200);
    const list = await (await fetch(`${BASE}/prompts`)).text();
    const page = await fetch(`${BASE}/prompts/${SLUG}`);
    const map = await (await fetch(`${BASE}/sitemap.xml`)).text();
    assert.ok(list.includes("CMS probe prompt"), "listed in the library");
    assert.equal(page.status, 200, "its page is live");
    assert.ok(map.includes(`/prompts/${SLUG}`), "listed in the sitemap");
  });

  test("unpublishing hides it again and keeps the row", async () => {
    const row = readRow(SLUG);
    const { status } = await savePrompt({
      id: row.id,
      slug: SLUG,
      title: "CMS probe prompt",
      category: "Risk & Planning",
      description: "A prompt created through the admin API during tests.",
      body: "Probe body for {{client_description}}.",
      variables: "client_description",
      model_note: "Probe.",
      premium: false,
      status: "draft",
    });
    assert.equal(status, 200);
    assert.equal((await fetch(`${BASE}/prompts/${SLUG}`)).status, 404, "off the public site");
    const after = readRow(SLUG);
    assert.ok(after, "the row is retained — unpublish is not delete");
    assert.equal(after.body, row.body, "and the text is untouched");
  });

  test("free / STAI+ gating is taken from the database, not the gating file", async () => {
    // engagement-risk-brainstorm ships free and is NOT in PREMIUM_PROMPT_SLUGS.
    const before = readRow("engagement-risk-brainstorm");
    assert.equal(before.premium, 0, "precondition: this prompt ships free");
    const { status } = await savePrompt({
      id: before.id,
      slug: before.slug,
      title: before.title,
      category: before.category,
      description: before.description,
      body: before.body,
      variables: JSON.parse(before.variables).join(", "),
      model_note: before.model_note,
      premium: true,
      status: "published",
    });
    assert.equal(status, 200);
    assert.equal(readRow("engagement-risk-brainstorm").premium, 1, "the database decides gating");

    const gating = fs.readFileSync(path.join(ROOT, "src/lib/seed/gating.ts"), "utf8");
    assert.ok(
      !gating.includes("engagement-risk-brainstorm"),
      "and the source-of-truth file was not edited to achieve it"
    );
  });

  test("the admin prompt API offers no way to delete a prompt", () => {
    const src = fs.readFileSync(path.join(ROOT, "src/app/api/admin/prompt/route.ts"), "utf8");
    assert.ok(!/export\s+(async\s+)?function\s+DELETE/.test(src), "no DELETE handler");
    assert.ok(!/DELETE\s+FROM\s+prompts/i.test(src), "no delete statement");
  });

  test("the admin prompt API rejects anonymous and non-admin callers", async () => {
    const anon = await fetch(`${BASE}/api/admin/prompt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: "hostile", title: "x", category: "x", description: "x", body: "x" }),
    });
    assert.equal(anon.status, 403, "anonymous callers are refused");

    const email = `member-${Date.now()}@test.eu`;
    const signup = await fetch(`${BASE}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: "member-password-123", name: "Member", firm: "Test" }),
    });
    assert.equal(signup.status, 200);
    const memberCookie = signup.headers.getSetCookie().find((c) => c.startsWith("stai_session="));
    const member = await fetch(`${BASE}/api/admin/prompt`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: memberCookie.split(";")[0] },
      body: JSON.stringify({ slug: "hostile", title: "x", category: "x", description: "x", body: "x" }),
    });
    assert.equal(member.status, 403, "signed-in non-admins are refused");
    assert.equal(readRow("hostile"), undefined, "and nothing was written");

    const page = await fetch(`${BASE}/admin/prompts`, { redirect: "manual" });
    assert.equal(page.status, 307, "the admin page redirects anonymous visitors to login");
  });

  test("prompts stay out of the Ask STAI index, or the CMS must invalidate it", () => {
    const search = fs.readFileSync(path.join(ROOT, "src/lib/search.ts"), "utf8");
    const route = fs.readFileSync(path.join(ROOT, "src/app/api/admin/prompt/route.ts"), "utf8");
    const indexesPrompts = /allPrompts|FROM prompts/.test(search);
    if (indexesPrompts) {
      assert.match(
        route,
        /invalidateSearchIndex\(\)/,
        "search.ts now indexes prompts, so saving a prompt must invalidate the index"
      );
    } else {
      assert.ok(true, "prompts do not participate in retrieval, so no invalidation is owed");
    }
  });
});

describe("prompt library — a redeployment cannot undo editorial work", { skip }, () => {
  const RENAMED = "engagement-risk-brainstorm-renamed";
  let beforeReseed;

  before(async () => {
    // Make the three kinds of edit a redeploy could plausibly trample:
    // a rewrite, a gating change (already made above), and an unpublish —
    // plus a slug rename, which is what frees a seeded slug for re-insertion.
    const original = readRow("engagement-risk-brainstorm");
    await savePrompt({
      id: original.id,
      slug: RENAMED,
      title: "Renamed by the editor",
      category: original.category,
      description: "Rewritten by the editor.",
      body: "Editor's replacement body.",
      variables: "client_description",
      model_note: original.model_note,
      premium: true, // set in the previous describe; must survive
      status: "published",
    });

    const toDraft = readRow("whistleblower-triage");
    await savePrompt({
      id: toDraft.id,
      slug: toDraft.slug,
      title: toDraft.title,
      category: toDraft.category,
      description: toDraft.description,
      body: toDraft.body,
      variables: JSON.parse(toDraft.variables).join(", "),
      model_note: toDraft.model_note,
      premium: !!toDraft.premium,
      status: "draft",
    });

    const d = open();
    beforeReseed = {
      count: d.prepare("SELECT COUNT(*) AS n FROM prompts").get().n,
      seedVersion: d.prepare("SELECT value FROM settings WHERE key='seed_version'").get().value,
    };
    d.close();

    // Force the seed to run again on the next boot — the strongest available
    // stand-in for "someone bumped SEED_VERSION and redeployed".
    await stopServer();
    const w = new Database(path.join(dataDir, "stai.db"));
    w.prepare("UPDATE settings SET value='0' WHERE key='seed_version'").run();
    w.close();

    server = startServer();
    await waitHealthy();
  });

  test("the seed actually ran again", () => {
    const d = open();
    const v = d.prepare("SELECT value FROM settings WHERE key='seed_version'").get().value;
    d.close();
    assert.equal(v, beforeReseed.seedVersion, "seed_version is back to the shipped value");
  });

  test("a re-seed does not overwrite admin edits", () => {
    const row = readRow(RENAMED);
    assert.ok(row, "the renamed prompt is still there");
    assert.equal(row.title, "Renamed by the editor");
    assert.equal(row.body, "Editor's replacement body.");
    assert.equal(row.description, "Rewritten by the editor.");
  });

  test("a re-seed does not reset premium / free", () => {
    assert.equal(readRow(RENAMED).premium, 1, "an editor's gating decision stands");
  });

  test("a re-seed does not republish an unpublished prompt", async () => {
    assert.equal(readRow("whistleblower-triage").status, "draft", "still a draft in the database");
    assert.equal(
      (await fetch(`${BASE}/prompts/whistleblower-triage`)).status,
      404,
      "and still off the public site"
    );
  });

  test("a re-seed creates no duplicates, even for a freed slug", () => {
    const d = open();
    const count = d.prepare("SELECT COUNT(*) AS n FROM prompts").get().n;
    const dupes = d.prepare("SELECT slug, COUNT(*) AS n FROM prompts GROUP BY slug HAVING n > 1").all();
    const resurrected = d.prepare("SELECT 1 FROM prompts WHERE slug='engagement-risk-brainstorm'").get();
    d.close();
    assert.equal(count, beforeReseed.count, "the row count is unchanged");
    assert.deepEqual(dupes, [], "no slug appears twice");
    assert.equal(resurrected, undefined, "the renamed prompt's old slug is not re-inserted");
  });

  test("the library is still serving after the re-seed", async () => {
    const res = await fetch(`${BASE}/prompts`);
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.ok(html.includes("Renamed by the editor"), "the edited prompt is the one on the shelf");
  });
});
