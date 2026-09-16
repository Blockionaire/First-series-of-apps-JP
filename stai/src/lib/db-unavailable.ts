import type Database from "better-sqlite3";

/**
 * The Workers stand-in for src/lib/db.ts — the local SQLite file.
 *
 * Swapped in by a webpack NormalModuleReplacementPlugin in next.config.ts when
 * STAI_BUILD_TARGET=workers. db.ts is the ONLY module in the tree that imports
 * better-sqlite3, so replacing it removes a 2.2 MB package and a compiled
 * better_sqlite3.node from the Worker — a binary Workers cannot load and that
 * has no business being shipped to the edge.
 *
 * Why the replacement is at this layer: resolving `better-sqlite3` to a stub
 * does not work, because Next externalises node_modules in the server build,
 * so the require is emitted bare and resolve.alias never fires. Replacing a
 * first-party module does work, because that one is genuinely bundled.
 *
 * Its two importers on the Workers side are both unreached:
 *   src/lib/sql-node.ts       the Node driver; on Workers the driver is D1
 *   src/lib/billing-frozen.ts payment mutation, frozen until the paid launch
 *
 * Everything throws rather than returning a no-op, so if either ever did
 * become reachable the failure would be immediate and named.
 */

const MESSAGE =
  "The local SQLite database is not available on Cloudflare Workers — better-sqlite3 " +
  "is a native addon. The database here is D1, registered by src/instrumentation.ts " +
  "from STAI_RUNTIME. Reaching this means something bypassed the seam in src/lib/sql.ts.";

export function dbPath(): string {
  throw new Error(MESSAGE);
}

export function db(): Database.Database {
  throw new Error(MESSAGE);
}

export function closeDb(): void {
  // Deliberately silent: shutdown paths must never throw, and there is nothing
  // to close. A Worker has no process lifecycle to hook.
}
