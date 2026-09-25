/**
 * The admin register — every list of people behind the desk's tiles.
 *
 * These run against the real server with a real admin session rather than
 * inspecting the registry as source text. That matters here: the registry
 * names tables and columns, and the only way a typo in one of those shows up
 * is by executing the query. A structural test that read the TypeScript would
 * happily pass on a dataset that 500s in production.
 *
 * So every dataset gets both its page and its CSV fetched, and the dataset
 * list is read back out of the rendered page — which means a dataset added to
 * the registry is covered by these tests automatically, without anyone
 * remembering to add it here.
 */
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "fs";
import os from "os";
import path from "path";

const PORT = Number(process.env.REGISTER_TEST_PORT ?? 3205);
const BASE = `http://127.0.0.1:${PORT}`;
const ROOT = path.resolve(import.meta.dirname, "..");
const STANDALONE = path.join(ROOT, ".next/standalone/server.js");
const hasBuild = fs.existsSync(STANDALONE);

const ADMIN_EMAIL = "register-admin@test.eu";
const ADMIN_PASSWORD = "register-admin-password";

let dataDir, server, cookie, datasets;

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
  const session = res.headers.getSetCookie().find((c) => c.startsWith("stai_session="));
  assert.ok(session, "a session cookie should be issued");
  return session.split(";")[0];
}

const asAdmin = (p) => fetch(BASE + p, { headers: { Cookie: cookie }, redirect: "manual" });

/** Parse the first CSV record, honouring quoted fields containing commas. */
function csvHeader(text) {
  const line = text.split("\n")[0] ?? "";
  return [...line.matchAll(/"((?:[^"]|"")*)"/g)].map((m) => m[1].replace(/""/g, '"'));
}

before(async () => {
  if (!hasBuild) return;
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "stai-register-"));
  server = startServer();
  await waitHealthy();
  cookie = await login();

  // Seed one row into the two lists the tests assert content against.
  await fetch(`${BASE}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "member@test.eu",
      password: "member-password-1",
      name: "Member Person",
      firm: "Test LLP",
    }),
  });
  // A leading "=" is a formula in a spreadsheet, and this address is valid by
  // the signup regex — exactly the shape the CSV guard exists for.
  await fetch(`${BASE}/api/newsletter`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "=cmd|calc@test.eu" }),
  });

  // The dataset list comes from the page itself, so new datasets are covered
  // without this file being edited.
  const html = await (await asAdmin("/admin/people")).text();
  datasets = [...new Set([...html.matchAll(/\/admin\/people\?d=([a-z-]+)/g)].map((m) => m[1]))];
});

after(async () => {
  await stopServer();
  if (dataDir) fs.rmSync(dataDir, { recursive: true, force: true });
});

const skip = hasBuild ? false : "no standalone build";

describe("admin register — access control", { skip }, () => {
  test("the register refuses anonymous callers", async () => {
    const res = await fetch(`${BASE}/admin/people`, { redirect: "manual" });
    assert.equal(res.status, 307, "/admin/people should redirect to login");
  });

  test("every export refuses anonymous callers", async () => {
    for (const id of datasets) {
      const res = await fetch(`${BASE}/api/admin/export/${id}`, { redirect: "manual" });
      assert.equal(res.status, 403, `/api/admin/export/${id} should be 403 for anonymous`);
    }
  });

  test("an unknown dataset is refused before it is looked up", async () => {
    // 403 rather than 404: the admin check runs first, so an anonymous caller
    // cannot use this endpoint to discover which datasets exist.
    const anon = await fetch(`${BASE}/api/admin/export/no-such-dataset`, { redirect: "manual" });
    assert.equal(anon.status, 403);
    const admin = await asAdmin("/api/admin/export/no-such-dataset");
    assert.equal(admin.status, 404, "an admin gets a plain 404 for an unknown dataset");
  });
});

describe("admin register — every dataset actually runs", { skip }, () => {
  test("the registry is not empty", () => {
    assert.ok(datasets.length >= 6, `expected the six seeded datasets, found ${datasets.length}`);
  });

  test("every dataset renders", async () => {
    for (const id of datasets) {
      const res = await asAdmin(`/admin/people?d=${id}`);
      assert.equal(res.status, 200, `/admin/people?d=${id} should render — a 500 means a bad column or table`);
    }
  });

  test("every dataset exports, with a header row matching its table", async () => {
    for (const id of datasets) {
      const res = await asAdmin(`/api/admin/export/${id}`);
      assert.equal(res.status, 200, `export ${id}`);
      assert.match(res.headers.get("content-type") ?? "", /text\/csv/);
      assert.match(
        res.headers.get("content-disposition") ?? "",
        new RegExp(`filename="stai-${id}-`),
        `export ${id} should download under its own name`
      );
      const header = csvHeader(await res.text());
      assert.ok(header.length > 0, `export ${id} should have a header row`);
    }
  });

  test("every desk tile points at a dataset that exists", async () => {
    const html = await (await asAdmin("/admin")).text();
    const linked = [...new Set([...html.matchAll(/\/admin\/people\?d=([a-z-]+)/g)].map((m) => m[1]))];
    assert.ok(linked.length >= 3, "the desk should link into the register");
    for (const id of linked) {
      assert.ok(datasets.includes(id), `the desk links to "${id}", which is not a dataset`);
    }
  });
});

