/**
 * Every free-launch write path, exercised end to end through the async seam.
 *
 * Phase 0 converted 116 query sites to an async interface and Phase 2 put a
 * D1-shaped contract behind it. These tests drive the real routes against the
 * real production server so that "the seam preserves behaviour" is a measured
 * fact rather than a claim — signup through to session expiry, both content
 * editors, the waitlists, and analytics.
 *
 * Deliberately NOT here: anything that mutates payment state. That code is
 * frozen and quarantined (see PAID_LAUNCH_BACKLOG.md §0).
 */
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import Database from "better-sqlite3";
import fs from "fs";
import os from "os";
import path from "path";

const ROOT = path.resolve(import.meta.dirname, "..");
const STANDALONE = path.join(ROOT, ".next/standalone/server.js");
const hasBuild = fs.existsSync(STANDALONE);
const skip = hasBuild ? false : "no standalone build";

const PORT = Number(process.env.WRITES_TEST_PORT ?? 3203);
const BASE = `http://127.0.0.1:${PORT}`;
const ADMIN_EMAIL = "writes-admin@test.eu";
const ADMIN_PASSWORD = "writes-admin-password";

let dataDir, server, adminCookie;

before(async () => {
  if (!hasBuild) return;
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "stai-writes-"));
  server = spawn("node", [STANDALONE], {
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
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    try {
      if ((await fetch(`${BASE}/api/health`)).ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 400));
  }
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  adminCookie = res.headers.getSetCookie().find((c) => c.startsWith("stai_session=")).split(";")[0];
});

after(() => {
  server?.kill("SIGTERM");
  if (dataDir) fs.rmSync(dataDir, { recursive: true, force: true });
});

const open = () => new Database(path.join(dataDir, "stai.db"), { readonly: true });
const one = (sql, ...p) => {
  const d = open();
  const r = d.prepare(sql).get(...p);
  d.close();
  return r;
};
const post = (p, body, cookie) =>
  fetch(BASE + p, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
    body: JSON.stringify(body),
  });

describe("[9] accounts and sessions through the seam", { skip }, () => {
  const email = `seam-user-${Date.now()}@test.eu`;
  const password = "seam-user-password";
  let cookie;

  test("signup creates the account and issues a session", async () => {
    const res = await post("/api/auth/signup", { email, password, name: "Seam User", firm: "Test" });
    assert.equal(res.status, 200, await res.text());
    cookie = res.headers.getSetCookie().find((c) => c.startsWith("stai_session=")).split(";")[0];
    assert.ok(cookie, "a session cookie is issued");

    const user = one("SELECT * FROM users WHERE email=?", email);
    assert.ok(user, "the user row is persisted");
    assert.equal(user.role, "member");
    assert.equal(user.plan, "free");
    assert.notEqual(user.password_hash, password, "the password is hashed, never stored");
    assert.match(user.password_hash, /^\$2[aby]\$/, "bcrypt hash format");

    assert.ok(one("SELECT * FROM sessions WHERE user_id=?", user.id), "the session row is persisted");
  });

  test("the session identifies the user on a later request", async () => {
    const res = await fetch(`${BASE}/account`, { headers: { Cookie: cookie }, redirect: "manual" });
    assert.equal(res.status, 200, "an authenticated reader reaches /account");
    assert.ok((await res.text()).includes("Seam User"), "and is recognised");
  });

  test("logout clears the session row and the cookie", async () => {
    const res = await post("/api/auth/logout", {}, cookie);
    assert.equal(res.status, 200);
    const token = cookie.split("=")[1];
    assert.equal(one("SELECT * FROM sessions WHERE token=?", token), undefined, "row deleted");
    const after = await fetch(`${BASE}/account`, { headers: { Cookie: cookie }, redirect: "manual" });
    assert.equal(after.status, 307, "the cookie no longer authenticates");
  });

  test("login re-authenticates, and a wrong password does not", async () => {
    const bad = await post("/api/auth/login", { email, password: "wrong-password" });
    assert.equal(bad.status, 401);

    const good = await post("/api/auth/login", { email, password });
    assert.equal(good.status, 200);
    cookie = good.headers.getSetCookie().find((c) => c.startsWith("stai_session=")).split(";")[0];
  });

  test("an expired session does not authenticate", async () => {
    // Expiry is enforced in SQL (`expires_at > datetime('now')`), so backdating
    // the row is the honest way to test it.
    const token = cookie.split("=")[1];
    const w = new Database(path.join(dataDir, "stai.db"));
    w.prepare("UPDATE sessions SET expires_at=datetime('now','-1 day') WHERE token=?").run(token);
    w.close();
    const res = await fetch(`${BASE}/account`, { headers: { Cookie: cookie }, redirect: "manual" });
    assert.equal(res.status, 307, "an expired session is not a session");
  });

  test("admin authorization is by role, not by having an account", async () => {
    const memberLogin = await post("/api/auth/login", { email, password });
    const memberCookie = memberLogin.headers
      .getSetCookie()
      .find((c) => c.startsWith("stai_session="))
      .split(";")[0];

    const asMember = await fetch(`${BASE}/admin`, { headers: { Cookie: memberCookie }, redirect: "manual" });
    assert.equal(asMember.status, 307, "a signed-in member is not an admin");

    const asAdmin = await fetch(`${BASE}/admin`, { headers: { Cookie: adminCookie } });
    assert.equal(asAdmin.status, 200);
  });

  test("account deletion erases the account and everything keyed to it", async () => {
    const login = await post("/api/auth/login", { email, password });
    const c = login.headers.getSetCookie().find((x) => x.startsWith("stai_session=")).split(";")[0];
    const user = one("SELECT * FROM users WHERE email=?", email);

    await post("/api/newsletter", { email });
    assert.ok(one("SELECT * FROM newsletter WHERE email=?", email), "something to erase");

    const res = await post("/api/account/delete", { password }, c);
    assert.equal(res.status, 200, await res.text());

    assert.equal(one("SELECT * FROM users WHERE id=?", user.id), undefined, "user gone");
    assert.equal(one("SELECT * FROM sessions WHERE user_id=?", user.id), undefined, "sessions cascade");
    assert.equal(
      one("SELECT * FROM newsletter WHERE email=?", email),
      undefined,
      "the newsletter row is keyed by email and must be removed explicitly"
    );
  });
});

