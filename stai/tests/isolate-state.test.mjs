/**
 * Process-local state.
 *
 * Phase 1 of the Workers migration removed the app's dependence on state that
 * lives in one process. Two things were relying on it, and both failed
 * SILENTLY rather than loudly — which is what makes them worth a test suite of
 * their own:
 *
 *   - the rate limiter counted into a module-level Map, so on Workers every
 *     isolate would start from zero and "5 per hour" would mean nothing;
 *   - the retrieval index was invalidated by a function call, which reaches
 *     one isolate out of however many are serving.
 *
 * Neither would have shown up in a request log, a 500, or a failing assertion
 * anywhere else in this suite.
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

const ADMIN_EMAIL = "isolate-admin@test.eu";
const ADMIN_PASSWORD = "isolate-admin-password";

/**
 * Two servers over ONE database directory.
 *
 * This is the closest honest local model of the Workers execution model: two
 * independent processes, each with its own module scope, serving the same
 * data. Anything that only works because both requests happened to land in the
 * same process shows up here as a failure.
 */
const PORT_A = Number(process.env.ISOLATE_TEST_PORT ?? 3199);
const PORT_B = PORT_A + 1;
const A = `http://127.0.0.1:${PORT_A}`;
const B = `http://127.0.0.1:${PORT_B}`;

let dataDir;
const servers = [];

function start(port) {
  return spawn("node", [STANDALONE], {
    cwd: ROOT,
    env: {
      ...process.env,
      NODE_ENV: "production",
      PORT: String(port),
      HOSTNAME: "127.0.0.1",
      STAI_DATA_DIR: dataDir,
      APP_URL: `http://127.0.0.1:${port}`,
      STRIPE_SECRET_KEY: "",
      ANTHROPIC_API_KEY: "",
      RESEND_API_KEY: "",
      STAI_ADMIN_EMAIL: ADMIN_EMAIL,
      STAI_ADMIN_PASSWORD: ADMIN_PASSWORD,
    },
    stdio: "ignore",
  });
}

async function waitHealthy(base) {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    try {
      if ((await fetch(`${base}/api/health`)).ok) return true;
    } catch {}
    await new Promise((r) => setTimeout(r, 400));
  }
  return false;
}

before(async () => {
  if (!hasBuild) return;
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "stai-isolate-"));
  // Serially: the first boot creates the schema and seeds, and two processes
  // racing to migrate the same fresh file is not what this test is about.
  servers.push(start(PORT_A));
  await waitHealthy(A);
  servers.push(start(PORT_B));
  await waitHealthy(B);
});

after(() => {
  for (const s of servers) s.kill("SIGTERM");
  if (dataDir) fs.rmSync(dataDir, { recursive: true, force: true });
});

async function login(base) {
  const res = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  assert.equal(res.status, 200, "admin login should succeed");
  return res.headers.getSetCookie().find((c) => c.startsWith("stai_session=")).split(";")[0];
}

