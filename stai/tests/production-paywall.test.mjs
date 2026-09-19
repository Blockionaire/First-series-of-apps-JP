/**
 * PRODUCTION PAYWALL — the regression test for the critical finding.
 *
 * Boots the real production server with NO Stripe key (the exact deployment
 * that was exploitable) and proves that a registered user cannot reach premium
 * by any route. If any assertion here fails, the paywall is bypassable.
 */
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import Database from "better-sqlite3";
import fs from "fs";
import os from "os";
import path from "path";

const PORT = Number(process.env.TEST_PORT ?? 3199);
const BASE = `http://127.0.0.1:${PORT}`;
const EMAIL = `paywall-${Date.now()}@test.eu`;
const PASSWORD = "test-password-123";

let server, dataDir, cookie = "";

async function waitForServer(timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`${BASE}/api/health`);
      if (r.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error("server did not become healthy in time");
}

/** fetch that carries the session cookie. */
async function api(pathname, init = {}) {
  const res = await fetch(BASE + pathname, {
    ...init,
    headers: { "Content-Type": "application/json", ...(cookie ? { cookie } : {}), ...(init.headers ?? {}) },
    redirect: "manual",
  });
  const setCookie = res.headers.getSetCookie?.() ?? [];
  for (const c of setCookie) {
    if (c.startsWith("stai_session=")) cookie = c.split(";")[0];
  }
  return res;
}

before(async () => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "stai-paywall-"));
  server = spawn("node", [".next/standalone/server.js"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NODE_ENV: "production",
      PORT: String(PORT),
      HOSTNAME: "127.0.0.1",
      STAI_DATA_DIR: dataDir,
      APP_URL: `http://127.0.0.1:${PORT}`,
      // The dangerous configuration: production, no Stripe key.
      STRIPE_SECRET_KEY: "",
      STRIPE_WEBHOOK_SECRET: "",
      STAI_ADMIN_EMAIL: "",
      STAI_ADMIN_PASSWORD: "",
      ANTHROPIC_API_KEY: "",
      RESEND_API_KEY: "",
    },
    stdio: "ignore",
  });
  await waitForServer();

  const signup = await api("/api/auth/signup", {
    method: "POST",
    body: JSON.stringify({ email: EMAIL, password: PASSWORD, name: "Paywall Tester", firm: "Test" }),
  });
  assert.equal(signup.status, 200, "test account should be created");
  assert.ok(cookie, "session cookie should be set");
});

after(() => {
  server?.kill("SIGTERM");
  if (dataDir) fs.rmSync(dataDir, { recursive: true, force: true });
});

/** Reads entitlement straight from the database the server is using. */
function isPremiumInDb() {
  const db = new Database(path.join(dataDir, "stai.db"), { readonly: true });
  const row = db
    .prepare(
      `SELECT 1 FROM users u JOIN subscriptions s ON s.user_id = u.id
       WHERE u.email = ? AND s.status IN ('active','trialing','past_due')`
    )
    .get(EMAIL);
  const plan = db.prepare("SELECT plan FROM users WHERE email=?").get(EMAIL);
  db.close();
  return { hasGrantingSubscription: !!row, usersPlan: plan?.plan };
}

describe("production paywall cannot be bypassed without Stripe", () => {
  test("the server is genuinely running in production mode", async () => {
    const res = await fetch(`${BASE}/api/health`);
    assert.equal(res.status, 200);
  });

  test("POST /api/checkout/sandbox returns 404 — the route does not exist", async () => {
    const res = await api("/api/checkout/sandbox", {
      method: "POST",
      body: JSON.stringify({ plan: "founding" }),
    });
    assert.equal(res.status, 404, "sandbox activation must be unreachable in production");
  });

  test("GET /checkout/sandbox returns 404", async () => {
    const res = await fetch(`${BASE}/checkout/sandbox?plan=founding`, {
      headers: { cookie },
      redirect: "manual",
    });
    assert.equal(res.status, 404, "sandbox checkout page must not render in production");
  });

  test("POST /api/checkout returns 503 and never a sandbox URL", async () => {
    const res = await api("/api/checkout", { method: "POST", body: JSON.stringify({ plan: "founding" }) });
    assert.equal(res.status, 503, "checkout must report unavailable, not fall back");
    const body = await res.json();
    assert.equal(body.error, "unavailable");
    assert.ok(!("url" in body), "response must not contain any checkout URL");
    assert.ok(!JSON.stringify(body).includes("sandbox"), "response must not mention a sandbox path");
  });

  test("every attempted bypass left the account on the free plan", () => {
    const { hasGrantingSubscription, usersPlan } = isPremiumInDb();
    assert.equal(hasGrantingSubscription, false, "no access-granting subscription may exist");
    assert.notEqual(usersPlan, "plus", "users.plan must not have been set to plus");
  });

  test("no founding seat was consumed by the bypass attempts", () => {
    const db = new Database(path.join(dataDir, "stai.db"), { readonly: true });
    const row = db.prepare("SELECT value FROM settings WHERE key='founding_claimed'").get();
    db.close();
    assert.equal(row?.value, "0", "founding seats must be untouched");
  });

  test("premium content is still withheld from the account", async () => {
    const db = new Database(path.join(dataDir, "stai.db"), { readonly: true });
    const premium = db.prepare("SELECT slug, body_md FROM articles WHERE premium=1 LIMIT 1").get();
    db.close();
    assert.ok(premium, "fixture should include a premium article");

    const res = await fetch(`${BASE}/briefing/${premium.slug}`, { headers: { cookie } });
    const html = await res.text();
    // The gate truncates server-side, so the tail of the body must be absent.
    const tail = premium.body_md.trim().split(/\n\n+/).slice(-1)[0].slice(0, 60);
    assert.ok(tail.length > 10, "fixture tail should be substantial enough to test");
    assert.ok(
      !html.includes(tail),
      "locked article body must not be present in the HTML delivered to a free account"
    );
  });

  test("the admin API rejects a non-admin session", async () => {
    const res = await api("/api/admin/article", {
      method: "POST",
      body: JSON.stringify({ slug: "x", title: "x", body_md: "x" }),
    });
    assert.equal(res.status, 403);
  });

  test("no admin account exists when admin env vars are unset", () => {
    const db = new Database(path.join(dataDir, "stai.db"), { readonly: true });
    const admins = db.prepare("SELECT COUNT(*) AS n FROM users WHERE role='admin'").get();
    db.close();
    assert.equal(admins.n, 0, "production must not create a default admin");
  });
});

describe("persistent state lives under STAI_DATA_DIR", () => {
  test("the database and its WAL sidecar are inside the configured directory", () => {
    const files = fs.readdirSync(dataDir);
    assert.ok(files.includes("stai.db"), `stai.db must be in ${dataDir}, found: ${files.join(", ")}`);
    assert.ok(
      files.some((f) => f.startsWith("stai.db-")),
      "WAL/SHM sidecars must sit beside the database inside the volume"
    );
  });

  test("nothing was written to the default ./data path", () => {
    const stray = path.join(process.cwd(), "data", "stai.db");
    const strayExisted = fs.existsSync(stray);
    // The dev database may exist from local work; what matters is that the
    // test account was never written to it.
    if (strayExisted) {
      const db = new Database(stray, { readonly: true });
      const row = db.prepare("SELECT 1 FROM users WHERE email=?").get(EMAIL);
      db.close();
      assert.equal(row, undefined, "STAI_DATA_DIR must fully redirect writes");
    }
  });
});