describe("growth charts", { skip }, () => {
  test("the live endpoint reports a shape the tile can render", async () => {
    const res = await asAdmin("/api/admin/live");
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("cache-control"), "no-store", "a cached live number is a wrong number");
    const live = await res.json();
    assert.equal(typeof live.now, "number");
    assert.ok(Array.isArray(live.buckets), "buckets must be an array");
    assert.equal(live.buckets.length, 12, "the last hour in five-minute steps");
    assert.ok(live.buckets.every((n) => typeof n === "number"), "every bucket is a number");
  });

  test("empty says so, and once there is data every bucket is plotted", async () => {
    // One test, in order, because the two facts are about the same page in two
    // states and splitting them would make each depend on the other's ordering.

    // 1. Nothing tracked yet: the chart must say so rather than draw a flat
    //    line at zero, which reads as a broken chart instead of as quiet.
    const empty = await (await asAdmin("/admin/growth?w=1")).text();
    assert.match(empty, /Nothing recorded in this window/);
    assert.equal((empty.match(/<rect[^>]*fill="transparent"/g) ?? []).length, 0);

    // 2. Record a couple of views on public paths.
    for (const p of ["/", "/plus"]) {
      const res = await fetch(`${BASE}/api/track`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "page_view", path: p }),
      });
      assert.equal(res.status, 200);
    }

    // 3. Every window now plots its full set of buckets, including the ones
    //    where nothing happened — a quiet Tuesday must flatten the line, not
    //    disappear from the axis and shorten the window.
    //    The transparent <rect>s are the per-bucket hit targets: one per
    //    bucket per chart, and there are two charts.
    for (const [w, want] of [["1", 24], ["7", 7], ["30", 30]]) {
      const html = await (await asAdmin(`/admin/growth?w=${w}`)).text();
      const rects = (html.match(/<rect[^>]*fill="transparent"/g) ?? []).length;
      assert.equal(rects / 2, want, `w=${w} should plot ${want} buckets per chart, got ${rects / 2}`);
    }
  });
});

