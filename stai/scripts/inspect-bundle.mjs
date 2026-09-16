/**
 * Inspect the built Worker bundle for things that must not be in it.
 *
 * Written as a script rather than a test because it answers a deployment
 * question ("what did we actually produce?") and its output is meant to be
 * read, not just asserted on. It exits non-zero when a forbidden artefact is
 * present, so it is still usable in a chain.
 *
 * Run after: npm run cf:build
 */
import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT = path.join(ROOT, ".open-next");

if (!fs.existsSync(OUT)) {
  console.error("no .open-next — run `npm run cf:build` first");
  process.exit(1);
}

const walk = (dir, out = []) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
};

const files = walk(OUT);
const rel = (f) => path.relative(ROOT, f);
let failed = false;

const check = (label, ok, detail) => {
  console.log(`${ok ? "  ok  " : "FAIL  "}${label}${detail ? `: ${detail}` : ""}`);
  if (!ok) failed = true;
};

// ── Native addons ────────────────────────────────────────────────────────
// Workers run V8 isolates and cannot dlopen anything. One .node file here
// means the bundle cannot boot at all.
const addons = files.filter((f) => f.endsWith(".node"));
check("native addons", addons.length === 0, `${addons.length} found ${addons.map(rel).join(", ")}`);

// ── better-sqlite3 and its file-database machinery ───────────────────────
const copied = files.filter((f) => rel(f).includes("better-sqlite3"));
check("better-sqlite3 not copied", copied.length === 0, `${copied.length} paths`);

const handler = path.join(OUT, "server-functions/default/handler.mjs");
const handlerSrc = fs.existsSync(handler) ? fs.readFileSync(handler, "utf8") : "";
for (const needle of ["journal_mode", "wal_checkpoint", "litestream", "PRAGMA busy_timeout"]) {
  check(`no "${needle}" in handler`, !handlerSrc.includes(needle));
}

// The Node driver must have been replaced, not merely unused.
check(
  "db-unavailable stub present in handler",
  /There is no filesystem fallback on Workers/.test(handlerSrc) ||
    /db-unavailable/.test(handlerSrc),
  "the Workers build must swap src/lib/db.ts for the throwing stub"
);

// ── The Durable Object must actually be in the deployed script ───────────
// wrangler bundles worker/entry.ts at `wrangler dev`/`deploy` time rather than
// during the OpenNext build, so the class is checked at its source: if the
// entry stops exporting it, the binding resolves to nothing at runtime.
const entry = fs.readFileSync(path.join(ROOT, "worker/entry.ts"), "utf8");
check("worker entry exports RateLimiterDO", /export\s*\{\s*RateLimiterDO\s*\}/.test(entry));
check("worker entry re-exports the OpenNext default", /export\s*\{\s*default\s*\}/.test(entry));

// ── Size ─────────────────────────────────────────────────────────────────
if (handlerSrc) {
  const raw = fs.statSync(handler).size;
  const gz = Number(
    execFileSync("bash", ["-c", `gzip -c ${JSON.stringify(handler)} | wc -c`], {
      encoding: "utf8",
    }).trim()
  );
  console.log(`\nhandler.mjs : ${(raw / 1e6).toFixed(2)} MB raw / ${(gz / 1e6).toFixed(2)} MB gzipped`);
  // Cloudflare's paid Workers limit is 10 MB gzipped; the free tier is 3 MB.
  check("handler within the 3 MB free-tier gzip limit", gz < 3e6, `${(gz / 1e6).toFixed(2)} MB`);
}

const assetBytes = files
  .filter((f) => rel(f).startsWith(".open-next/assets"))
  .reduce((n, f) => n + fs.statSync(f).size, 0);
console.log(`assets      : ${(assetBytes / 1e6).toFixed(2)} MB`);

process.exit(failed ? 1 : 0);
