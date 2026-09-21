/**
 * Site settings: switches, sections and limits.
 *
 * The claim worth testing is not "the link disappeared" — it is that a
 * switched-off page is actually unreachable. Hiding a link and leaving the
 * route open is the failure this feature exists to prevent, and it is
 * invisible from the navigation, so every assertion here fetches the URL.
 *
 * Everything runs against the real server with a real admin session, flipping
 * switches through the real API rather than writing rows behind its back.
 */
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import Database from "better-sqlite3";
import fs from "fs";
import os from "os";
import path from "path";

const PORT = Number(process.env.SETTINGS_TEST_PORT ?? 3207);
const BASE = `http://127.0.0.1:${PORT}`;
const ROOT = path.resolve(import.meta.dirname, "..");
const STANDALONE = path.join(ROOT, ".next/standalone/server.js");
const hasBuild = fs.existsSync(STANDALONE);

const ADMIN_EMAIL = "settings-admin@test.eu";
const ADMIN_PASSWORD = "settings-admin-password";

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

async function login() {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  assert.equal(res.status, 200, "admin login should succeed");
  return res.headers.getSetCookie().find((c) => c.startsWith("stai_session=")).split(";")[0];
}

/** Flip switches through the real admin API. */
async function saveSettings(values) {
  const res = await fetch(`${BASE}/api/admin/settings`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ values }),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

const get = (p) => fetch(BASE + p, { redirect: "manual" });
const db = () => new Database(path.join(dataDir, "stai.db"), { readonly: true });

before(async () => {
  if (!hasBuild) return;
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "stai-settings-"));
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

describe("site settings — switching a page off", { skip }, () => {
  test("Ask STAI ships off, and that means 404 rather than hidden", async () => {
    // The shipped default for this one is off — it is not ready for readers.
    assert.equal((await get("/ask")).status, 404, "/ask should not exist while it is switched off");

    const home = await (await get("/")).text();
    assert.ok(!home.includes('href="/ask"'), "nothing should link to a page that 404s");
  });

  test("switching a page off closes the route, the nav and the sitemap together", async () => {
    // On first: prove the page is reachable, so the later 404 means something.
    await saveSettings({ "page.prompts.enabled": "1" });
    assert.equal((await get("/prompts")).status, 200, "prompts should be open to begin with");
    assert.match(await (await get("/sitemap.xml")).text(), /\/prompts</);

    const { status } = await saveSettings({ "page.prompts.enabled": "0" });
    assert.equal(status, 200);

    assert.equal((await get("/prompts")).status, 404, "the index must 404");
    const sitemap = await (await get("/sitemap.xml")).text();
    assert.ok(!/\/prompts/.test(sitemap), "a 404 page must not stay in the sitemap");
    const home = await (await get("/")).text();
    assert.ok(!home.includes('href="/prompts"'), "the navigation must drop it too");

    await saveSettings({ "page.prompts.enabled": "1" });
    assert.equal((await get("/prompts")).status, 200, "and switching it back on reopens it");
  });

  test("a switched-off section takes its child pages with it", async () => {
    const slug = await (async () => {
      const d = db();
      const row = d.prepare("SELECT slug FROM prompts WHERE status='published' LIMIT 1").get();
      d.close();
      return row?.slug;
    })();
    assert.ok(slug, "the seed should have published prompts");

    assert.equal((await get(`/prompts/${slug}`)).status, 200);
    await saveSettings({ "page.prompts.enabled": "0" });
    assert.equal((await get(`/prompts/${slug}`)).status, 404, "a child page must close with its section");
    await saveSettings({ "page.prompts.enabled": "1" });
  });
});