describe("[10][11] admin editors write through the seam", { skip }, () => {
  test("an admin can create and then edit an article", async () => {
    const create = await post(
      "/api/admin/article",
      {
        slug: "writes-article", title: "Writes article", dek: "d", category: "News", tags: "a,b",
        author: "STAI Editorial", author_role: "Editorial desk", published_at: "2026-01-01",
        reading_min: 1, featured: 0, urgency: 1, premium: false, status: "published", body_md: "First body.",
      },
      adminCookie
    );
    const createBody = await create.text(); // a Response body is single-use
    assert.equal(create.status, 200, createBody);
    const { id } = JSON.parse(createBody);

    let row = one("SELECT * FROM articles WHERE id=?", id);
    assert.equal(row.title, "Writes article");
    assert.equal(row.body_md, "First body.");
    assert.deepEqual(JSON.parse(row.tags), ["a", "b"], "tags round-trip as JSON");

    const edit = await post(
      "/api/admin/article",
      {
        id, slug: "writes-article", title: "Writes article, revised", dek: "d2", category: "Analysis",
        tags: "c", author: "STAI Editorial", author_role: "Editorial desk", published_at: "2026-01-02",
        reading_min: 2, featured: 0, urgency: 2, premium: false, status: "published", body_md: "Second body.",
      },
      adminCookie
    );
    assert.equal(edit.status, 200);
    row = one("SELECT * FROM articles WHERE id=?", id);
    assert.equal(row.title, "Writes article, revised");
    assert.equal(row.body_md, "Second body.");
    assert.equal(one("SELECT COUNT(*) AS n FROM articles WHERE slug='writes-article'").n, 1, "edited, not duplicated");
  });

  test("an admin can create and then edit a prompt", async () => {
    const create = await post(
      "/api/admin/prompt",
      {
        slug: "writes-prompt", title: "Writes prompt", category: "Tax", description: "d",
        body: "Body with {{x}}.", variables: "x", model_note: "n", premium: false, status: "published",
      },
      adminCookie
    );
    const createBody = await create.text(); // a Response body is single-use
    assert.equal(create.status, 200, createBody);
    const { id } = JSON.parse(createBody);

    let row = one("SELECT * FROM prompts WHERE id=?", id);
    assert.equal(row.title, "Writes prompt");
    assert.deepEqual(JSON.parse(row.variables), ["x"]);
    assert.equal(row.premium, 0);

    const edit = await post(
      "/api/admin/prompt",
      {
        id, slug: "writes-prompt", title: "Writes prompt, gated", category: "Tax", description: "d2",
        body: "Rewritten {{y}}.", variables: "y", model_note: "n2", premium: true, status: "draft",
      },
      adminCookie
    );
    assert.equal(edit.status, 200);
    row = one("SELECT * FROM prompts WHERE id=?", id);
    assert.equal(row.title, "Writes prompt, gated");
    assert.equal(row.premium, 1, "gating is written to the database");
    assert.equal(row.status, "draft");
    assert.equal((await fetch(`${BASE}/prompts/writes-prompt`)).status, 404, "and the draft is off the site");
  });

  test("a duplicate slug is refused rather than silently overwriting", async () => {
    const res = await post(
      "/api/admin/prompt",
      { slug: "writes-prompt", title: "Clash", category: "Tax", description: "d", body: "b" },
      adminCookie
    );
    assert.equal(res.status, 409);
  });
});

