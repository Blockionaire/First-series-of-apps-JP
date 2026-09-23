/**
 * Every admin surface refuses a signed-in reader.
 *
 * The admin check is written out by hand in each route and page — 26 copies of
 * `!user || user.role !== "admin"`. Before this file, the tests only sent
 * ANONYMOUS requests at most of them, so a regression to `if (!user)` — which
 * lets any signed-in reader write site settings or export the people register —
 * passed the whole suite. That was demonstrated, not assumed (CODE_AUDIT.md,
 * H4 / sabotage S10).
 *
 * So this walks the filesystem rather than listing routes. A new file under
 * src/app/api/admin or src/app/admin is covered the moment it exists; one with
 * a dynamic segment this file does not know how to fill fails loudly instead
 * of being skipped.
 *
 * Each surface is asked three times:
 *   · anonymous          → refused
 *   · a signed-in reader → refused (the case that was missing)
 *   · the admin          → NOT refused, which proves the route exists and the
 *                          check above is the thing doing the refusing, rather
 *                          than a 404 passing for a 403.
 */
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "fs";
import os from "os";
import path from "path";

const PORT = Number(process.env.AUTHZ_TEST_PORT ?? 3219);
const BASE = `http://127.0.0.1:${PORT}`;
const ROOT = path.resolve(import.meta.dirname, "..");
const STANDALONE = path.join(ROOT, ".next/standalone/server.js");
const hasBuild = fs.existsSync(STANDALONE);
const skip = !hasBuild && "needs `npm run build` first";

const ADMIN_EMAIL = "authz-admin@test.eu";
const ADMIN_PASSWORD = "authz-admin-password";
const READER = "authz-reader@test.eu";
const READER_PASSWORD = "authz-reader-password";

/**
 * How to fill each dynamic segment. Values that reach real data where that
 * matters: `accounts` is a registered dataset, so an admin gets 200 and a
 * reader's 403 cannot be the unknown-dataset 404 in disguise.
 */
const SEGMENTS = { dataset: "accounts", id: "1" };

/* ── Discovery ─────────────────────────────────────────────────────────── */

function walk(dir, file) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p, file));
    else if (e.name === file) out.push(p);
  }
  return out;
}

/** `src/app/admin/content/[id]/page.tsx` → `/admin/content/1`. */
function urlFor(file, appDir) {
  const rel = path.relative(appDir, path.dirname(file)).split(path.sep);
  return (
    "/" +
    rel
      .filter((s) => !/^\(.*\)$/.test(s)) // route groups add no path
      .map((s) => {
        const m = s.match(/^\[(\w+)\]$/);
        if (!m) return s;
        assert.ok(
          m[1] in SEGMENTS,
          `${path.relative(ROOT, file)} has a [${m[1]}] segment this test cannot fill — add it to SEGMENTS`
        );
        return SEGMENTS[m[1]];
      })
      .join("/")
  );
}

const APP = path.join(ROOT, "src/app");
const API_ROUTES = walk(path.join(APP, "api/admin"), "route.ts").flatMap((file) => {
  const src = fs.readFileSync(file, "utf8");
  const methods = [...src.matchAll(/export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE)\b/g)].map(
    (m) => m[1]
  );
  assert.ok(methods.length, `${path.relative(ROOT, file)} exports no HTTP method`);
  return methods.map((method) => ({ method, url: urlFor(file, APP), file }));
});
const PAGES = walk(path.join(APP, "admin"), "page.tsx").map((file) => ({ url: urlFor(file, APP), file }));

/* ── Server ────────────────────────────────────────────────────────────── */

let dataDir, server, adminCookie, readerCookie;

const cookieOf = (res) =>
  res.headers.getSetCookie().find((c) => c.startsWith("stai_session="))?.split(";")[0] ?? "";

function call({ method, url }, cookie) {
  return fetch(BASE + url, {
    method,
    redirect: "manual",
    headers: {
      ...(method === "GET" ? {} : { "Content-Type": "application/json" }),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    // An empty object: enough to reach the handler, and a body no admin
    // action accepts, so the admin control below cannot change anything.
    ...(method === "GET" ? {} : { body: "{}" }),
  });
}

before(async () => {
  if (!hasBuild) return;
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "stai-authz-"));
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
      INDEXNOW_KEY: "",
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
  const login = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  assert.equal(login.status, 200, "the admin must be able to sign in");
  adminCookie = cookieOf(login);
  const signup = await fetch(`${BASE}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: READER, password: READER_PASSWORD, name: "A Reader", firm: "Test LLP" }),
  });
  assert.ok(signup.ok, "a reader must be able to sign up");
  readerCookie = cookieOf(signup);
  assert.ok(adminCookie && readerCookie, "both sessions must exist");
});

after(async () => {
  if (server) {
    const exited = new Promise((r) => server.once("exit", r));
    server.kill("SIGTERM");
    await Promise.race([exited, new Promise((r) => setTimeout(r, 10_000))]);
  }
  if (dataDir) fs.rmSync(dataDir, { recursive: true, force: true });
});

/* ── Tests ─────────────────────────────────────────────────────────────── */

describe("admin authorisation — discovery", () => {
  test("finds the admin surfaces it is meant to guard", () => {
    // A floor, not an exact count: new routes must not need this edited, but a
    // walk that silently found nothing would pass every test below.
    assert.ok(API_ROUTES.length >= 11, `found only ${API_ROUTES.length} admin API handlers`);
    assert.ok(PAGES.length >= 15, `found only ${PAGES.length} admin pages`);
  });
});

describe("admin API routes refuse everyone but the admin", { skip }, () => {
  for (const r of API_ROUTES) {
    test(`${r.method} ${r.url}`, async () => {
      const anon = await call(r, null);
      assert.equal(anon.status, 403, "anonymous callers are refused");

      const reader = await call(r, readerCookie);
      assert.equal(reader.status, 403, "a signed-in reader is refused");

      const admin = await call(r, adminCookie);
      assert.ok(
        admin.status !== 403 && admin.status !== 404,
        `the admin must reach the handler (got ${admin.status}) — otherwise the 403s above prove nothing`
      );
    });
  }
});

describe("admin pages send everyone but the admin to sign in", { skip }, () => {
  for (const p of PAGES) {
    test(p.url, async () => {
      for (const [who, cookie] of [
        ["anonymous", null],
        ["a signed-in reader", readerCookie],
      ]) {
        const res = await call({ method: "GET", url: p.url }, cookie);
        assert.equal(res.status, 307, `${who} is redirected`);
        assert.match(res.headers.get("location") ?? "", /^\/login\?next=\/admin/, `${who} is sent to sign in`);
      }

      const admin = await call({ method: "GET", url: p.url }, adminCookie);
      assert.ok(
        admin.status !== 307 && admin.status < 500,
        `the admin must see the page (got ${admin.status})`
      );
    });
  }
});