describe("site settings — sections and the old index", { skip }, () => {
  test("/briefing sends readers to /news without losing the article pages", async () => {
    const res = await get("/briefing");
    assert.equal(res.status, 308, "a permanent redirect, so crawlers move their index across");
    assert.equal(res.headers.get("location"), "/news");

    const d = db();
    const slug = d.prepare("SELECT slug FROM articles WHERE status='published' LIMIT 1").get()?.slug;
    d.close();
    assert.ok(slug);
    assert.equal(
      (await get(`/briefing/${slug}`)).status,
      200,
      "articles keep their address — only the index moved"
    );
  });

  test("News and Insights are the same corpus split by kind", async () => {
    const d = db();
    const slug = d.prepare("SELECT slug FROM articles WHERE status='published' LIMIT 1").get().slug;
    // Every seeded piece defaults to news, so it starts on /news.
    d.close();

    // Asserted through each page's empty state rather than by searching the
    // HTML for the slug: Next serialises the route's not-found boundary into
    // the payload of every segment, and that boundary lists recent articles —
    // so a slug "appears" on a page that never rendered it.
    const INSIGHTS_EMPTY = "No pieces are filed under Insights yet";
    const NEWS_EMPTY = "Nothing published in this section yet";

    assert.match(await (await get("/news")).text(), new RegExp(slug), "the piece is on News");
    assert.ok(
      !(await (await get("/news")).text()).includes(NEWS_EMPTY),
      "News should not be showing its empty state"
    );
    assert.ok(
      (await (await get("/insights")).text()).includes(INSIGHTS_EMPTY),
      "Insights should be empty before anything is filed there"
    );

    // Re-file it through the real admin API and watch it move.
    const d2 = db();
    const row = d2
      .prepare("SELECT * FROM articles WHERE slug=?")
      .get(slug);
    d2.close();
    const res = await fetch(`${BASE}/api/admin/article`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ ...row, premium: !!row.premium, tags: "", kind: "insight" }),
    });
    assert.equal(res.status, 200, await res.text());

    const insights = await (await get("/insights")).text();
    assert.ok(!insights.includes(INSIGHTS_EMPTY), "Insights is no longer empty");
    assert.match(insights, new RegExp(slug), "and the piece it now holds is the one that moved");
    assert.equal(
      (await get(`/briefing/${slug}`)).status,
      200,
      "and re-filing must not change its address"
    );
  });
});

describe("site settings — limits actually bind", { skip }, () => {
  test("the signed-out Ask quota comes from settings, not a constant", async () => {
    await saveSettings({ "page.ask.enabled": "1", "limit.ask.anon": "0" });

    const res = await fetch(`${BASE}/api/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: "What does ISQM 1 require for AI tools?" }),
    });
    assert.equal(res.status, 402, "a quota of zero must refuse the first question");

    await saveSettings({ "limit.ask.anon": "2" });
    const ok = await fetch(`${BASE}/api/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: "What does ISQM 1 require for AI tools?" }),
    });
    assert.equal(ok.status, 200, "and raising it lets the question through");
    await saveSettings({ "page.ask.enabled": "0" });
  });

  test("a value outside its range is clamped, not stored", async () => {
    await saveSettings({ "limit.ask.free": "999999" });
    const d = db();
    const stored = d.prepare("SELECT value FROM settings WHERE key='limit.ask.free'").get().value;
    d.close();
    assert.equal(stored, "200", "clamped to the declared maximum on the way in");
    await saveSettings({ "limit.ask.free": "5" });
  });
});

describe("site settings — who may write them", { skip }, () => {
  test("anonymous callers cannot change the site", async () => {
    const res = await fetch(`${BASE}/api/admin/settings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ values: { "page.prompts.enabled": "0" } }),
    });
    assert.equal(res.status, 403);
    assert.equal((await get("/prompts")).status, 200, "and nothing changed");
  });

  test("only declared keys are writable", async () => {
    // founding_claimed lives in the same table and is tied to paid seats.
    const before = (() => {
      const d = db();
      const v = d.prepare("SELECT value FROM settings WHERE key='founding_claimed'").get()?.value;
      d.close();
      return v;
    })();

    const { json } = await saveSettings({ founding_claimed: "199", "page.prompts.enabled": "1" });
    assert.deepEqual(json.rejected, ["founding_claimed"], "the unknown key is named and refused");
    assert.equal(json.written, 1, "only the declared key was written");

    const after = (() => {
      const d = db();
      const v = d.prepare("SELECT value FROM settings WHERE key='founding_claimed'").get()?.value;
      d.close();
      return v;
    })();
    assert.equal(after, before, "the seat count is untouched");
  });
});
