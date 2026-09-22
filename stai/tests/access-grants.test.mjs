/**
 * Who gets STAI+ without paying for it, and what that must not touch.
 *
 * Three ways to be entitled now: a confirmed payment, a complimentary grant,
 * and being the admin. The first was already tested to death. These are the
 * other two, and the property worth defending hardest is negative:
 *
 *   **Granting free access writes nothing to the payment record.**
 *
 * The temptation is to fake a subscriptions row — it is one INSERT and every
 * gate would light up. It would also put a payment that never happened into
 * the record of payments, render a price on the member's account page that
 * nobody was charged, and break reconciliation on the day real payments are
 * switched on, when every active subscription is expected to match something
 * at the provider. So `subscriptions` is asserted to stay empty throughout.
 */
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import Database from "better-sqlite3";
import fs from "fs";
import os from "os";
import path from "path";

const PORT = Number(process.env.ACCESS_TEST_PORT ?? 3217);
const BASE = `http://127.0.0.1:${PORT}`;
const ROOT = path.resolve(import.meta.dirname, "..");
const STANDALONE = path.join(ROOT, ".next/standalone/server.js");
const hasBuild = fs.existsSync(STANDALONE);

const ADMIN_EMAIL = "access-admin@test.eu";
const ADMIN_PASSWORD = "access-admin-password";
const FRIEND = "friend@test.eu";
const FRIEND_PASSWORD = "friend-password-1";
const STRANGER = "stranger@test.eu";
const STRANGER_PASSWORD = "stranger-password-1";

let dataDir, server, adminCookie, friendCookie, strangerCookie;

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

const cookieOf = (res) =>
  res.headers.getSetCookie().find((c) => c.startsWith("stai_session="))?.split(";")[0] ?? "";

async function login(email, password) {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  assert.equal(res.status, 200, `${email} should be able to sign in`);
  return cookieOf(res);
}

