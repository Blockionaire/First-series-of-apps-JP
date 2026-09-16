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
 * An earlier attempt at instrumentation.ts was deleted because it imported the
 * database at module scope: Next compiles this file for the edge runtime too,
 * where `fs` and `path` do not resolve, and the build broke. The fix is the
 * shape below — a dynamic import INSIDE the NEXT_RUNTIME guard, so the edge
 * compile never sees the module at all.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { registerNodeSql } = await import("./lib/sql-node");
    registerNodeSql();
  }
  // The Workers runtime registers its D1 driver from the Worker entry point
  // instead; see the Cloudflare configuration added in the runtime phase.
}
