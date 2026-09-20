/**
 * Free-launch guarantees.
 *
 * Boots the real production server in the intended launch configuration — no
 * Stripe key, no Anthropic key, no mail transport — and asserts the properties
 * that make it safe to put in front of a real auditor.
 */
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import Database from "better-sqlite3";
import fs from "fs";
import os from "os";
import path from "path";

const PORT = Number(process.env.FREE_TEST_PORT ?? 3197);
const BASE = `http://127.0.0.1:${PORT}`;
const ROOT = path.resolve(import.meta.dirname, "..");
const STANDALONE = path.join(ROOT, ".next/standalone/server.js");
const hasBuild = fs.existsSync(STANDALONE);

let dataDir, server;

before(async () => {
  if (!hasBuild) return;
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "stai-free-"));
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
      STAI_ADMIN_EMAIL: "",
      STAI_ADMIN_PASSWORD: "",
    },
    stdio: "ignore",
  });
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    try { if ((await fetch(`${BASE}/api/health`)).ok) break; } catch {}
    await new Promise((r) => setTimeout(r, 400));
  }
});

after(() => {
  server?.kill("SIGTERM");
  if (dataDir) fs.rmSync(dataDir, { recursive: true, force: true });
});

const db = () => new Database(path.join(dataDir, "stai.db"), { readonly: true });