describe("state that must not live in one process", { skip }, () => {
  test("an edit on one instance is visible to retrieval on the other", async () => {
    // The real regression this guards: instance B has already built and cached
    // its retrieval index. An article is then published through instance A.
    // Nothing tells B. Under the old invalidateSearchIndex() design B would go
    // on citing the old corpus for the life of the isolate.
    const probe = `Zarvinex Protocol ${Date.now()}`;

    // Warm B's index so this is a genuine staleness test, not a cold start.
    const warm = await fetch(`${B}/api/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: "ISQM 1 quality management" }),
    });
    assert.equal(warm.status, 200);
    const beforeText = await warm.text();
    assert.ok(!beforeText.includes(probe), "precondition: the probe is not in the corpus yet");

    // Publish through A.
    const cookie = await login(A);
    const save = await fetch(`${A}/api/admin/article`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({
        slug: "isolate-staleness-probe",
        title: probe,
        dek: "Written on one instance, read from another.",
        category: "Analysis",
        tags: "probe",
        author: "STAI Editorial",
        author_role: "Editorial desk",
        published_at: "2026-01-01",
        reading_min: 1,
        featured: 0,
        urgency: 1,
        premium: false,
        status: "published",
        body_md: `## ${probe}\n\nThe ${probe} is a unique marker used to prove that a retrieval index rebuilt on a different instance.`,
      }),
    });
    assert.equal(save.status, 200, await save.text());

    // Ask B. It never received an invalidation call.
    const after = await fetch(`${B}/api/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: probe }),
    });
    assert.equal(after.status, 200);
    const afterText = await after.text();
    assert.ok(
      afterText.includes(probe),
      "instance B must rebuild from the corpus fingerprint, not wait to be told"
    );
  });

  test("unpublishing on one instance removes it from the other's citations", async () => {
    const cookie = await login(A);
    const d = new Database(path.join(dataDir, "stai.db"), { readonly: true });
    const row = d.prepare("SELECT * FROM articles WHERE slug='isolate-staleness-probe'").get();
    d.close();
    assert.ok(row, "the probe article should exist from the previous test");

    // Precondition, asserted rather than assumed: B must currently be citing
    // the article. Without this the test passes trivially whenever B's index
    // never contained it — which is exactly what a broken cache looks like.
    const warm = await fetch(`${B}/api/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: row.title }),
    });
    const warmText = await warm.text();
    const warmEnvelope = JSON.parse(warmText.slice(0, warmText.indexOf("\x1e")));
    assert.ok(
      warmEnvelope.sources.some((s) => s.slug === "isolate-staleness-probe"),
      "precondition: instance B should be citing the published probe before it is taken down"
    );

    const res = await fetch(`${A}/api/admin/article`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({
        id: row.id,
        slug: row.slug,
        title: row.title,
        dek: row.dek,
        category: row.category,
        tags: "probe",
        author: row.author,
        author_role: row.author_role,
        published_at: row.published_at,
        reading_min: row.reading_min,
        featured: 0,
        urgency: 1,
        premium: false,
        status: "draft",
        body_md: row.body_md,
      }),
    });
    assert.equal(res.status, 200);

    const after = await fetch(`${B}/api/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: row.title }),
    });
    const text = await after.text();
    // The citation list is the part that matters: an unpublished article must
    // not be offered as a source anywhere.
    const envelope = JSON.parse(text.slice(0, text.indexOf("\x1e")));
    assert.ok(
      !envelope.sources.some((s) => s.slug === "isolate-staleness-probe"),
      "a draft must not survive as a citation on an instance that cached it while published"
    );
  });

  test("the corpus fingerprint moves when an article is edited", () => {
    const d = new Database(path.join(dataDir, "stai.db"), { readonly: true });
    const cols = d.prepare("PRAGMA table_info(articles)").all().map((c) => c.name);
    const stamped = d
      .prepare("SELECT COUNT(*) AS n FROM articles WHERE updated_at IS NOT NULL")
      .get().n;
    d.close();
    assert.ok(cols.includes("updated_at"), "articles.updated_at must exist");
    assert.ok(stamped >= 1, "the admin editor must stamp updated_at, or the fingerprint never moves");
  });

  test("the rate limiter reports the scope it can actually guarantee", async () => {
    const health = await (await fetch(`${A}/api/health`)).json();
    assert.ok(health.limiter, "health must report limiter state");
    assert.ok(
      ["process", "global"].includes(health.limiter.scope),
      `unexpected limiter scope: ${health.limiter.scope}`
    );
    assert.equal(
      health.limiter.scope,
      "process",
      "on Node the in-process store is correct and should say so plainly"
    );
    assert.equal(health.limiter.degradations, 0, "no store failures expected on Node");
  });

  test("the limiter still stops a burst within one instance", async () => {
    // /api/newsletter is 5/hour. Use one instance so this asserts the limiter
    // works at all — the cross-instance weakness is what the DO store fixes in
    // Phase 4, and is documented rather than asserted here.
    let blocked = 0;
    for (let i = 0; i < 9; i++) {
      const res = await fetch(`${A}/api/newsletter`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: `burst-${i}-${Date.now()}@test.eu` }),
      });
      if (res.status === 429) {
        blocked++;
        assert.ok(res.headers.get("Retry-After"), "a 429 must tell the caller when to come back");
      }
    }
    assert.ok(blocked > 0, "a burst past the limit must be refused");
  });
});