describe("[12][13] capture and analytics write through the seam", { skip }, () => {
  test("early access records a registration and its interests", async () => {
    const email = `ea-${Date.now()}@test.eu`;
    const res = await post("/api/early-access", {
      email, name: "Ea Tester", firm: "Firm", role: "Audit partner",
      interests: ["brief", "prompts"], note: "A note.",
    });
    assert.equal(res.status, 200, await res.text());
    const row = one("SELECT * FROM early_access WHERE email=?", email);
    assert.ok(row);
    assert.deepEqual(JSON.parse(row.interests), ["brief", "prompts"]);
    assert.equal(row.role, "Audit partner");

    // Re-registering updates rather than erroring or duplicating.
    const again = await post("/api/early-access", { email, role: "CFO", interests: ["ask"] });
    assert.equal(again.status, 200);
    assert.equal(one("SELECT COUNT(*) AS n FROM early_access WHERE email=?", email).n, 1);
    assert.equal(one("SELECT role FROM early_access WHERE email=?", email).role, "CFO");
  });

  test("the Brief waitlist records without promising mail", async () => {
    const email = `brief-${Date.now()}@test.eu`;
    assert.equal((await post("/api/newsletter", { email })).status, 200);
    assert.ok(one("SELECT * FROM newsletter WHERE email=?", email));
    // Signing up for the Brief must not queue anything: the waitlist promises
    // one message when the first issue exists, and nothing sends it yet.
    // (Account signup DOES queue a welcome mail, which is why this checks the
    // address rather than the whole outbox.)
    assert.equal(
      one("SELECT COUNT(*) AS n FROM outbox WHERE to_email=?", email).n,
      0,
      "the Brief waitlist must not queue mail it cannot send"
    );
  });

  test("analytics events are written, and only known kinds", async () => {
    const before = one("SELECT COUNT(*) AS n FROM events").n;
    assert.equal((await post("/api/track", { kind: "page_view", path: "/briefing" })).status, 200);
    assert.ok(one("SELECT COUNT(*) AS n FROM events").n > before, "the event is persisted");

    for (const bad of [{ kind: "evil", path: "/x" }, { kind: "page_view", path: "https://evil.com" }]) {
      assert.equal((await post("/api/track", bad)).status, 400, `should reject ${JSON.stringify(bad)}`);
    }
  });

  test("analytics still stores nothing identifying", () => {
    const d = open();
    const cols = d.prepare("PRAGMA table_info(events)").all().map((c) => c.name);
    d.close();
    for (const forbidden of ["ip", "ip_address", "user_agent", "user_id", "referrer"]) {
      assert.ok(!cols.includes(forbidden), `events must not carry ${forbidden}`);
    }
  });

  test("a training enquiry is recorded and acknowledged with a reference", async () => {
    const res = await post("/api/enquiry", {
      name: "Enq Tester", email: `enq-${Date.now()}@test.eu`, firm: "Firm",
      programme: "Foundations", message: "Please call.",
    });
    assert.equal(res.status, 200);
    const { ref } = await res.json();
    assert.match(ref, /^STAI-TRN-\d{4}$/, "the reference comes from the inserted row id");
  });
});