describe("free launch", { skip: hasBuild ? false : "no standalone build" }, () => {
  test("no fabricated content is published", () => {
    const d = db();
    const authors = d.prepare("SELECT DISTINCT author FROM articles WHERE status='published'").all();
    const podcasts = d.prepare("SELECT COUNT(*) AS n FROM podcasts").get().n;
    const research = d.prepare("SELECT COUNT(*) AS n FROM research").get().n;
    const uses = d.prepare("SELECT COALESCE(SUM(uses),0) AS n FROM prompts").get().n;
    // The six unverifiable articles used to be seeded and then unpublished by
    // a corrective migration. On a clean D1 database they are never seeded at
    // all, which is a stronger guarantee: absent beats draft, because a draft
    // is one accidental click from being live.
    const fabricated = d
      .prepare(
        `SELECT COUNT(*) AS n FROM articles WHERE slug IN (
           'afm-thematic-review-ai-audit-firms','esma-cra-model-governance-fine',
           'iaasb-signals-isa-500-refresh','copilot-audit-room-90-day-field-report',
           'materiality-for-model-risk','big-four-ai-arms-race-audited')`
      )
      .get().n;
    const published = d.prepare("SELECT COUNT(*) AS n FROM articles WHERE status='published'").get().n;
    d.close();
    assert.deepEqual(authors.map((a) => a.author), ["STAI Editorial"], "one transparent byline only");
    assert.equal(podcasts, 0, "no invented podcast episodes");
    assert.equal(research, 0, "no invented research citations");
    assert.equal(uses, 0, "no fabricated usage counters");
    assert.equal(fabricated, 0, "unverifiable articles must not exist in the database at all");
    assert.equal(published, 11, "the verified corpus is exactly 11 articles");
  });

  test("no invented persona appears on any public page", async () => {
    const personas = ["Marieke van Dijk", "Jonas Keller", "Sofia Lindqvist", "Tom Verhagen", "Henrik Dalgaard"];
    for (const p of ["/", "/briefing", "/podcast", "/research", "/authors/stai-editorial"]) {
      const html = await (await fetch(BASE + p)).text();
      for (const persona of personas) {
        assert.ok(!html.includes(persona), `${persona} still appears on ${p}`);
      }
    }
  });

  test("STAI+ is an early-access waitlist, not a purchase", async () => {
    const html = await (await fetch(`${BASE}/plus`)).text();
    assert.ok(html.includes("Early access"), "the early-access proposition should be shown");
    assert.ok(!html.includes("Start monthly"), "no purchase buttons");
    assert.ok(!html.includes("Claim seat"), "no founding-seat purchase");
    const res = await fetch(`${BASE}/api/checkout/sandbox`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plan: "founding" }),
    });
    assert.equal(res.status, 404, "sandbox checkout must not exist in production");
  });

  test("early access records a registration and its interests", async () => {
    const email = `ea-${Date.now()}@test.eu`;
    const res = await fetch(`${BASE}/api/early-access`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, firm: "Test", role: "Audit partner", interests: ["brief", "prompts"] }),
    });
    assert.equal(res.status, 200);
    const d = db();
    const row = d.prepare("SELECT interests FROM early_access WHERE email=?").get(email);
    d.close();
    assert.ok(row, "registration persisted");
    assert.deepEqual(JSON.parse(row.interests), ["brief", "prompts"]);
  });

  test("the Brief waitlist promises nothing it cannot deliver", async () => {
    const res = await fetch(`${BASE}/api/newsletter`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: `brief-${Date.now()}@test.eu` }),
    });
    assert.equal(res.status, 200);
    const d = db();
    const outbox = d.prepare("SELECT COUNT(*) AS n FROM outbox").get().n;
    d.close();
    assert.equal(outbox, 0, "no mail may be queued while there is no transport and no sending job");
  });

  test("analytics accepts only known first-party events", async () => {
    const ok = await fetch(`${BASE}/api/track`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "page_view", path: "/briefing" }),
    });
    assert.equal(ok.status, 200);
    for (const bad of [{ kind: "evil", path: "/x" }, { kind: "page_view", path: "https://evil.com" }]) {
      const res = await fetch(`${BASE}/api/track`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(bad),
      });
      assert.equal(res.status, 400, `should reject ${JSON.stringify(bad)}`);
    }
  });

  test("the back office is not counted as traffic", async () => {
    const post = (path) =>
      fetch(`${BASE}/api/track`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "page_view", path }),
      });

    const before = db();
    const n0 = before.prepare("SELECT COUNT(*) AS n FROM events WHERE kind='page_view'").get().n;
    before.close();

    // Admin surfaces record nothing, and are not handed a visitor token —
    // otherwise looking at the dashboard would inflate the dashboard.
    for (const p of ["/admin", "/admin/growth", "/admin/people"]) {
      const res = await post(p);
      assert.equal(res.status, 200, `${p} should be accepted but ignored`);
      assert.equal((await res.json()).recorded, false, `${p} must not be recorded`);
      assert.equal(
        res.headers.getSetCookie().filter((c) => c.startsWith("stai_v=")).length,
        0,
        `${p} must not mint a visitor token`
      );
    }

    // Whole segments only. A bare startsWith("/admin") would swallow this one,
    // and any future public path that merely begins with those letters.
    for (const p of ["/administrators", "/account"]) {
      assert.equal((await (await post(p)).json()).recorded, undefined, `${p} should still be recorded`);
    }

    const after = db();
    const rows = after
      .prepare("SELECT path FROM events WHERE kind='page_view' ORDER BY id DESC LIMIT 12")
      .all()
      .map((r) => r.path);
    const n1 = after.prepare("SELECT COUNT(*) AS n FROM events WHERE kind='page_view'").get().n;
    after.close();

    assert.ok(!rows.some((p) => p === "/admin" || p.startsWith("/admin/")), `admin paths leaked: ${rows}`);
    assert.ok(rows.includes("/administrators"), "the non-admin lookalike should be there");
    assert.equal(n1 - n0, 2, "exactly the two public paths should have been added");
  });

  test("analytics stores no identifying data", () => {
    const d = db();
    const cols = d.prepare("PRAGMA table_info(events)").all().map((c) => c.name);
    d.close();
    for (const forbidden of ["ip", "ip_address", "user_agent", "user_id", "referrer"]) {
      assert.ok(!cols.includes(forbidden), `events table must not carry ${forbidden}`);
    }
  });

  test("Ask STAI works without an AI key and labels itself honestly", async () => {
    const res = await fetch(`${BASE}/api/ask`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: "What does ISQM 1 require for AI tools?" }),
    });
    assert.equal(res.status, 200);
    const text = await res.text();
    assert.ok(text.includes('"sources"'), "cited sources are returned");
    assert.ok(/Retrieval mode/i.test(text), "retrieval-only mode must be labelled, not passed off as generated");
  });

  test("admin surfaces reject anonymous users", async () => {
    for (const [p, expected] of [
      ["/admin", 307],
      ["/admin/growth", 307],
      ["/admin/people", 307],
      ["/api/admin/early-access.csv", 403],
      ["/api/admin/export/accounts", 403],
      ["/api/admin/export/newsletter", 403],
    ]) {
      const res = await fetch(BASE + p, { redirect: "manual" });
      assert.equal(res.status, expected, `${p} should return ${expected}`);
    }
  });

  test("no admin account exists without explicit credentials", () => {
    const d = db();
    const n = d.prepare("SELECT COUNT(*) AS n FROM users WHERE role='admin'").get().n;
    d.close();
    assert.equal(n, 0);
  });
});
