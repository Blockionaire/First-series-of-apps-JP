/**
 * The production admin bootstrap, against a real local D1.
 *
 * This runs in a deploy pipeline with a password in its environment and its
 * stdout wired to a build log that Cloudflare retains. The interesting
 * assertions are therefore not "does it create an account" but "what does it
 * refuse to do, and what does it refuse to print" — properties that are easy
 * to break later with a well-meaning console.log.
 */
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import bcrypt from "bcryptjs";
import fs from "fs";
import os from "os";
import path from "path";

const ROOT = path.resolve(import.meta.dirname, "..");
const DB = "stai-production";
const EMAIL = "bootstrap-test@stai-ahead.com";
const FIRST = "first-password-long-enough";
const SECOND = "second-password-completely-different";

let stateDir;

/** Run the bootstrap with a given environment; never throws on exit 1. */
function bootstrap(env) {
  const res = execFileSync(
    "node",
    ["scripts/bootstrap-admin.mjs", "--local", "--persist-to", stateDir],
    {
      cwd: ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, CI: "1", STAI_ADMIN_EMAIL: "", STAI_ADMIN_PASSWORD: "", ...env },
      // Exit 1 is a valid outcome under test, not a harness failure.
      shell: false,
    }
  );
  return res;
}

/** Same, but capture output and status when a non-zero exit is expected. */
function bootstrapExpectingFailure(env) {
  try {
    const out = bootstrap(env);
    return { status: 0, out };
  } catch (e) {
    return { status: e.status ?? 1, out: `${e.stdout ?? ""}${e.stderr ?? ""}` };
  }
}

function query(sql) {
  const out = execFileSync(
    "npx",
    ["wrangler", "d1", "execute", DB, "--local", "--persist-to", stateDir, "--json", "--command", sql],
    { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, CI: "1" } }
  );
  return JSON.parse(out.slice(out.indexOf("[")))[0].results;
}

before(() => {
  stateDir = fs.mkdtempSync(path.join(os.tmpdir(), "stai-bootstrap-"));
  execFileSync(
    "npx",
    ["wrangler", "d1", "migrations", "apply", DB, "--local", "--persist-to", stateDir],
    { cwd: ROOT, stdio: "ignore", env: { ...process.env, CI: "1" } }
  );
});

after(() => {
  if (stateDir) fs.rmSync(stateDir, { recursive: true, force: true });
});

describe("production admin bootstrap", () => {
  test("no secrets is a normal skip, not a failure", () => {
    const out = bootstrap({});
    assert.match(out, /skipping/);
    // The whole point: after you delete the secrets, deploys must keep working.
    // A non-zero exit here would break every future deploy.
  });

  test("creates the account when it does not exist", () => {
    const out = bootstrap({ STAI_ADMIN_EMAIL: EMAIL, STAI_ADMIN_PASSWORD: FIRST });
    assert.match(out, /created admin account/);

    const [row] = query(`SELECT role, password_hash FROM users WHERE email='${EMAIL}'`);
    assert.equal(row.role, "admin");
    assert.ok(bcrypt.compareSync(FIRST, row.password_hash), "the stored hash must verify");
  });

  test("a second run with a DIFFERENT password does not reset the account", () => {
    const before = query(`SELECT password_hash FROM users WHERE email='${EMAIL}'`)[0].password_hash;

    const out = bootstrap({ STAI_ADMIN_EMAIL: EMAIL, STAI_ADMIN_PASSWORD: SECOND });
    assert.match(out, /admin already exists/);

    const after = query(`SELECT password_hash FROM users WHERE email='${EMAIL}'`)[0].password_hash;
    assert.equal(after, before, "the hash must be untouched");
    assert.ok(bcrypt.compareSync(FIRST, after), "the original password must still work");
    assert.ok(!bcrypt.compareSync(SECOND, after), "the new password must NOT have taken effect");
  });

  test("nothing sensitive is ever printed", () => {
    // Build logs are retained and readable by anyone with dashboard access.
    const created = bootstrap({ STAI_ADMIN_EMAIL: `fresh-${Date.now()}@stai-ahead.com`, STAI_ADMIN_PASSWORD: FIRST });
    const existing = bootstrap({ STAI_ADMIN_EMAIL: EMAIL, STAI_ADMIN_PASSWORD: SECOND });

    for (const out of [created, existing]) {
      assert.ok(!out.includes(FIRST), "the password must never be printed");
      assert.ok(!out.includes(SECOND), "nor the one supplied on a repeat run");
      assert.ok(!/\$2[aby]\$/.test(out), "the bcrypt hash must never be printed");
      assert.ok(!/INSERT INTO/i.test(out), "nor the SQL carrying it");
      assert.ok(!/password_hash/.test(out), "nor the column name in a dumped row");
    }
  });

  test("half-configured secrets fail loudly rather than skipping", () => {
    // Skipping here would leave someone who meant to bootstrap staring at a
    // login page with no account and a green build.
    const { status, out } = bootstrapExpectingFailure({ STAI_ADMIN_EMAIL: EMAIL });
    assert.equal(status, 1);
    assert.match(out, /only one of/);
  });

  test("a short password is refused without being echoed", () => {
    const { status, out } = bootstrapExpectingFailure({
      STAI_ADMIN_EMAIL: "someone@stai-ahead.com",
      STAI_ADMIN_PASSWORD: "tiny",
    });
    assert.equal(status, 1);
    assert.match(out, /at least 12 characters/);
    assert.ok(!out.includes("tiny"), "the rejected password must not appear in the log");
  });

  test("an invalid email is refused", () => {
    const { status, out } = bootstrapExpectingFailure({
      STAI_ADMIN_EMAIL: "not-an-email",
      STAI_ADMIN_PASSWORD: FIRST,
    });
    assert.equal(status, 1);
    assert.match(out, /not a valid address/);
  });

  test("cf:deploy runs the bootstrap between the seed and the deploy", () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
    const deploy = pkg.scripts["cf:deploy"];
    const order = ["d1:migrate:remote", "d1:seed:remote", "d1:admin:remote", "wrangler deploy"];
    let cursor = -1;
    for (const step of order) {
      const at = deploy.indexOf(step);
      assert.ok(at > cursor, `${step} must come after the previous step in cf:deploy`);
      cursor = at;
    }
  });
});
