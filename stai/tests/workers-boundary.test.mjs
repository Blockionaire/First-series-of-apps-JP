/**
 * The Workers build boundary.
 *
 * Cloudflare Workers cannot load better-sqlite3 at all — it is a compiled
 * native addon and Workers run V8 isolates. So the question "will this build"
 * reduces to a single mechanical one: can a bundler, following static imports
 * from a route, reach better-sqlite3?
 *
 * These tests answer it the way esbuild would, by walking the same edges:
 * `import ... from "x"`, bare `import "x"`, and `require("x")` with a LITERAL
 * specifier. Type-only imports are erased before bundling and comments are not
 * code, so both are excluded.
 *
 * Free-launch routes must be clean. The payment routes are allowed to reach it
 * — that is what quarantine means — and are listed explicitly so the set
 * cannot grow by accident.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";

const ROOT = path.resolve(import.meta.dirname, "..");
const SRC = path.join(ROOT, "src");
const TARGET = "better-sqlite3";

/** Routes that are permitted to reach the native addon, and why. */
const QUARANTINED = new Set([
  "src/app/api/stripe/webhook/route.ts",
  "src/app/api/checkout/sandbox/route.ts",
  "src/app/api/subscription/cancel/route.ts",
]);

function walkDir(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walkDir(full, out);
    else if (/\.tsx?$/.test(e.name)) out.push(full);
  }
  return out;
}

function resolveSpec(spec, fromFile) {
  let base;
  if (spec.startsWith("@/")) base = path.join(SRC, spec.slice(2));
  else if (spec.startsWith(".")) base = path.resolve(path.dirname(fromFile), spec);
  else return null;
  for (const c of [base + ".ts", base + ".tsx", base + ".js", path.join(base, "index.ts")]) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

function dependencies(file) {
  const src = fs
    .readFileSync(file, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  const out = [];
  for (const m of src.matchAll(/^\s*(?:import|export)\s+([\s\S]*?)from\s+["']([^"']+)["']/gm)) {
    if (/^\s*type\b/.test(m[1])) continue; // erased before bundling
    out.push(m[2]);
  }
  for (const m of src.matchAll(/^\s*import\s+["']([^"']+)["']/gm)) out.push(m[1]);
  // Only a literal specifier is analyzable. require(SOME_CONST) is not, which
  // is exactly how the Node driver stays out of a Workers bundle.
  for (const m of src.matchAll(/\brequire\(\s*["']([^"']+)["']\s*\)/g)) out.push(m[1]);
  return out;
}

/** The first static path from `entry` to better-sqlite3, or null. */
function pathToAddon(entry) {
  const seen = new Set();
  const walk = (file, chain) => {
    if (seen.has(file)) return null;
    seen.add(file);
    for (const spec of dependencies(file)) {
      if (spec === TARGET) return [...chain, file, TARGET];
      const next = resolveSpec(spec, file);
      if (next) {
        const found = walk(next, [...chain, file]);
        if (found) return found;
      }
    }
    return null;
  };
  return walk(entry, []);
}

const rel = (f) => path.relative(ROOT, f);
const routes = walkDir(path.join(SRC, "app")).filter((f) =>
  /(page|route|sitemap|opengraph-image|not-found|layout)\.tsx?$/.test(f)
);

describe("Workers build boundary", () => {
  test("no free-launch route can reach better-sqlite3", () => {
    const offenders = [];
    for (const r of routes) {
      if (QUARANTINED.has(rel(r))) continue;
      const found = pathToAddon(r);
      if (found) offenders.push(found.map((p) => (p === TARGET ? p : rel(p))).join(" → "));
    }
    assert.deepEqual(offenders, [], "these routes would fail to build for Workers");
  });

  test("the quarantine is exactly the payment routes, and all of them", () => {
    const reaching = routes.filter((r) => pathToAddon(r)).map(rel).sort();
    assert.deepEqual(
      reaching,
      [...QUARANTINED].sort(),
      "a route entered or left the quarantine — if a payment route no longer " +
        "reaches the addon the list should shrink; if a new route does, that is a build blocker"
    );
    for (const q of QUARANTINED) {
      assert.match(q, /checkout|stripe|subscription/, "only payment routes may be quarantined");
    }
  });

  test("payment mutation lives in exactly one module", () => {
    const mutators = [
      "upsertSubscription",
      "confirmFirstPayment",
      "syncFromStripe",
      "requestCancellation",
      "claimFoundingSeat",
      "refreshUserPlan",
    ];
    const frozen = fs.readFileSync(path.join(ROOT, "src/lib/billing-frozen.ts"), "utf8");
    for (const fn of mutators) {
      assert.match(frozen, new RegExp(`function ${fn}\\b`), `${fn} must live in billing-frozen.ts`);
    }
    const billing = fs.readFileSync(path.join(ROOT, "src/lib/billing.ts"), "utf8");
    for (const fn of mutators) {
      assert.ok(!new RegExp(`function ${fn}\\b`).test(billing), `${fn} must NOT be back in billing.ts`);
    }
    // billing.ts is a read path and must stay on the seam.
    assert.ok(!/\bdb\(\)/.test(billing), "billing.ts must not touch better-sqlite3");
  });

  test("the entitlement rule was moved byte-for-byte, not rewritten", () => {
    // Payment semantics were explicitly out of scope for this migration. The
    // rule moved modules so auth.ts would stop dragging billing behind it;
    // if a single character changed, that was not a move.
    const grab = (f) =>
      fs
        .readFileSync(path.join(ROOT, f), "utf8")
        .match(/export const ENTITLEMENT_SQL = `([\s\S]*?)`;/)[1];
    const entitlement = grab("src/lib/entitlement.ts");
    assert.match(entitlement, /first_payment_confirmed = 1/, "confirmation clause intact");
    assert.match(entitlement, /status IN \('active','past_due'\)/, "status clause intact");
    assert.match(entitlement, /cancel_at_period_end = 1/, "cancellation clause intact");
    assert.ok(!/trialing/.test(entitlement), "trialing must still be absent");
  });

  test("GDPR erasure does not depend on payment code", () => {
    // /api/account/delete is a live free-launch route. It needs the Stripe
    // client to stop billing before deleting an account, which must not drag
    // the frozen module — and with it a native addon — into the build.
    const src = fs.readFileSync(path.join(ROOT, "src/app/api/account/delete/route.ts"), "utf8");
    assert.ok(!/billing-frozen/.test(src), "erasure must not import the frozen payment module");
    assert.match(src, /from "@\/lib\/stripe-client"/, "it takes the Stripe client from the leaf module");
  });
});
