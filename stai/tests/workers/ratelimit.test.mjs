/**
 * The rate limiter under the actual Cloudflare Workers runtime.
 *
 * Every assertion here runs against `wrangler dev` — workerd, a real local D1,
 * and a real SQLite-backed Durable Object. None of it is mocked, because the
 * thing being tested is precisely the part that Node cannot tell you about:
 * whether a counter is shared or per-isolate.
 *
 * ── How tests avoid each other ───────────────────────────────────────────
 * The limiter keys on `bucket:ip`, and `cf-connecting-ip` is what supplies the
 * ip on Workers. Each test claims a fresh address out of 203.0.113.0/24
 * (TEST-NET-3, the documentation range) so it gets its own counters and the
 * order of tests cannot matter. This works because `wrangler dev` passes the
 * header through rather than overwriting it — verified, not assumed.
 *
 * Requires a Workers build first:  npm run cf:build
 */
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import fs from "fs";
import net from "node:net";
import os from "os";
import path from "path";

const ROOT = path.resolve(import.meta.dirname, "../..");
const WORKER = path.join(ROOT, ".open-next/worker.js");
const hasBuild = fs.existsSync(WORKER);
const skip = hasBuild ? false : "no Workers build — run `npm run cf:build` first";

const PORT = Number(process.env.WORKERS_RATELIMIT_PORT ?? 8800);
const BASE = `http://127.0.0.1:${PORT}`;

/**
 * A copy of wrangler.jsonc with the Durable Object removed, used to simulate
 * the store being unavailable. Deriving it from the real config rather than
 * hand-writing one means the degraded run can never drift into testing a
 * configuration the application does not actually have.
 */
const DEGRADED_CONFIG = path.join(ROOT, "wrangler.ratelimit-degraded.jsonc");

let stateDir;
let server;

let ipSeq = 0;
/** A fresh client address, so each test owns its own counters. */
const nextIp = () => `203.0.113.${++ipSeq}`;

/** True once nothing is listening on the port. */
function portFree(port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: "127.0.0.1", port });
    socket.once("connect", () => {
      socket.destroy();
      resolve(false);
    });
    socket.once("error", () => resolve(true));
  });
}

function startServer(configPath) {
  const args = ["wrangler", "dev", "--port", String(PORT), "--local", "--persist-to", stateDir];
  if (configPath) args.push("--config", configPath);
  return spawn("npx", args, { cwd: ROOT, stdio: "ignore", detached: true });
}

/**
 * Stop the Worker and WAIT until the port is actually released.
 *
 * The wait is the point. `wrangler dev` supervises a child workerd, so killing
 * the process group returns long before workerd has let go of the socket, and
 * restarting immediately fails with "Address already in use" — which is how
 * this test's first draft failed. Polling the port is the only honest signal
 * that a restart is safe; a fixed sleep is a guess that is wrong under load.
 */
async function stopServer(child) {
  if (!child?.pid) return;
  try {
    process.kill(-child.pid, "SIGTERM");
  } catch {}
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (await portFree(PORT)) return;
    await new Promise((r) => setTimeout(r, 250));
  }
  try {
    process.kill(-child.pid, "SIGKILL");
  } catch {}
  while (Date.now() < deadline + 10_000) {
    if (await portFree(PORT)) return;
    await new Promise((r) => setTimeout(r, 250));
  }
}

