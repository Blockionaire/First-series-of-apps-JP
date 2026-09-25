/**
 * Worker Previews stay isolated from production.
 *
 * A Preview gets only what `previews` in wrangler.jsonc declares, so that block
 * is the whole of its reach. These tests pin what it may and may not contain,
 * and prove that the preview database setup script refuses to run against
 * production rather than trusting that nobody will ever edit the id.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const RAW = fs.readFileSync(path.join(ROOT, "wrangler.jsonc"), "utf8");

/** Same comment stripping as scripts/preview-db.mjs, kept independent on purpose. */
function parseJsonc(raw) {
  let out = "";
  let inString = false;
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if (inString) {
      out += c;
      if (c === "\\") out += raw[++i];
      else if (c === '"') inString = false;
    } else if (c === '"') {
      inString = true;
      out += c;
    } else if (c === "/" && raw[i + 1] === "/") {
      while (i < raw.length && raw[i] !== "\n") i++;
      out += "\n";
    } else {
      out += c;
    }
  }
  return JSON.parse(out.replace(/,(\s*[}\]])/g, "$1"));
}

const config = parseJsonc(RAW);
const previews = config.previews;
const productionIds = config.d1_databases.map((d) => d.database_id);

describe("the previews block", () => {
  test("exists and binds its own database", () => {
    assert.ok(previews, "wrangler.jsonc must declare a previews block");
    const db = previews.d1_databases.find((d) => d.binding === "DB");
    assert.equal(db.database_name, "stai-preview");
    assert.match(db.database_id, /^[0-9a-f-]{36}$/);
  });

  test("never names a production database, anywhere", () => {
    const text = JSON.stringify(previews);
    for (const id of productionIds) assert.ok(!text.includes(id), `production database id ${id} appears in previews`);
    for (const d of config.d1_databases) assert.ok(!text.includes(`"${d.database_name}"`), `${d.database_name} appears in previews`);
  });

  test("carries the runtime switch the Worker cannot boot without", () => {
    assert.equal(previews.vars.STAI_RUNTIME, "workers");
    assert.equal(previews.vars.STAI_WORKERS_PLAN, "free");
    assert.equal(previews.vars.APP_URL, "https://stai-ahead.com");
  });

  test("binds the rate limiter to the class production declares", () => {
    const binding = previews.durable_objects.bindings.find((b) => b.name === "RATE_LIMITER");
    assert.equal(binding.class_name, "RateLimiterDO");
    assert.equal(binding.script_name, undefined, "a script_name would bind another Worker's (e.g. production's) namespace");
  });

  test("declares no secrets and no variable that would enable payments, mail, AI or IndexNow", () => {
    assert.equal(previews.secrets, undefined);
    const forbidden = /STRIPE|RESEND|ANTHROPIC|INDEXNOW|STAI_ADMIN|PASSWORD|SECRET|KEY/;
    for (const name of Object.keys(previews.vars)) assert.doesNotMatch(name, forbidden, `${name} must not be a preview var`);
  });

  test("adds nothing that could schedule work", () => {
    assert.equal(previews.triggers, undefined);
    assert.equal(previews.queues, undefined);
    assert.equal(previews.workflows, undefined);
  });
});

describe("scripts/preview-db.mjs refuses anything but stai-preview", () => {
  /** Run a copy of the script next to a tampered wrangler.jsonc; it must stop before reaching wrangler. */
  function runWith(mutate) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "stai-preview-guard-"));
    try {
      fs.mkdirSync(path.join(dir, "scripts"));
      fs.copyFileSync(path.join(ROOT, "scripts/preview-db.mjs"), path.join(dir, "scripts/preview-db.mjs"));
      const cfg = structuredClone(config);
      mutate(cfg);
      fs.writeFileSync(path.join(dir, "wrangler.jsonc"), JSON.stringify(cfg));
      // PATH is emptied so that, if a guard ever failed open, npx could not
      // run at all — the test can never touch a real database.
      execFileSync(process.execPath, [path.join(dir, "scripts/preview-db.mjs"), "--local"], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        env: { PATH: "" },
      });
      return { code: 0, stderr: "" };
    } catch (e) {
      return { code: e.status, stderr: String(e.stderr) };
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }

  test("the production database id", () => {
    const r = runWith((c) => (c.previews.d1_databases[0].database_id = productionIds[0]));
    assert.equal(r.code, 1);
    assert.match(r.stderr, /refusing: the preview database is the production database/);
  });

  test("the production database name", () => {
    const r = runWith((c) => (c.previews.d1_databases[0].database_name = config.d1_databases[0].database_name));
    assert.equal(r.code, 1);
    assert.match(r.stderr, /must be named stai-preview/);
  });

  test("a missing previews block", () => {
    const r = runWith((c) => delete c.previews);
    assert.equal(r.code, 1);
    assert.match(r.stderr, /no "DB" binding under previews/);
  });
});
