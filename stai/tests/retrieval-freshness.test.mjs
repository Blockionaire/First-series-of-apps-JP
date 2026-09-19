/**
 * Ask STAI retrieval freshness.
 *
 * The retrieval index is cached per isolate and validated per query by a
 * fingerprint of the published corpus. Two things have to be true at once:
 *
 *   1. the fingerprint must CHANGE whenever anything retrieval-visible changes,
 *      or an isolate serves a stale corpus for its whole life;
 *   2. computing it must NOT read article bodies, or every question asked costs
 *      a full read of every article — invisible on a local SQLite file, billed
 *      per row on D1.
 *
 * The first version satisfied (1) by summing LENGTH(body_md), which violated
 * (2) exactly. These tests hold both ends down.
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

const PORT = Number(process.env.FRESHNESS_TEST_PORT ?? 3201);
const BASE = `http://127.0.0.1:${PORT}`;
const ADMIN_EMAIL = "freshness-admin@test.eu";
const ADMIN_PASSWORD = "freshness-admin-password";

let dataDir, server, cookie;

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

before(async () => {
  if (!hasBuild) return;
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "stai-fresh-"));
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
  await waitHealthy();
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  cookie = res.headers.getSetCookie().find((c) => c.startsWith("stai_session=")).split(";")[0];
});

after(() => {
  server?.kill("SIGTERM");
  if (dataDir) fs.rmSync(dataDir, { recursive: true, force: true });
});

const open = () => new Database(path.join(dataDir, "stai.db"), { readonly: true });

/** The production fingerprint query, run directly against the database. */
const FINGERPRINT_SQL =
  "SELECT COUNT(*) AS n, COALESCE(MAX(updated_at), '') AS edited FROM articles WHERE status='published'";

function fingerprint() {
  const d = open();
  const r = d.prepare(FINGERPRINT_SQL).get();
  d.close();
  return `${r.n}:${r.edited}`;
}

function articleBySlug(slug) {
  const d = open();
  const r = d.prepare("SELECT * FROM articles WHERE slug=?").get(slug);
  d.close();
  return r;
}

/** Save through the real admin API, so this tests the route, not a fixture. */
async function saveArticle(row, overrides = {}) {
  const payload = {
    id: row?.id,
    slug: row?.slug ?? "freshness-probe",
    title: row?.title ?? "Freshness probe",
    dek: row?.dek ?? "Probe.",
    category: row?.category ?? "Analysis",
    tags: "probe",
    author: "STAI Editorial",
    author_role: "Editorial desk",
    published_at: row?.published_at ?? "2026-01-01",
    reading_min: row?.reading_min ?? 1,
    featured: 0,
    urgency: 1,
    premium: false,
    status: row?.status ?? "published",
    body_md: row?.body_md ?? "Probe body.",
    ...overrides,
  };
  const res = await fetch(`${BASE}/api/admin/article`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify(payload),
  });
  const text = await res.text(); // read once — a Response body is single-use
  assert.equal(res.status, 200, text);
  return JSON.parse(text);
}

describe("retrieval freshness — the fingerprint moves when it must", { skip }, () => {
  test("a new published article changes the fingerprint", async () => {
    const before = fingerprint();
    await saveArticle(null, { slug: "freshness-new", title: "Freshness new" });
    assert.notEqual(fingerprint(), before, "creating a published article must change it");
  });

  test("[14] editing a published article's body changes the fingerprint", async () => {
    const row = articleBySlug("freshness-new");
    const before = fingerprint();
    await saveArticle(row, { body_md: "Body rewritten by the editor." });
    const after = fingerprint();
    assert.notEqual(after, before, "an edit must change it");
    // The count is unchanged, so it must be the timestamp that moved.
    assert.equal(after.split(":")[0], before.split(":")[0], "same number of published articles");
  });

  test("editing only the title and dek also changes the fingerprint", async () => {
    // Title and category are indexed alongside the body text, so a title-only
    // edit is retrieval-visible and must not be treated as cosmetic.
    const row = articleBySlug("freshness-new");
    const before = fingerprint();
    await saveArticle(row, { title: "Retitled for retrieval", dek: "New standfirst." });
    assert.notEqual(fingerprint(), before);
  });

  test("[15] unpublishing changes the fingerprint", async () => {
    const row = articleBySlug("freshness-new");
    const before = fingerprint();
    await saveArticle(row, { status: "draft" });
    const after = fingerprint();
    assert.notEqual(after, before, "a takedown must change it");
    assert.equal(
      Number(after.split(":")[0]),
      Number(before.split(":")[0]) - 1,
      "one fewer published article"
    );
  });

  test("re-publishing changes it back into view", async () => {
    const row = articleBySlug("freshness-new");
    const before = fingerprint();
    await saveArticle(row, { status: "published" });
    const after = fingerprint();
    assert.notEqual(after, before);
    assert.equal(Number(after.split(":")[0]), Number(before.split(":")[0]) + 1);
  });

  test("an unchanged corpus produces an unchanged fingerprint", async () => {
    // The other half of the contract: if this drifted on its own, every query
    // would rebuild the index and the cache would be pointless.
    const a = fingerprint();
    await new Promise((r) => setTimeout(r, 1100));
    assert.equal(fingerprint(), a, "nothing changed, so nothing should look changed");
  });

  test("every seeded article carries a timestamp the fingerprint can use", () => {
    const d = open();
    const missing = d
      .prepare("SELECT COUNT(*) AS n FROM articles WHERE status='published' AND (updated_at IS NULL OR updated_at='')")
      .get().n;
    const sample = d.prepare("SELECT updated_at FROM articles LIMIT 1").get().updated_at;
    d.close();
    assert.equal(missing, 0, "a published article without updated_at is invisible to the fingerprint");
    assert.match(
      sample,
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
      "millisecond resolution — at one-second resolution two saves in the same second collide"
    );
  });

  test("two edits inside the same second produce different fingerprints", async () => {
    // The reason for millisecond timestamps, asserted rather than assumed.
    const row = articleBySlug("freshness-new");
    const first = await saveArticle(row, { body_md: "Edit A." }).then(() => fingerprint());
    const second = await saveArticle(articleBySlug("freshness-new"), { body_md: "Edit B." }).then(() =>
      fingerprint()
    );
    assert.notEqual(second, first, "back-to-back edits must not share a fingerprint");
  });
});

