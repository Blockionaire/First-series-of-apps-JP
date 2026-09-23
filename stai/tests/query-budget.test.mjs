/**
 * Every page view stays far inside one Workers Free invocation.
 *
 * Workers Free allows 50 D1 queries per invocation, and a page view is one
 * invocation. Before Stage 2 a public page made 29–53: the Header and the
 * Footer each read the 13 page switches one key at a time, the homepage read
 * eight copy fields the same way, and nothing was shared within a request
 * (CODE_AUDIT.md, H1). The target now is ~3–6 for a public page.
 *
 * This runs the production build with a preload that logs every statement the
 * server prepares (tests/support/count-queries.cjs) and asks each page once
 * after a warm-up, so the count is what a reader's request costs.
 *
 * A failure names the page and lists its queries, so a regression points at
 * its own cause.
 */
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "fs";
import os from "os";
import path from "path";

const PORT = Number(process.env.QUERY_BUDGET_PORT ?? 3221);
const BASE = `http://127.0.0.1:${PORT}`;
const ROOT = path.resolve(import.meta.dirname, "..");
const STANDALONE = path.join(ROOT, ".next/standalone/server.js");
const hasBuild = fs.existsSync(STANDALONE);
const skip = !hasBuild && "needs `npm run build` first";

/** The Workers Free ceiling, and the budgets held well under it. */
const FREE_PLAN_LIMIT = 50;
const PUBLIC_BUDGET = 6;
const SIGNED_IN_BUDGET = 8;
/** Admin screens are one reader's tool, not traffic — but still one invocation. */
const ADMIN_CEILING = 40;

const ADMIN_EMAIL = "budget-admin@test.eu";
const ADMIN_PASSWORD = "budget-admin-password";

let dataDir, logFile, server, reader, admin, articleSlug, promptSlug;

const cookieOf = (res) =>
  res.headers.getSetCookie().find((c) => c.startsWith("stai_session="))?.split(";")[0] ?? "";

const lines = () => (fs.existsSync(logFile) ? fs.readFileSync(logFile, "utf8").split("\n").filter(Boolean) : []);

/** Wait until the log stops growing: work a response triggers can finish just after it. */
async function settle() {
  let last = -1;
  for (let i = 0; i < 40; i++) {
    const n = lines().length;
    if (n === last) return;
    last = n;
    await new Promise((r) => setTimeout(r, 60));
  }
}

/** Queries one request to `p` costs, after a warm-up request to the same page. */
async function cost(p, cookie) {
  const headers = cookie ? { Cookie: cookie } : {};
  await (await fetch(BASE + p, { headers, redirect: "manual" })).arrayBuffer();
  await settle();
  const before = lines().length;
  const res = await fetch(BASE + p, { headers, redirect: "manual" });
  await res.arrayBuffer();
  await settle();
  const queries = lines().slice(before);
  return { status: res.status, queries };
}

function within(label, { status, queries }, budget) {
  if (process.env.SHOW_BUDGET) console.log(`[budget] ${label}: ${queries.length}`);
  assert.ok(status < 500, `${label} answered ${status}`);
  assert.ok(
    queries.length <= budget && queries.length < FREE_PLAN_LIMIT,
    `${label}: ${queries.length} queries (budget ${budget}):\n  ${queries.join("\n  ")}`
  );
}