async function waitForHealth() {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE}/api/health`);
      await res.text();
      if (res.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("worker did not become healthy");
}

/** Transport-only retry, exactly as in runtime.test.mjs: never masks a status. */
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
 * One counted request. The body is always read — an unread Response body keeps
 * the socket open, and `wrangler dev` starts refusing connections long before
 * a test suite this size finishes.
 */
async function hit(pathname, ip, body = {}, extraHeaders = {}) {
  const res = await req(pathname, {
    method: "POST",
    headers: { "Content-Type": "application/json", "CF-Connecting-IP": ip, ...extraHeaders },
    body: JSON.stringify(body),
  });
  await res.text();
  return { status: res.status, retryAfter: Number(res.headers.get("Retry-After") ?? 0) };
}

async function health() {
  const res = await req("/api/health");
  return JSON.parse(await res.text());
}

/**
 * The four security-sensitive policies, as the route handlers declare them.
 *
 * `expect` is the status a request that is NOT rate limited returns. Every one
 * of these routes calls guard() as its first statement, so an invalid body
 * still consumes a slot — which is what makes it cheap to exercise the limit
 * without creating accounts, deleting anything, or invoking the AI pipeline.
 */
const POLICY = {
  login: { path: "/api/auth/login", limit: 10, windowSec: 600, expect: 401,
           body: { email: "nobody@test.eu", password: "wrong-password" } },
  signup: { path: "/api/auth/signup", limit: 5, windowSec: 3600, expect: 400,
            body: { email: "not-an-email", password: "x" } },
  ask: { path: "/api/ask", limit: 15, windowSec: 600, expect: 400, body: { question: "" } },
  "account-delete": { path: "/api/account/delete", limit: 5, windowSec: 3600, expect: 401,
                      body: { password: "x" } },
};

/** Spend the whole allowance, asserting every request was actually allowed. */
async function exhaust(policy, ip) {
  for (let i = 1; i <= policy.limit; i++) {
    const { status } = await hit(policy.path, ip, policy.body);
    assert.equal(status, policy.expect, `request ${i} of ${policy.limit} should still be allowed`);
  }
}

before(async () => {
  if (!hasBuild) return;
  stateDir = fs.mkdtempSync(path.join(os.tmpdir(), "stai-rlstate-"));

  // The routes under test read the database, so it has to exist. Built the
  // same way production will be, and never by the Worker itself.
  const d1 = (...args) =>
    execFileSync("npx", ["wrangler", ...args, "--local", "--persist-to", stateDir], {
      cwd: ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, CI: "1" },
    });
  d1("d1", "migrations", "apply", "stai");
  d1("d1", "execute", "stai", "--file", "seeds/0001_verified_corpus.sql");

  server = startServer();
  await waitForHealth();
});

after(async () => {
  await stopServer(server);
  if (stateDir) fs.rmSync(stateDir, { recursive: true, force: true });
  fs.rmSync(DEGRADED_CONFIG, { force: true });
});

describe("rate limiter — Durable Object, under Workers", { skip }, () => {
  test("health reports a global limiter, which is the whole point of this phase", async () => {
    const h = await health();
    assert.equal(h.runtime, "workers");
    assert.equal(
      h.limiter.scope,
      "global",
      "scope 'process' here would mean per-isolate counting, i.e. no limit at all"
    );
    assert.equal(h.limiter.healthy, true, "the Durable Object should be answering");
    assert.equal(h.limiter.degradations, 0, "nothing should have fallen back yet");
  });

  test("login allows exactly its limit, then 429s", async () => {
    const ip = nextIp();
    await exhaust(POLICY.login, ip);
    const { status } = await hit(POLICY.login.path, ip, POLICY.login.body);
    assert.equal(status, 429, "the 11th login attempt must be refused");
  });

  test("Retry-After reflects the real window and is not a shortened one", async () => {
    const ip = nextIp();
    await exhaust(POLICY.login, ip);
    const { status, retryAfter } = await hit(POLICY.login.path, ip, POLICY.login.body);
    assert.equal(status, 429);
    assert.ok(retryAfter > 540 && retryAfter <= 600, `Retry-After ${retryAfter} should be ~600s`);
    // The failure this guards against by name: a 10-minute policy quietly
    // reimplemented as a 60-second one to fit a primitive that cannot do better.
    assert.ok(retryAfter > 60, "a ~60s Retry-After would mean the window was weakened");
  });

  test("signup keeps its hour-long window", async () => {
    const ip = nextIp();
    await exhaust(POLICY.signup, ip);
    const { status, retryAfter } = await hit(POLICY.signup.path, ip, POLICY.signup.body);
    assert.equal(status, 429, "the 6th signup must be refused");
    assert.ok(retryAfter > 3300 && retryAfter <= 3600, `Retry-After ${retryAfter} should be ~3600s`);
    assert.ok(retryAfter > 600, "an hour policy must not collapse to the ten-minute one");
  });

  test("account deletion keeps its hour-long window", async () => {
    const ip = nextIp();
    await exhaust(POLICY["account-delete"], ip);
    const { status, retryAfter } = await hit(
      POLICY["account-delete"].path,
      ip,
      POLICY["account-delete"].body
    );
    assert.equal(status, 429);
    assert.ok(retryAfter > 3300 && retryAfter <= 3600, `Retry-After ${retryAfter} should be ~3600s`);
  });

  test("Ask STAI keeps its ten-minute window", async () => {
    const ip = nextIp();
    await exhaust(POLICY.ask, ip);
    const { status, retryAfter } = await hit(POLICY.ask.path, ip, POLICY.ask.body);
    assert.equal(status, 429, "the 16th ask must be refused");
    assert.ok(retryAfter > 540 && retryAfter <= 600, `Retry-After ${retryAfter} should be ~600s`);
  });

  test("keys do not collide across routes", async () => {
    const ip = nextIp();
    await exhaust(POLICY.login, ip);
    assert.equal((await hit(POLICY.login.path, ip, POLICY.login.body)).status, 429);

    // Same client, different bucket. Spending the login allowance must not
    // spend the signup one.
    const { status } = await hit(POLICY.signup.path, ip, POLICY.signup.body);
    assert.equal(status, POLICY.signup.expect, "signup must be unaffected by a spent login bucket");
  });

  test("keys do not collide across clients", async () => {
    const victim = nextIp();
    const bystander = nextIp();
    await exhaust(POLICY.login, victim);
    assert.equal((await hit(POLICY.login.path, victim, POLICY.login.body)).status, 429);

    const { status } = await hit(POLICY.login.path, bystander, POLICY.login.body);
    assert.equal(status, POLICY.login.expect, "one client's limit must not lock out another");
  });

  test("a spoofed x-forwarded-for cannot mint a fresh bucket", async () => {
    const ip = nextIp();
    // Cloudflare appends to x-forwarded-for but sets cf-connecting-ip itself,
    // so trusting x-forwarded-for first would let a caller rotate one header
    // and walk straight through the login limit. Each request below carries a
    // different forged x-forwarded-for; none of them should matter.
    for (let i = 1; i <= POLICY.login.limit; i++) {
      const { status } = await hit(POLICY.login.path, ip, POLICY.login.body, {
        "X-Forwarded-For": `198.51.100.${i}`,
      });
      assert.equal(status, POLICY.login.expect);
    }
    const { status } = await hit(POLICY.login.path, ip, POLICY.login.body, {
      "X-Forwarded-For": "198.51.100.254",
    });
    assert.equal(status, 429, "rotating x-forwarded-for must not reset the counter");
  });

  test("the counter is shared, not module-local: it survives a Worker restart", async () => {
    const ip = nextIp();
    await exhaust(POLICY.login, ip);

    // A process restart is the strongest proof available locally. An
    // in-process Map cannot survive it; a Durable Object's SQLite storage can.
    // If this passes, the counter is genuinely outside the isolate.
    await stopServer(server);
    server = startServer();
    await waitForHealth();

    const { status } = await hit(POLICY.login.path, ip, POLICY.login.body);
    assert.equal(status, 429, "the spent allowance must outlive the isolate that spent it");
  });

  test("a missing Durable Object degrades to in-process protection, visibly", async () => {
    // Derive a config with no Durable Object binding, so env.RATE_LIMITER is
    // undefined and the store throws on every call. No test-only hook is
    // compiled into the application to make this happen.
    const raw = fs.readFileSync(path.join(ROOT, "wrangler.jsonc"), "utf8");
    const cfg = JSON.parse(
      raw
        .split("\n")
        .filter((line) => !line.trim().startsWith("//"))
        .join("\n")
    );
    delete cfg.durable_objects;
    delete cfg.migrations;
    fs.writeFileSync(DEGRADED_CONFIG, JSON.stringify(cfg, null, 2));

    await stopServer(server);
    server = startServer(DEGRADED_CONFIG);
    await waitForHealth();

    const ip = nextIp();

    // It must NOT fail open. In-process counting is weaker than global
    // counting but it is still a limit, and the limit must still bite.
    await exhaust(POLICY.login, ip);
    const { status } = await hit(POLICY.login.path, ip, POLICY.login.body);
    assert.equal(status, 429, "degraded must not mean unlimited");

    // And it must not fail closed either — unrelated traffic still serves.
    const page = await req("/api/health");
    assert.equal(page.status, 200, "a missing limiter store must not take the site down");

    const h = JSON.parse(await page.text());
    assert.ok(h.limiter.degradations > 0, "the fallback must be counted, not silent");
    assert.equal(h.limiter.healthy, false, "and reported as unhealthy while it is happening");
  });
});
