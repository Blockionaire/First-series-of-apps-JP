/**
 * The database seam.
 *
 * Phase 0 of the Cloudflare Workers migration moved every query behind the
 * async interface in src/lib/sql.ts. These tests exist to keep it moved: the
 * expensive part of the migration was converting 116 call sites, and a single
 * new `db().prepare(...)` in a page or route silently re-creates the problem.
 *
 * They are pure source assertions — no server, no database — so they run fast
 * and fail loudly in review rather than at deploy time on Workers.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";

const ROOT = path.resolve(import.meta.dirname, "..");

function sources(dir) {
  const out = [];
  const walk = (p) => {
    for (const e of fs.readdirSync(p, { withFileTypes: true })) {
      const full = path.join(p, e.name);
      if (e.isDirectory()) walk(full);
      else if (/\.tsx?$/.test(e.name)) out.push(full);
    }
  };
  walk(path.join(ROOT, dir));
  return out;
}

const rel = (f) => path.relative(ROOT, f);
const read = (f) => fs.readFileSync(f, "utf8");

describe("database seam", () => {
  test("no page, route or component touches better-sqlite3 directly", () => {
    const offenders = [...sources("src/app"), ...sources("src/components")].filter((f) => {
      const src = read(f);
      return /\bdb\(\)/.test(src) || /\.prepare\(/.test(src);
    });
    assert.deepEqual(
      offenders.map(rel),
      [],
      "these must query through src/lib/sql.ts, or they will break on Workers"
    );
  });

  test("better-sqlite3 is loaded at runtime by exactly one module", () => {
    // A type-only import is erased at compile time and never loads the addon,
    // so it is harmless on Workers. A value import is the thing that breaks.
    const importers = sources("src")
      .filter((f) =>
        /^\s*import\s+(?!type\b)[^;]*from\s+"better-sqlite3"|require\("better-sqlite3"\)/m.test(read(f))
      )
      .map(rel);
    assert.deepEqual(
      importers,
      ["src/lib/db.ts"],
      "the native addon must stay behind one module — Workers cannot load it at all"
    );
  });

  test("the seam exposes only what D1 can also do", () => {
    const src = read(path.join(ROOT, "src/lib/sql.ts"));
    const iface = src.match(/export interface Sql \{[\s\S]*?\n\}/);
    assert.ok(iface, "the Sql interface should be findable");
    const methods = [...iface[0].matchAll(/^\s{2}(\w+)[<(]/gm)].map((m) => m[1]).sort();
    assert.deepEqual(
      methods,
      ["all", "batch", "first", "run"],
      "adding a method here means adding it to the D1 implementation too"
    );
    assert.ok(
      !/\bexec\s*\(/.test(iface[0]),
      "no multi-statement exec: schema work belongs in migrations, not in a request"
    );
  });

  /**
   * Code that is knowingly not migrated yet, and why. Everything outside this
   * has to already satisfy D1's constraints.
   *
   *   src/lib/seed/**  — Phase 3: becomes a deploy-time script, never runs on Workers
   *   src/lib/db.ts    — Phase 3: schema and data migrations move to wrangler migrations
   *   billing.ts, but only between the PHASE 2 BOUNDARY marker and syncFromStripe
   */
  function migratedSource(file) {
    const r = rel(file);
    if (r.startsWith("src/lib/seed/") || r === "src/lib/db.ts") return "";
    const src = read(file);
    if (r !== "src/lib/billing.ts") return src;
    const start = src.indexOf("PHASE 2 BOUNDARY");
    const end = src.indexOf("export async function syncFromStripe");
    assert.ok(start !== -1 && end > start, "billing.ts must still declare its Phase 2 boundary");
    return src.slice(0, start) + src.slice(end);
  }

  test("no named SQL parameters reach the seam — D1 accepts only positional", () => {
    const offenders = [];
    for (const f of sources("src")) {
      for (const [, stmt] of migratedSource(f).matchAll(
        /(?:sql\(\)\.(?:all|first|run)|prepare)\(\s*(`[^`]*`|"[^"]*")/g
      )) {
        if (/[\s(,]@[a-zA-Z_]\w*/.test(stmt)) offenders.push(`${rel(f)}: ${stmt.slice(0, 60)}…`);
      }
    }
    assert.deepEqual(offenders, [], "rewrite these with ? placeholders");
  });

  test("the deferred regions are the only synchronous database code left", () => {
    const offenders = [];
    for (const f of sources("src")) {
      const src = migratedSource(f);
      if (rel(f) === "src/lib/sql-node.ts") continue; // the Node implementation itself
      if (/\bdb\(\)/.test(src)) offenders.push(rel(f));
    }
    assert.deepEqual(
      offenders,
      [],
      "outside the declared Phase 2/3 regions, everything must go through sql()"
    );
  });

  test("the seed's named parameters are the known Phase 3 remainder", () => {
    // Not a failure — a ledger. The seed still uses @named parameters and a
    // synchronous transaction because it is about to stop being request-path
    // code entirely. This test fails if that work lands (delete it then) or if
    // the seed grows new statements nobody costed.
    const src = read(path.join(ROOT, "src/lib/seed/run.ts"));
    const named = [...src.matchAll(/VALUES \([^)]*@[a-zA-Z_]/g)].length;
    assert.ok(named > 0, "if the seed no longer uses named parameters, Phase 3 is done — drop this test");
    assert.ok(named <= 6, `seed statements needing a Phase 3 rewrite grew to ${named}`);
  });

  test("a driver can be installed, so a Workers build never reaches better-sqlite3", () => {
    const src = read(path.join(ROOT, "src/lib/sql.ts"));
    assert.match(src, /export function registerSqlDriver/, "a driver must be installable");
    // The require() of ./sql-node has to sit behind the registration check.
    // If it were a top-level import, bundling for Workers would pull the
    // native addon into the graph no matter which driver is installed.
    assert.ok(
      !/^import .*from "\.\/sql-node"/m.test(src),
      "sql-node must not be imported at module scope"
    );
    const resolver = src.match(/export function sql\(\)[\s\S]*?\n}/)[0];
    assert.ok(
      resolver.indexOf("_driver") < resolver.indexOf("sql-node"),
      "the installed driver must be consulted before falling back to better-sqlite3"
    );
  });

  test("no module-level mutable state outside the files allowed to have it", () => {
    // `let x = ...` at module scope is per-isolate on Workers. That is fine for
    // a cache that validates itself and fatal for anything that counts.
    const allowed = new Map([
      ["src/lib/db.ts", "the better-sqlite3 handle and its shutdown hook — Node only, Phase 3"],
      ["src/lib/sql.ts", "the installed driver"],
      ["src/lib/sql-node.ts", "the better-sqlite3 singleton"],
      ["src/lib/billing.ts", "the Stripe client"],
      ["src/lib/ai.ts", "the Anthropic client"],
      ["src/lib/ratelimit.ts", "the store slot, plus the in-memory fallback it documents"],
      ["src/lib/search.ts", "the retrieval index, which re-checks its fingerprint per query"],
    ]);
    const offenders = sources("src")
      .filter((f) => /^let\s+\w+/m.test(read(f)))
      .map(rel)
      .filter((r) => !allowed.has(r));
    assert.deepEqual(
      offenders,
      [],
      "module-level `let` is per-isolate on Workers — justify it here or move it to the database"
    );
  });

  test("the retrieval index validates itself instead of waiting to be told", () => {
    const src = read(path.join(ROOT, "src/lib/search.ts"));
    assert.match(src, /corpusFingerprint/, "the index must fingerprint the corpus");
    const search = src.match(/export async function searchChunks[\s\S]*?\n}/)[0];
    assert.match(
      search,
      /builtFor !== fingerprint/,
      "every query must re-check the fingerprint; an isolate that never receives " +
        "invalidateSearchIndex() would otherwise serve a stale corpus for its whole life"
    );
  });

  test("the rate limiter declares what it can guarantee", () => {
    const src = read(path.join(ROOT, "src/lib/ratelimit.ts"));
    assert.match(src, /scope: "process" \| "global"/, "a store must declare its scope");
    assert.match(src, /export function registerRateLimitStore/, "the store must be replaceable");
    // guard() has to await the store — a forgotten await returns a Promise,
    // which is truthy, and would 429 every single request.
    const guardFn = src.match(/export async function guard[\s\S]*?\n}/)[0];
    assert.match(guardFn, /await rateLimit\(/, "guard must await the store");
  });

  test("every guard() call site awaits it", () => {
    const offenders = [];
    for (const f of sources("src/app")) {
      for (const line of read(f).split("\n")) {
        if (/[^a-z]guard\(req/.test(line) && !/await guard\(req/.test(line)) {
          offenders.push(`${rel(f)}: ${line.trim()}`);
        }
      }
    }
    // An un-awaited guard() is a Promise: truthy, so the route returns it as a
    // response body and every caller is refused. Loud, but only in production.
    assert.deepEqual(offenders, [], "guard() is async now");
  });

  test("the last synchronous transactions are declared, not scattered", () => {
    const withTransactions = sources("src")
      .filter((f) => /\.transaction\(/.test(read(f)))
      .map(rel)
      .sort();
    assert.deepEqual(
      withTransactions,
      ["src/lib/billing.ts", "src/lib/db.ts", "src/lib/seed/run.ts", "src/lib/sql-node.ts"],
      "interactive transactions are a Phase 2/3 problem confined to these files — " +
        "a new one anywhere else is a migration blocker that nobody planned for"
    );
  });
});