before(async () => {
  if (!hasBuild) return;
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "stai-budget-"));
  logFile = path.join(dataDir, "queries.log");
  server = spawn("node", [STANDALONE], {
    cwd: ROOT,
    env: {
      ...process.env,
      NODE_OPTIONS: `--require ${path.join(ROOT, "tests/support/count-queries.cjs")}`,
      STAI_QUERY_LOG: logFile,
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
  const signup = await fetch(`${BASE}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "budget-reader@test.eu", password: "budget-reader-1", name: "Reader", firm: "Test LLP" }),
  });
  reader = cookieOf(signup);
  const login = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  admin = cookieOf(login);
  assert.ok(reader && admin, "both sessions must exist");

  // Real slugs from the seeded corpus, found the way a reader finds them.
  articleSlug = (await (await fetch(`${BASE}/news`)).text()).match(/href="\/briefing\/([a-z0-9-]+)"/)?.[1];
  promptSlug = (await (await fetch(`${BASE}/prompts`)).text()).match(/href="\/prompts\/([a-z0-9-]+)"/)?.[1];
  assert.ok(articleSlug && promptSlug, "the seeded corpus must provide an article and a prompt");
});

after(async () => {
  if (server) {
    const exited = new Promise((r) => server.once("exit", r));
    server.kill("SIGTERM");
    await Promise.race([exited, new Promise((r) => setTimeout(r, 10_000))]);
  }
  if (dataDir) fs.rmSync(dataDir, { recursive: true, force: true });
});

const PUBLIC_PAGES = [
  "/", "/news", "/insights", "/prompts", "/ai-act", "/plus", "/podcast", "/research",
  "/training", "/firms", "/assessment", "/about", "/contact", "/login", "/signup",
  "/authors/stai-editorial", "/briefing/category/regulation", "/no-such-page",
  "/sitemap.xml", "/feed.xml",
];

describe("public pages: at most 6 D1 queries", { skip }, () => {
  for (const p of PUBLIC_PAGES) {
    test(p, async () => within(p, await cost(p), PUBLIC_BUDGET));
  }
  test("an article page", async () => within(`/briefing/${articleSlug}`, await cost(`/briefing/${articleSlug}`), PUBLIC_BUDGET));
  test("a prompt page", async () => within(`/prompts/${promptSlug}`, await cost(`/prompts/${promptSlug}`), PUBLIC_BUDGET));

  test("the settings table is read once per page, not once per switch", async () => {
    const { queries } = await cost("/");
    const settingsReads = queries.filter((q) => /FROM settings/i.test(q));
    assert.equal(settingsReads.length, 1, `settings read ${settingsReads.length} times:\n  ${settingsReads.join("\n  ")}`);
  });

  test("list pages never read article bodies", async () => {
    for (const p of ["/", "/news", "/insights", "/ai-act", "/no-such-page", "/feed.xml", "/sitemap.xml"]) {
      const { queries } = await cost(p);
      const bodies = queries.filter((q) => /FROM articles/i.test(q) && /SELECT \*/i.test(q));
      assert.deepEqual(bodies, [], `${p} read whole article rows:\n  ${bodies.join("\n  ")}`);
    }
  });
});

describe("signed-in pages: at most 8 D1 queries", { skip }, () => {
  for (const p of ["/", "/account", "/prompts", "/news"]) {
    test(p, async () => within(`${p} (signed in)`, await cost(p, reader), SIGNED_IN_BUDGET));
  }
  test("an article page", async () =>
    within(`/briefing/${articleSlug} (signed in)`, await cost(`/briefing/${articleSlug}`, reader), SIGNED_IN_BUDGET));
  test("a prompt page", async () =>
    within(`/prompts/${promptSlug} (signed in)`, await cost(`/prompts/${promptSlug}`, reader), SIGNED_IN_BUDGET));

  test("the session is resolved once per page", async () => {
    // Pages where both the Header and the page itself ask who is signed in.
    for (const p of ["/account", `/briefing/${articleSlug}`, `/prompts/${promptSlug}`]) {
      const { queries } = await cost(p, reader);
      const lookups = queries.filter((q) => /FROM sessions s JOIN users u/i.test(q));
      assert.equal(lookups.length, 1, `${p}: currentUser ran ${lookups.length} times`);
    }
  });
});

describe("admin screens stay inside one invocation", { skip }, () => {
  for (const p of ["/admin", "/admin/editorial", "/admin/editorial/sources", "/admin/people", "/admin/growth", "/admin/settings", "/admin/content", "/admin/prompts"]) {
    test(p, async () => within(`${p} (admin)`, await cost(p, admin), ADMIN_CEILING));
  }
});