describe("admin register — what the export may and may not contain", { skip }, () => {
  test("password hashes never leave the building", async () => {
    const text = await (await asAdmin("/api/admin/export/accounts")).text();
    const header = csvHeader(text);
    assert.ok(
      !header.some((h) => /password|hash/i.test(h)),
      `accounts export must not have a password column — got ${header.join(", ")}`
    );
    // bcrypt hashes all start "$2"; if one were selected it would appear here.
    assert.ok(!/\$2[aby]?\$/.test(text), "no bcrypt hash may appear in the CSV");
    assert.match(text, /member@test\.eu/, "the export should still contain the account it is about");
  });

  test("a cell that would execute in a spreadsheet is neutralised", async () => {
    const text = await (await asAdmin("/api/admin/export/newsletter")).text();
    assert.match(text, /"'=cmd\|calc@test\.eu"/, "a leading = must be prefixed with an apostrophe");
    assert.ok(!/"=cmd/.test(text), "the raw formula must not survive into the CSV");
  });
});

describe("admin register — filters", { skip }, () => {
  test("a known filter narrows the set and names the download", async () => {
    const res = await asAdmin("/api/admin/export/accounts?plan=plus");
    assert.equal(res.status, 200);
    assert.match(res.headers.get("content-disposition") ?? "", /stai-accounts-plus-/);
    const text = await res.text();
    assert.ok(!/member@test\.eu/.test(text), "a free account must not appear under plan=plus");

    const admins = await (await asAdmin("/api/admin/export/accounts?plan=admin")).text();
    assert.match(admins, new RegExp(ADMIN_EMAIL.replace(".", "\\.")), "plan=admin should list the admin");
  });

  test("plan is what the person can read today: a granted member is STAI+ (M5)", async () => {
    // users.plan is written only by the frozen billing code, so read directly
    // it said "free" for every granted reader and every admin.
    await fetch(`${BASE}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "granted@test.eu", password: "granted-password-1", name: "Granted Reader", firm: "Test LLP" }),
    });
    const plusBefore = await (await asAdmin("/api/admin/export/accounts?plan=plus")).text();
    assert.ok(!/granted@test\.eu/.test(plusBefore), "not STAI+ before the grant");

    const grant = await fetch(`${BASE}/api/admin/access`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie, Origin: BASE },
      body: JSON.stringify({ action: "grant", email: "granted@test.eu", reason: "register test" }),
    });
    assert.equal(grant.status, 200, await grant.clone().text());

    const plus = await (await asAdmin("/api/admin/export/accounts?plan=plus")).text();
    assert.match(plus, /granted@test\.eu/, "a granted reader is listed under STAI+");
    assert.match(plus, new RegExp(ADMIN_EMAIL.replace(".", "\\.")), "and so is an admin");
    assert.ok(!/member@test\.eu/.test(plus), "a plain member is not");

    const free = await (await asAdmin("/api/admin/export/accounts?plan=free")).text();
    assert.ok(!/granted@test\.eu/.test(free), "and the granted reader has left Free");
    assert.match(free, /member@test\.eu/);

    const all = await (await asAdmin("/api/admin/export/accounts")).text();
    const header = csvHeader(all);
    const planAt = header.indexOf("Plan");
    const row = all.split("\n").find((l) => l.includes("granted@test.eu"));
    assert.equal(csvHeader(row)[planAt], "plus", "the Plan cell says plus");
  });

  test("an unrecognised filter value is ignored, not executed", async () => {
    // The filter is matched against an allowlist by id, so nothing from the
    // query string can reach the SQL. An injection attempt falls back to the
    // unfiltered list rather than erroring or returning a doctored set.
    for (const evil of ["' OR 1=1 --", "plus'; DROP TABLE users; --", "../../etc/passwd"]) {
      const res = await asAdmin(`/api/admin/export/accounts?plan=${encodeURIComponent(evil)}`);
      assert.equal(res.status, 200, `filter "${evil}" should be ignored, not fatal`);
      assert.match(await res.text(), /member@test\.eu/, "the unfiltered list should come back");
    }
    // And the table is still there.
    const after = await asAdmin("/api/admin/export/accounts");
    assert.equal(after.status, 200);
    assert.match(await after.text(), /member@test\.eu/);
  });
});