describe("retrieval freshness — it costs no body reads", { skip }, () => {
  test("[16] the fingerprint is answered from an index, not from rows", () => {
    const d = open();
    const plan = d.prepare(`EXPLAIN QUERY PLAN ${FINGERPRINT_SQL}`).all().map((r) => r.detail).join(" | ");
    d.close();
    assert.match(
      plan,
      /COVERING INDEX/i,
      `the freshness check must not touch table rows — plan was: ${plan}`
    );
    assert.match(plan, /idx_articles_fingerprint/, "and it should use the index built for it");
  });

  test("[16] the fingerprint query does not mention article bodies", () => {
    const src = fs.readFileSync(path.join(ROOT, "src/lib/search.ts"), "utf8");
    const fn = src.match(/async function corpusFingerprint[\s\S]*?\n}/);
    assert.ok(fn, "corpusFingerprint should be findable");
    assert.ok(!/body_md/.test(fn[0]), "reading bodies to detect a change defeats the purpose");
    assert.ok(!/SELECT \*/.test(fn[0]), "select only the metadata columns");
    assert.match(fn[0], /COUNT\(\*\)/);
    assert.match(fn[0], /MAX\(updated_at\)/);
  });

  test("the fingerprint cost does not grow with article size", () => {
    // Structural rather than timing-based: rows_read is what D1 bills, and a
    // covering-index aggregate reads index entries, not rows. Proving the plan
    // is covering (above) is the honest form of this claim; here we simply
    // confirm the statement selects no column outside the index.
    const d = open();
    const cols = d.prepare("PRAGMA index_info(idx_articles_fingerprint)").all().map((r) => r.name);
    d.close();
    assert.deepEqual(cols, ["status", "updated_at"], "the index must cover exactly what the query reads");
  });
});

describe("every article write path stamps the timestamp", { skip }, () => {
  test("create, edit, publish and unpublish all move updated_at", async () => {
    const stamp = (slug) => articleBySlug(slug)?.updated_at ?? null;

    await saveArticle(null, { slug: "stamp-probe", title: "Stamp probe" });
    const created = stamp("stamp-probe");
    assert.ok(created, "create must stamp");

    await saveArticle(articleBySlug("stamp-probe"), { body_md: "Edited." });
    const edited = stamp("stamp-probe");
    assert.ok(edited > created, `edit must move the stamp (${created} → ${edited})`);

    await saveArticle(articleBySlug("stamp-probe"), { status: "draft" });
    const unpublished = stamp("stamp-probe");
    assert.ok(unpublished > edited, "unpublish must move the stamp");

    await saveArticle(articleBySlug("stamp-probe"), { status: "published" });
    assert.ok(stamp("stamp-probe") > unpublished, "publish must move the stamp");
  });

  test("the timestamp expression is defined in one place", () => {
    // If a route stamped a coarser timestamp than the fingerprint relies on,
    // the failure would be a rare stale index rather than an error.
    const article = fs.readFileSync(path.join(ROOT, "src/app/api/admin/article/route.ts"), "utf8");
    assert.match(article, /NOW_MS/, "the article editor must use the shared expression");
    assert.ok(
      !/datetime\('now'\)/.test(article),
      "no second-resolution timestamps on a retrieval-visible write"
    );
    const now = fs.readFileSync(path.join(ROOT, "src/lib/now.ts"), "utf8");
    assert.match(now, /%H:%M:%f/, "the shared expression must carry milliseconds");
  });
});
