/**
 * Migrate and seed the Worker Previews database — and only that database.
 *
 *   npm run d1:preview:setup                 remote stai-preview (needs `wrangler login`
 *                                            locally, or a Workers Builds token in CI)
 *   node scripts/preview-db.mjs --local --persist-to <dir>
 *                                            the same steps against Wrangler's local D1,
 *                                            which is how the test suite exercises it
 *
 * The target comes from `previews.d1_databases` in wrangler.jsonc, never from
 * the top-level `d1_databases` that production uses. Before anything runs, the
 * script refuses if the preview entry is missing, is not called stai-preview,
 * or shares a database id or name with any production database. A preview
 * setup step that could be pointed at production by one edit would be a
 * production migration with a friendlier name.
 *
 * `wrangler d1 migrations apply` only looks up databases in the top-level list,
 * so the preview database is described to it through a throwaway config that
 * contains that one database and nothing else — not the production binding,
 * not the vars, not the Worker. It is written 0600 and removed in `finally`.
 *
 * Both steps are safe to repeat: migrations are tracked in the preview
 * database's own d1_migrations table, and every seed statement is guarded by
 * the seed_ledger. The seed is the public verified corpus (articles, prompts,
 * signals and two counters) — no users, sessions, events or mail.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const PREVIEW_NAME = "stai-preview";
const SEED = path.join(ROOT, "seeds/0001_verified_corpus.sql");

/** wrangler.jsonc as JSON: comments and trailing commas removed, string contents untouched. */
function readConfig() {
  const raw = fs.readFileSync(path.join(ROOT, "wrangler.jsonc"), "utf8");
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
    } else if (c === "/" && raw[i + 1] === "*") {
      i = raw.indexOf("*/", i + 2) + 1;
    } else {
      out += c;
    }
  }
  return JSON.parse(out.replace(/,(\s*[}\]])/g, "$1"));
}

function fail(message) {
  console.error(`[preview-db] ${message}`);
  process.exit(1);
}

const config = readConfig();
const production = config.d1_databases ?? [];
const preview = (config.previews?.d1_databases ?? []).find((d) => d.binding === "DB");

if (!preview) fail('no "DB" binding under previews.d1_databases in wrangler.jsonc');
if (preview.database_name !== PREVIEW_NAME) fail(`the preview database must be named ${PREVIEW_NAME}, found "${preview.database_name}"`);
if (!/^[0-9a-f-]{36}$/i.test(preview.database_id ?? "")) fail("the preview database_id is missing or malformed");
for (const p of production) {
  if (p.database_id === preview.database_id || p.database_name === preview.database_name) {
    fail(`refusing: the preview database is the production database "${p.database_name}"`);
  }
}

const localIdx = process.argv.indexOf("--local");
const target = localIdx === -1 ? ["--remote"] : ["--local"];
const persistIdx = process.argv.indexOf("--persist-to");
if (persistIdx !== -1) target.push("--persist-to", path.resolve(process.argv[persistIdx + 1]));

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "stai-preview-db-"));
const tmpConfig = path.join(dir, "wrangler.json");
try {
  fs.writeFileSync(
    tmpConfig,
    JSON.stringify({
      name: `${config.name}-preview-db`,
      compatibility_date: config.compatibility_date,
      d1_databases: [
        {
          binding: "DB",
          database_name: preview.database_name,
          database_id: preview.database_id,
          migrations_dir: path.join(ROOT, preview.migrations_dir ?? "migrations"),
        },
      ],
    }),
    { mode: 0o600 }
  );

  const wrangler = (args) =>
    execFileSync("npx", ["wrangler", "d1", ...args, "--config", tmpConfig, ...target], {
      cwd: ROOT,
      stdio: "inherit",
      // `migrations apply` has no --yes flag; it auto-confirms under CI.
      env: { ...process.env, CI: "1" },
    });

  console.log(`[preview-db] migrating ${PREVIEW_NAME} (${target[0].slice(2)})`);
  wrangler(["migrations", "apply", PREVIEW_NAME]);

  console.log(`[preview-db] seeding ${PREVIEW_NAME} with the public verified corpus`);
  wrangler(["execute", PREVIEW_NAME, `--file=${SEED}`, "--yes"]);

  console.log(`[preview-db] ${PREVIEW_NAME} is ready`);
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
