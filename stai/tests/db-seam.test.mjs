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
   * Code that is knowingly not migrated, and why. Everything outside this has
   * to already satisfy D1's constraints.
   *
   *   src/lib/seed/**         — becomes a deploy-time script; never runs on Workers
   *   src/lib/db.ts           — schema and migrations move to wrangler migrations
   *   src/lib/billing-frozen  — payment mutation, deferred to the paid launch
   *
   * billing-frozen.ts is a whole-file exclusion rather than a marked region
   * inside billing.ts, which is the point of having split it: the quarantine
   * is now a file boundary a bundler can see, not a comment a human has to
   * respect.
   */
  const DEFERRED = ["src/lib/seed/", "src/lib/db.ts", "src/lib/billing-frozen.ts"];

  function migratedSource(file) {
    const r = rel(file);
    if (DEFERRED.some((d) => (d.endsWith("/") ? r.startsWith(d) : r === d))) return "";
    return read(file);
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
    // Node-only by design, and guarded so a Workers bundle never reaches them.
    const NODE_BOOTSTRAP = new Set([
      "src/lib/sql-node.ts", // the Node driver itself
      "src/instrumentation.ts", // opens the local file to apply migrations, behind NEXT_RUNTIME
      "src/lib/db-unavailable.ts", // the Workers replacement FOR db.ts; its db() throws
    ]);
    const offenders = [];
    for (const f of sources("src")) {
      if (NODE_BOOTSTRAP.has(rel(f))) continue;
      if (/\bdb\(\)/.test(migratedSource(f))) offenders.push(rel(f));
    }
    assert.deepEqual(
      offenders,
      [],
      "outside the declared deferred regions and Node bootstrap, everything must go through sql()"
    );

    // …and the bootstrap really is guarded.
    const instr = read(path.join(ROOT, "src/instrumentation.ts"));
    const guarded = instr.match(/if \(process\.env\.NEXT_RUNTIME === "nodejs"\) \{[\s\S]*?\n  \}/);
    assert.ok(guarded, "instrumentation must guard on the runtime");
    assert.ok(guarded[0].includes("./lib/db"), "the database import must be inside the guard");
  });

  test("the seed is generated SQL, not request-path code", () => {
    // The seed used to be a TypeScript module with @named parameters and a
    // synchronous transaction, which is why it needed an exemption here. It is
    // now a generated .sql file applied by `wrangler d1 migrations`/the local
    // runner, so it is not application code at all and the exemption is gone.
    assert.ok(
      !fs.existsSync(path.join(ROOT, "src/lib/seed/run.ts")),
      "the runtime seed runner should be gone; seeding is a deploy step now"
    );
    const seed = fs.readFileSync(path.join(ROOT, "seeds/0001_verified_corpus.sql"), "utf8");
    assert.ok(!/@[a-zA-Z_]\w*\s*[,)]/.test(seed), "generated seed must not use named parameters");
    assert.match(seed, /seed_ledger/, "every seed statement must be ledger-guarded");
  });

  test("sql.ts names no driver at all", () => {
    const src = read(path.join(ROOT, "src/lib/sql.ts"));
    assert.match(src, /export function registerSqlDriver/, "a driver must be installable");
    // This is the whole Workers boundary. A bundler follows any specifier it
    // can resolve — an import, or a require() with a literal string, wherever
    // it sits. So sql.ts must not mention the Node driver in any form. An
    // earlier design kept a lazy `require("./sql-node")` fallback and claimed
    // the registration check hid it; it did not, and every route still had a
    // static path to a native addon.
    assert.ok(
      !/["']\.\/sql-node["']/.test(src.replace(/\/\*[\s\S]*?\*\//g, "")),
      "sql.ts must not reference ./sql-node outside comments"
    );
    assert.match(src, /throw new Error\(/, "an unregistered driver must fail loudly, not silently");
  });

  test("the Node driver is installed by instrumentation, guarded on the runtime", () => {
    const src = read(path.join(ROOT, "src/instrumentation.ts"));
    assert.match(src, /NEXT_RUNTIME === "nodejs"/, "registration must be guarded on the runtime");
    assert.match(src, /await import\("\.\/lib\/sql-node"\)/, "and use a dynamic import inside the guard");
    // A static import here would be compiled for the edge runtime too, where
    // fs and path do not resolve — which is what broke an earlier attempt.
    assert.ok(
      !/^import .*sql-node/m.test(src),
      "sql-node must not be imported at module scope in instrumentation"
    );
  });

  test("the driver slot is global, not per-bundle", () => {
    // Next does not guarantee one instance of a module across bundles. With a
    // module-level `let`, instrumentation registered into its own copy and
    // every route read null — the site booted and answered "db unavailable"
    // on every request while registration looked successful.
    const src = read(path.join(ROOT, "src/lib/sql.ts"));
    assert.match(src, /Symbol\.for\(/, "the driver slot must be keyed on a global symbol");
    assert.match(src, /globalThis/, "and stored on globalThis");
  });

  test("no module-level mutable state outside the files allowed to have it", () => {
    // `let x = ...` at module scope is per-isolate on Workers. That is fine for
    // a cache that validates itself and fatal for anything that counts.
    const allowed = new Map([
      ["src/lib/db.ts", "the better-sqlite3 handle and its shutdown hook — Node only, Phase 3"],
      ["src/lib/sql.ts", "the installed driver"],
      ["src/lib/sql-node.ts", "the better-sqlite3 singleton"],
      ["src/lib/stripe-client.ts", "the Stripe client, alone in a leaf module"],
      ["src/lib/billing-frozen.ts", "frozen payment mutation, deferred to the paid launch"],
      ["src/lib/ai.ts", "the Anthropic client"],
      ["src/lib/ratelimit.ts", "the store slot, plus the in-memory fallback it documents"],
      ["src/lib/search.ts", "the retrieval index, which re-checks its fingerprint per query"],
      [
        "src/lib/newsroom/scheduled.ts",
        // Per-isolate is exactly right here. A cron invocation has no request,
        // so getCloudflareContext() finds nothing and the D1 binding has to come
        // from the env that invocation was handed. This holds that env as a
        // FALLBACK only — the ambient context is tried first — and it is
        // rewritten at the top of every scheduled run, so a stale value could
        // only be read by a run that supplied no env of its own.
        "the cron invocation's env, as a fallback for the request-scoped binding lookup",
      ],
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

  test("the limiter's store slot lives on globalThis, not in a module-level let", () => {
    const src = read(path.join(ROOT, "src/lib/ratelimit.ts"));
    // The exact bug this prevents: Next does not guarantee one instance of a
    // module across bundles, so a module-level `let _store` is registered by
    // instrumentation into a copy no route handler reads. Every route then
    // keeps the in-process default while /api/health — reading yet another
    // copy — cheerfully reports "global". The SQL driver shipped that bug
    // once; the limiter must not repeat it.
    assert.match(src, /Symbol\.for\("stai\.ratelimit\.store"\)/, "the store slot must be global");
    assert.doesNotMatch(
      src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, ""),
      /^let\s+_store/m,
      "a module-level store slot is the bug, not the fix"
    );
  });

  test("the limiter seam names no runtime-specific store", () => {
    // Same rule as src/lib/sql.ts: the interface must not reach for the
    // Durable Object implementation, or a Node build would pull
    // @opennextjs/cloudflare in through the back door.
    const src = read(path.join(ROOT, "src/lib/ratelimit.ts"))
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    assert.doesNotMatch(src, /ratelimit-workers/, "the seam must not import the Workers store");
    assert.doesNotMatch(src, /@opennextjs\/cloudflare/, "nor the OpenNext runtime");
  });

  test("the Durable Object stores counters and nothing about the caller", () => {
    const src = read(path.join(ROOT, "worker/rate-limiter-do.ts"));
    const schema = src.match(/CREATE TABLE IF NOT EXISTS bucket[\s\S]*?\)\s*`/)[0];
    // One object per key means the key IS the object, so no IP address, route
    // name or account id ever has to be written to disk. Any new column here
    // deserves to be argued for in review rather than added quietly.
    // Matched as COLUMN DEFINITIONS — an identifier followed by a type — not
    // as bare words. "key" as a bare word matches `PRIMARY KEY`, which is how
    // the first version of this assertion failed against a table that was
    // perfectly fine.
    for (const forbidden of ["ip", "key", "email", "user", "agent", "body", "session"]) {
      assert.doesNotMatch(
        schema,
        new RegExp(`\\b\\w*${forbidden}\\w*\\s+(TEXT|INTEGER|BLOB|REAL|NUMERIC)\\b`, "i"),
        `the bucket table must not persist a "${forbidden}" column`
      );
    }
    assert.match(schema, /count\s+INTEGER/, "a counter");
    assert.match(schema, /reset_at\s+INTEGER/, "and an expiry — that is all it needs");
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

  test("the Workers build replaces the local database with a stub that throws", () => {
    // src/lib/db.ts is the only module importing better-sqlite3. The Workers
    // build swaps it for db-unavailable.ts via NormalModuleReplacementPlugin,
    // which is what keeps a compiled .node binary out of the Worker. If this
    // stub ever returned a fake database instead of throwing, a Workers
    // regression would present as silent data loss rather than an error.
    const stub = read(path.join(ROOT, "src/lib/db-unavailable.ts"));
    for (const fn of ["dbPath", "db"]) {
      const body = stub.match(new RegExp(`export function ${fn}[\\s\\S]*?\\n}`));
      assert.ok(body, `${fn} must exist so the module shape matches db.ts`);
      assert.match(body[0], /throw new Error/, `${fn} must throw, not fake a database`);
    }

    // Export parity, derived rather than hardcoded. A replacement module is
    // only a replacement if it answers to every name the original exports;
    // one missing export surfaces on Workers as "x is not a function", which
    // says nothing about the real cause. Checked by comparing the two files so
    // that adding an export to db.ts fails here until the stub follows.
    const exportsOf = (src) =>
      new Set(
        [...src.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/export function (\w+)/g)].map(
          (m) => m[1]
        )
      );
    const real = exportsOf(read(path.join(ROOT, "src/lib/db.ts")));
    const stubbed = exportsOf(stub);
    const missing = [...real].filter((name) => !stubbed.has(name));
    assert.deepEqual(
      missing,
      [],
      `db-unavailable.ts is missing ${missing.join(", ")} — the Workers build ` +
        "replaces db.ts wholesale, so every export must have a counterpart"
    );

    const config = read(path.join(ROOT, "next.config.ts"));
    assert.match(config, /NormalModuleReplacementPlugin/, "the replacement must be wired up");
    assert.match(
      config,
      /version: `stai-\$\{WORKERS_BUILD \? "workers" : "node"\}`/,
      "the two targets must not share a webpack cache — a Node build that reused " +
        "Workers chunks shipped a server with no database at all"
    );
  });

  test("the last synchronous transactions are declared, not scattered", () => {
    const withTransactions = sources("src")
      .filter((f) => /\.transaction\(/.test(read(f)))
      .map(rel)
      .sort();
    assert.deepEqual(
      withTransactions,
      ["src/lib/billing-frozen.ts", "src/lib/migrate-node.ts", "src/lib/sql-node.ts"],
      "interactive transactions are confined to deferred files — " +
        "a new one anywhere else is a migration blocker that nobody planned for"
    );
  });
});
