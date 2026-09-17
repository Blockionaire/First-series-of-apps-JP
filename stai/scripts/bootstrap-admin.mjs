/**
 * One-time production admin bootstrap, driven by Cloudflare Build Secrets.
 *
 * Runs inside `npm run cf:deploy`, after migrations and the seed and before
 * `wrangler deploy`. It exists because the admin account needs a password, and
 * a password cannot live in the repository, in wrangler.jsonc, or in a plain
 * build variable. Cloudflare Build Secrets are encrypted at rest and exposed
 * to the build process as environment variables, which is the only channel
 * here that does not put the password in git.
 *
 *   STAI_ADMIN_EMAIL     the account to create
 *   STAI_ADMIN_PASSWORD  its password, hashed here and never transmitted
 *
 * ── The four rules this file exists to enforce ───────────────────────────
 *
 * 1. ABSENT SECRETS ARE NORMAL, NOT AN ERROR. Once the admin exists you are
 *    meant to delete both secrets from Cloudflare. Every deploy after that
 *    finds nothing, says so, and exits 0. A deploy pipeline that breaks when
 *    you remove a one-time credential is a pipeline nobody dares clean up.
 *
 * 2. NEVER RESET AN EXISTING ACCOUNT. The account is created only if that
 *    email is absent. Two guards, because one is a single typo away from
 *    being wrong: an explicit existence check first, and ON CONFLICT DO
 *    NOTHING on the insert itself. Re-running cannot reset a password that
 *    was changed in the product.
 *
 * 3. NOTHING SENSITIVE REACHES THE LOG. Build logs are retained by Cloudflare
 *    and readable by anyone with dashboard access. This file never prints the
 *    password, never prints the bcrypt hash, and never prints the SQL that
 *    carries the hash. wrangler's own output is captured rather than inherited
 *    for the same reason — the insert statement passes through it.
 *
 *    The email IS printed. It is not a secret, it is the thing you need to see
 *    to know which account was created, and it is about to be published on a
 *    login screen anyway.
 *
 * 4. THE HASH NEVER PERSISTS. It goes to a temp file because `d1 execute`
 *    takes a file, and that file is written 0600 and deleted in a finally
 *    block so it disappears even when the command throws.
 *
 * ── Why not reuse scripts/admin-sql.mjs ──────────────────────────────────
 * That script PRINTS the SQL, which is exactly right for a human piping it to
 * a file they control, and exactly wrong here: in a build log, stdout is the
 * log. Same bcrypt call, opposite output discipline.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import bcrypt from "bcryptjs";

const DB = "stai-production";
const MIN_PASSWORD = 12;

const email = process.env.STAI_ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.STAI_ADMIN_PASSWORD;

/** Rule 1: nothing configured is a normal steady state, not a failure. */
if (!email && !password) {
  console.log("[admin] no bootstrap secrets set — skipping (this is normal after the first deploy)");
  process.exit(0);
}

// One without the other is a misconfiguration worth stopping for: it means
// somebody intended to bootstrap and got it half right, and skipping quietly
// would leave them staring at a login page wondering why.
if (!email || !password) {
  console.error(
    "[admin] only one of STAI_ADMIN_EMAIL / STAI_ADMIN_PASSWORD is set — " +
      "set both to bootstrap, or neither to skip"
  );
  process.exit(1);
}
if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
  console.error("[admin] STAI_ADMIN_EMAIL is not a valid address");
  process.exit(1);
}
if (password.length < MIN_PASSWORD) {
  // Deliberately reports the requirement, never the length supplied.
  console.error(`[admin] the admin password must be at least ${MIN_PASSWORD} characters`);
  process.exit(1);
}

const esc = (s) => String(s).replace(/'/g, "''");

/**
 * Run a wrangler d1 subcommand, capturing output rather than inheriting it.
 *
 * `stdio: pipe` is the load-bearing part. With "inherit", wrangler echoes the
 * statement it is executing straight into the build log — which for the insert
 * below would publish the bcrypt hash to anyone with dashboard access.
 */
// Defaults to the production database. `--local` (with an optional
// `--persist-to <dir>`) points the same code at Wrangler's local D1, which is
// what the test suite uses — a security-sensitive script that cannot be
// exercised end to end is a script whose guards are decorative.
const localIdx = process.argv.indexOf("--local");
const target = localIdx === -1 ? ["--remote"] : ["--local"];
const persistIdx = process.argv.indexOf("--persist-to");
if (persistIdx !== -1) target.push("--persist-to", process.argv[persistIdx + 1]);

function d1(args) {
  return execFileSync("npx", ["wrangler", "d1", "execute", DB, ...target, "--yes", ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, CI: "1" },
  });
}

/** Parse the JSON envelope wrangler prints around query results. */
function rowsOf(out) {
  const start = out.indexOf("[");
  if (start === -1) throw new Error("could not parse wrangler output");
  return JSON.parse(out.slice(start))[0].results;
}

let tmp;
try {
  // Rule 2, first guard.
  const existing = rowsOf(
    d1(["--json", "--command", `SELECT role FROM users WHERE email = '${esc(email)}'`])
  );

  if (existing.length > 0) {
    console.log("admin already exists");
    if (existing[0].role !== "admin") {
      // Worth saying: the account is there but cannot reach /admin, and this
      // script will not change it — promoting an existing user is a decision,
      // not a deploy step.
      console.error(
        `[admin] warning: ${email} exists but its role is not "admin"; ` +
          "promote it in the database if that is wrong"
      );
    }
    process.exit(0);
  }

  const hash = bcrypt.hashSync(password, 10);

  // Rule 4: 0600, and removed in the finally below whatever happens.
  tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "stai-admin-")), "admin.sql");
  fs.writeFileSync(
    tmp,
    `INSERT INTO users (email, password_hash, name, firm, role, plan)
     VALUES ('${esc(email)}', '${esc(hash)}', 'The Desk', 'STAI', 'admin', 'free')
     ON CONFLICT(email) DO NOTHING;\n`,
    { mode: 0o600 }
  );

  d1(["--file", tmp]); // Rule 2, second guard, and rule 3: output discarded.

  // Read back rather than trusting the write. A silent no-op here would mean
  // you cannot sign in, and you would not find out until you tried.
  const created = rowsOf(
    d1(["--json", "--command", `SELECT role FROM users WHERE email = '${esc(email)}'`])
  );
  if (created.length === 0 || created[0].role !== "admin") {
    console.error("[admin] the account was not created — check the D1 logs");
    process.exit(1);
  }

  console.log(`[admin] created admin account for ${email}`);
  console.log("[admin] you can now delete STAI_ADMIN_EMAIL and STAI_ADMIN_PASSWORD from Cloudflare");
} catch (err) {
  // Print only our own message. An exception from execFileSync carries the
  // full command line, which for the insert includes nothing sensitive (the
  // SQL is in a file, not an argument) — but stderr from wrangler could still
  // quote file contents, so it is not forwarded.
  console.error(`[admin] bootstrap failed: ${err instanceof Error ? err.message.split("\n")[0] : "unknown error"}`);
  process.exit(1);
} finally {
  if (tmp) fs.rmSync(path.dirname(tmp), { recursive: true, force: true });
}
