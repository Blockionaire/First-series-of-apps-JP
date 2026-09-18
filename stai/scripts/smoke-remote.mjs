/**
 * Smoke-test a DEPLOYED STAI against a real URL.
 *
 *   node scripts/smoke-remote.mjs https://stai.<subdomain>.workers.dev
 *   node scripts/smoke-remote.mjs https://stai-ahead.com
 *
 * Read-only by design. Every request below is a GET, or a POST that the
 * application refuses before it writes anything. Nothing here creates an
 * account, publishes content or mutates production data, so it is safe to run
 * against the live site as often as you like.
 *
 * The write-path checks from the Phase 4 plan — signup, login, the admin
 * editors, draft create/edit/unpublish, early access — deliberately are NOT
 * here. They leave rows behind, and a script that cleans up after itself in
 * production is a script that can delete the wrong row. Those are in the
 * runbook as manual steps with named test data.
 *
 * Exits non-zero if any check fails.
 */
const BASE = (process.argv[2] ?? "").replace(/\/+$/, "");
if (!BASE) {
  console.error("usage: node scripts/smoke-remote.mjs <base-url>");
  process.exit(2);
}

/** The origin canonical URLs are expected to name. Defaults to the base. */
const EXPECT_ORIGIN = (process.env.EXPECT_ORIGIN ?? BASE).replace(/\/+$/, "");

let failed = 0;
const pass = (label, detail = "") => console.log(`  ok   ${label}${detail && ` — ${detail}`}`);
const fail = (label, detail = "") => {
  console.log(`FAIL   ${label}${detail && ` — ${detail}`}`);
  failed++;
};
/** Assert `ok`, reporting a different detail for each outcome. */
const check = (ok, label, okDetail = "", failDetail = "") =>
  ok ? pass(label, okDetail) : fail(label, failDetail);

async function get(path, init) {
  const res = await fetch(BASE + path, { redirect: "manual", ...init });
  const text = await res.text(); // always drained; a Response body is single-use
  return { status: res.status, text, headers: res.headers };
}

async function expectStatus(path, want, label = path) {
  try {
    const { status } = await get(path);
    const ok = Array.isArray(want) ? want.includes(status) : status === want;
    if (ok) pass(label, String(status));
    else fail(label, `got ${status}, want ${want}`);
    return status;
  } catch (e) {
    fail(label, e.message);
    return 0;
  }
}

console.log(`\nSTAI smoke test → ${BASE}\n`);

// ── Health, and what it proves ───────────────────────────────────────────
console.log("health");
let health;
try {
  const { status, text } = await get("/api/health");
  health = JSON.parse(text);
  check(status === 200, "/api/health", "200", `got ${status}`);
  check(health.runtime === "workers", "runtime is workers", "", `got ${health.runtime}`);
  check(health.db?.driver === "d1", "driver is d1", "", `got ${health.db?.driver}`);
  check(health.db?.reachable === true, "D1 reachable");
  check(
    health.db?.publishedArticles > 0,
    "published articles",
    String(health.db?.publishedArticles),
    "none — is the seed applied?"
  );

  // The Phase 3.5 control. "process" here means per-isolate counting, which on
  // Workers is not a limit at all.
  check(
    health.limiter?.scope === "global",
    "rate limiter scope is global",
    "",
    `got "${health.limiter?.scope}" — Durable Object not bound?`
  );
  check(
    health.limiter?.healthy === true,
    "rate limiter healthy",
    "",
    `degradations=${health.limiter?.degradations}`
  );
} catch (e) {
  fail("/api/health", e.message);
}

// ── Public surface ───────────────────────────────────────────────────────
console.log("\npublic pages");
for (const p of [
  "/", "/briefing", "/prompts", "/plus", "/ask", "/firms", "/ai-act",
  // /authors and /legal are parent segments with dynamic children only —
  // they have no page of their own and correctly 404.
  "/about", "/contact", "/training", "/assessment",
  "/podcast", "/research", "/login", "/signup",
  "/legal/privacy", "/legal/terms", "/legal/company",
]) {
  await expectStatus(p, 200);
}

console.log("\ncrawler surface");
await expectStatus("/sitemap.xml", 200);
await expectStatus("/robots.txt", 200);
await expectStatus("/feed.xml", 200);
await expectStatus("/opengraph-image", 200);

// ── Every published briefing and prompt, taken from the sitemap ──────────
console.log("\npublished content (from sitemap)");
try {
  const { text } = await get("/sitemap.xml");
  const locs = [...text.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  const paths = locs.map((u) => new URL(u).pathname);
  const content = paths.filter((p) => p.startsWith("/briefing/") || p.startsWith("/prompts/"));
  if (!content.length) fail("sitemap lists content", "no briefing or prompt URLs");
  let bad = 0;
  for (const p of content) {
    const { status } = await get(p);
    if (status !== 200) {
      bad++;
      fail(p, `got ${status}`);
    }
  }
  if (!bad) pass(`all ${content.length} content URLs return 200`);

  // Canonical URLs must name the production origin, never workers.dev and
  // never localhost. This is the check that catches a half-finished cutover.
  const wrong = locs.filter((u) => !u.startsWith(EXPECT_ORIGIN));
  check(
    wrong.length === 0,
    "sitemap URLs all use the expected origin",
    EXPECT_ORIGIN,
    `${wrong.length} wrong, e.g. ${wrong[0]}`
  );
} catch (e) {
  fail("sitemap parse", e.message);
}

// ── Canonical / OG metadata on the homepage ──────────────────────────────
console.log("\nmetadata");
try {
  const { text } = await get("/");
  const canonical = text.match(/<link rel="canonical" href="([^"]+)"/)?.[1] ?? "";
  check(
    canonical.startsWith(EXPECT_ORIGIN),
    "canonical",
    canonical,
    `got "${canonical}", want ${EXPECT_ORIGIN}`
  );
  // Case-insensitive, and matching the bare domain rather than "stai.ai/".
  // The earlier version missed "STAI.AI" rendered in an OG card, because it
  // compared with includes() against a lower-case string ending in a slash.
  // Any spelling of the old domain is a finding; stai-ahead.com cannot match.
  for (const bad of [/localhost/i, /workers\.dev/i, /\bstai\.ai\b/i]) {
    check(!bad.test(text), `no ${bad} in homepage HTML`);
  }
} catch (e) {
  fail("homepage metadata", e.message);
}

// ── Admin must not be reachable unauthenticated ──────────────────────────
console.log("\nauthorization");
await expectStatus("/admin", [302, 303, 307, 404], "/admin refuses anonymous callers");

// ── Payments stay frozen ─────────────────────────────────────────────────
console.log("\npayment freeze");
const frozen = async (path, want, label) => {
  try {
    const res = await fetch(BASE + path, {
      method: "POST",
      redirect: "manual",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    await res.text();
    check(
      want.includes(res.status),
      label,
      String(res.status),
      `got ${res.status}, want one of ${want}`
    );
  } catch (e) {
    fail(label, e.message);
  }
};
// 401 = refused before any payment logic; 404 = route not reachable at all.
await frozen("/api/checkout", [401, 403, 404, 501], "checkout unavailable");
await frozen("/api/checkout/sandbox", [404, 501], "sandbox checkout unavailable");
await frozen("/api/stripe/webhook", [404, 501], "stripe webhook not implemented");

console.log(
  failed === 0
    ? `\nALL CHECKS PASSED against ${BASE}\n`
    : `\n${failed} CHECK(S) FAILED against ${BASE}\n`
);
process.exit(failed ? 1 : 0);
