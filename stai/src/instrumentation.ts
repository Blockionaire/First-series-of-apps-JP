/**
 * Runtime setup, run once before the server handles anything.
 *
 * This is where the database driver is chosen. It has to be a runtime choice
 * rather than an import, because the two targets cannot share one: Node uses
 * better-sqlite3, a compiled native addon, and Cloudflare Workers cannot load
 * native addons at all. If any module reachable from a page named the Node
 * driver in an import or a literal require, a bundler would follow that edge
 * and the Workers build would fail on every route.
 *
 * So src/lib/sql.ts names no driver. This file installs one.
 *
 * ── Why NEXT_RUNTIME is not the discriminator ────────────────────────────
 * OpenNext runs Next's *node* runtime on Workers, so NEXT_RUNTIME is "nodejs"
 * in BOTH targets. Branching on it would make the Worker try to load
 * better-sqlite3, and the failure would present as a database outage rather
 * than as the misconfiguration it is. STAI_RUNTIME is set explicitly in
 * wrangler.jsonc and is the only thing that distinguishes them.
 *
 * An earlier attempt at instrumentation.ts was deleted because it imported the
 * database at module scope: Next compiles this file for the edge runtime too,
 * where `fs` and `path` do not resolve, and the build broke. The fix is the
 * shape below — dynamic imports INSIDE the guards, so neither the edge compile
 * nor the Workers bundle ever sees a module it cannot load.
 */
export async function register() {
  if (process.env.STAI_RUNTIME === "workers") {
    const { registerWorkersSql } = await import("./lib/sql-workers");
    registerWorkersSql();

    // The rate limiter's default store counts per isolate, which on Workers is
    // no limit at all. Registering the Durable Object store here is what makes
    // `login`, `signup` and `account-delete` real controls rather than
    // decoration. Unlike the database there IS a fallback, by design — see
    // rateLimit() — but it is a floor, not the intended state.
    const { registerWorkersRateLimit } = await import("./lib/ratelimit-workers");
    registerWorkersRateLimit();

    // Deliberately no migration and no seeding here. A Worker boots on every
    // cold isolate; writing schema or content as a side effect of that is the
    // behaviour the seeding rules exist to prevent. Both are deploy steps.
    return;
  }

  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { registerNodeSql } = await import("./lib/sql-node");
    registerNodeSql();

    // Opening the local database applies migrations/*.sql and seeds/*.sql —
    // the same files Wrangler applies to D1 — so a fresh checkout boots into a
    // correct, seeded database with no manual step.
    //
    // This is LOCAL ONLY. On Workers, migrations are applied by
    // `wrangler d1 migrations apply` and seeding is a deliberate deploy step;
    // a Worker must never migrate or seed itself on boot.
    const { db } = await import("./lib/db");
    db();

    const { ensureAdminAccount } = await import("./lib/bootstrap");
    await ensureAdminAccount();

    // Analytics retention for the Node target, which has no cron. On Workers
    // the scheduled handler does this; here each server start does. Best
    // effort — it never throws.
    const { pruneOldEvents } = await import("./lib/analytics");
    await pruneOldEvents();
  }
}