async function signup(email, password, name) {
  const res = await fetch(`${BASE}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, name, firm: "Test LLP" }),
  });
  assert.ok(res.ok, `${email} should be able to sign up`);
  return cookieOf(res);
}

/** POST to the access route. `cookie` null sends no session. */
async function post(body, cookie = adminCookie) {
  const res = await fetch(`${BASE}/api/admin/access`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
    body: JSON.stringify(body),
  });
  return { status: res.status, json: await res.json().catch(() => ({})) };
}

const page = (p, cookie) =>
  fetch(BASE + p, { redirect: "manual", headers: cookie ? { Cookie: cookie } : {} });

const db = (writable = false) =>
  new Database(path.join(dataDir, "stai.db"), { readonly: !writable });

function query(sql, params = []) {
  const d = db();
  const rows = d.prepare(sql).all(...params);
  d.close();
  return rows;
}
const one = (sql, params = []) => query(sql, params)[0];

/** Used only to age a grant, which no API can do. */
function exec(sql, params = []) {
  const d = db(true);
  d.prepare(sql).run(...params);
  d.close();
}

before(async () => {
  if (!hasBuild) return;
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "stai-access-"));
  server = startServer();
  await waitHealthy();
  adminCookie = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
  friendCookie = await signup(FRIEND, FRIEND_PASSWORD, "A Friend");
  strangerCookie = await signup(STRANGER, STRANGER_PASSWORD, "A Stranger");
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

/* ── The admin ──────────────────────────────────────────────────────────── */

describe("the admin account has full access without paying", { skip }, () => {
  test("no subscription exists for anybody", () => {
    // The baseline every later assertion depends on.
    assert.equal(one("SELECT COUNT(*) n FROM subscriptions").n, 0);
  });

  test("the account page shows full access, not a price", async () => {
    const html = await (await page("/account", adminCookie)).text();
    assert.match(html, /Admin — full access/);
    assert.ok(
      !/€\d/.test(html),
      "a charge was shown to an account that has never been billed"
    );
  });

  test("there is nothing offering to cancel or to upgrade", async () => {
    const html = await (await page("/account", adminCookie)).text();
    // Cancelling would reach payment code that is frozen, and there is no
    // subscription to cancel in any case.
    assert.ok(!/Upgrade to STAI\+/.test(html), "offered an upgrade to an account that has it");
  });

  test("the way into the back office is on the page the account icon opens", async () => {
    const html = await (await page("/account", adminCookie)).text();
    assert.match(html, /Desk backoffice/, "no link to the back office");
    assert.match(html, /href="\/admin"/);
  });

  test("a non-admin is offered neither the desk nor a false membership", async () => {
    const html = await (await page("/account", strangerCookie)).text();
    assert.ok(!/Desk backoffice/.test(html), "a reader was shown the back office");
    assert.ok(!/href="\/admin"/.test(html));
    assert.match(html, /Free account/);
  });
});

/* ── Granting ───────────────────────────────────────────────────────────── */

describe("complimentary STAI+", { skip }, () => {
  const grantRow = () =>
    one(
      `SELECT g.*, u.email FROM access_grants g JOIN users u ON u.id=g.user_id
        WHERE lower(u.email)=? ORDER BY g.id DESC LIMIT 1`,
      [FRIEND]
    );

  test("a free account starts free", async () => {
    const html = await (await page("/account", friendCookie)).text();
    assert.match(html, /Free account/);
  });

  test("an admin can grant it by email", async () => {
    const { status, json } = await post({
      action: "grant",
      email: FRIEND,
      reason: "second personal account",
    });
    assert.equal(status, 200, JSON.stringify(json));
    assert.equal(json.already, false);
    const g = grantRow();
    assert.ok(g, "no grant row was written");
    assert.equal(g.reason, "second personal account");
    assert.equal(g.granted_by, ADMIN_EMAIL, "attributed to whoever granted it");
    assert.equal(g.expires_at, null, "no end date was asked for");
  });

  test("THE POINT: nothing was written to the payment record", () => {
    // If this ever fails, a comp has become a fake payment: /account will
    // show a price nobody was charged, and reconciliation against the
    // provider will not balance when payments go live.
    assert.equal(
      one("SELECT COUNT(*) n FROM subscriptions").n,
      0,
      "granting free access created a subscription"
    );
  });

  test("the granted account now has STAI+ everywhere", async () => {
    // `plan` is the single field every gate on the platform reads, so this
    // one assertion covers articles, prompts and the Ask STAI quota at once.
    const html = await (await page("/account", friendCookie)).text();
    assert.match(html, /STAI\+ — complimentary/);
    assert.ok(!/Free account/.test(html));
  });

  test("and is told it was given, not bought", async () => {
    const html = await (await page("/account", friendCookie)).text();
    assert.match(html, /given to you rather than bought/i);
    assert.ok(!/€\d/.test(html), "a price was shown to someone who was never charged");
    assert.ok(!/Upgrade to STAI\+/.test(html), "offered an upgrade to something they have");
  });

  test("granting twice does not stack a second grant", async () => {
    const before = query("SELECT id FROM access_grants").length;
    const { status, json } = await post({
      action: "grant",
      email: FRIEND,
      reason: "double click",
    });
    assert.equal(status, 200);
    assert.equal(json.already, true);
    assert.equal(query("SELECT id FROM access_grants").length, before, "a duplicate row appeared");
  });

  test("a reason is required — an unexplained comp cannot be reviewed", async () => {
    const { status, json } = await post({ action: "grant", email: STRANGER, reason: "  " });
    assert.equal(status, 400);
    assert.match(json.error, /reason is required/i);
  });

  test("an account that does not exist is refused, not invented", async () => {
    const { status, json } = await post({
      action: "grant",
      email: "nobody@test.eu",
      reason: "x",
    });
    assert.equal(status, 400);
    assert.match(json.error, /No account for/);
    assert.equal(one("SELECT COUNT(*) n FROM users WHERE email='nobody@test.eu'").n, 0);
  });

  test("a malformed or past expiry is refused", async () => {
    for (const bad of ["tomorrow", "2020-01-01", "31-12-2026"]) {
      const { status } = await post({
        action: "grant",
        email: STRANGER,
        reason: "x",
        expires_on: bad,
      });
      assert.equal(status, 400, `${bad} should be refused`);
    }
  });

  test("only an admin can grant", async () => {
    const asReader = await post({ action: "grant", email: STRANGER, reason: "x" }, strangerCookie);
    assert.equal(asReader.status, 403);
    const anon = await post({ action: "grant", email: STRANGER, reason: "x" }, null);
    assert.equal(anon.status, 403);
  });
});

/* ── Ending it ──────────────────────────────────────────────────────────── */

describe("a grant can be withdrawn and can expire", { skip }, () => {
  test("withdrawing returns the account to free", async () => {
    const g = one(
      `SELECT g.id FROM access_grants g JOIN users u ON u.id=g.user_id
        WHERE lower(u.email)=? AND g.revoked_at IS NULL`,
      [FRIEND]
    );
    assert.ok(g, "set up: the friend should have a live grant");

    const { status } = await post({ action: "revoke", id: g.id });
    assert.equal(status, 200);

    const html = await (await page("/account", friendCookie)).text();
    assert.match(html, /Free account/, "access survived the withdrawal");
  });

  test("the record survives the withdrawal", () => {
    // Who was given free access, by whom, and when it ended has to outlast
    // somebody changing their mind.
    const g = one(
      `SELECT g.* FROM access_grants g JOIN users u ON u.id=g.user_id
        WHERE lower(u.email)=? ORDER BY g.id DESC LIMIT 1`,
      [FRIEND]
    );
    assert.ok(g, "the row was deleted rather than stamped");
    assert.ok(g.revoked_at, "no withdrawal time recorded");
    assert.equal(g.revoked_by, ADMIN_EMAIL);
    assert.equal(g.reason, "second personal account", "the original reason is still readable");
  });

  test("withdrawing twice is a 404, not a second stamp", async () => {
    const g = one(
      `SELECT g.id FROM access_grants g JOIN users u ON u.id=g.user_id
        WHERE lower(u.email)=? ORDER BY g.id DESC LIMIT 1`,
      [FRIEND]
    );
    assert.equal((await post({ action: "revoke", id: g.id })).status, 404);
  });

  test("an expired grant does not entitle", async () => {
    const { status } = await post({
      action: "grant",
      email: STRANGER,
      reason: "pilot firm, one month",
      expires_on: "2026-12-31",
    });
    assert.equal(status, 200);
    assert.match((await (await page("/account", strangerCookie)).text()), /STAI\+ — complimentary/);

    // Age it past its end. No API can do this, which is the point of testing
    // it: a grant nobody withdrew must still lapse on its own.
    exec(
      `UPDATE access_grants SET expires_at='2026-01-01T00:00:00.000Z'
        WHERE user_id=(SELECT id FROM users WHERE lower(email)=?)`,
      [STRANGER]
    );
    const html = await (await page("/account", strangerCookie)).text();
    assert.match(html, /Free account/, "an expired grant still granted access");
  });

  test("still nothing in the payment record, after all of that", () => {
    assert.equal(one("SELECT COUNT(*) n FROM subscriptions").n, 0);
  });

  test("only an admin can withdraw", async () => {
    const { status } = await post({ action: "revoke", id: 1 }, strangerCookie);
    assert.equal(status, 403);
  });
});
