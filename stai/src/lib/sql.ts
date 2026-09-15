/**
 * The database seam.
 *
 * Every query in the application goes through this async interface. Nothing
 * outside src/lib/ may call better-sqlite3 directly.
 *
 * Why it exists: Cloudflare Workers cannot load better-sqlite3 — it is a
 * compiled native addon, and Workers run V8 isolates rather than Node. The
 * replacement, D1, is asynchronous where better-sqlite3 is synchronous, so the
 * shape of every call site has to change. Doing that swap and the async
 * conversion at the same time would mean debugging two failure modes at once.
 *
 * So this interface is deliberately the intersection of what both engines can
 * do, and today it is implemented by better-sqlite3:
 *
 *   - POSITIONAL PARAMETERS ONLY. D1 does not support named parameters, so
 *     `@slug`-style statements are not expressible here.
 *   - NO INTERACTIVE TRANSACTIONS. `batch()` is all-or-nothing but cannot read
 *     a value mid-flight and branch on it; read-then-decide logic has to be
 *     expressed as a conditional UPDATE (see billing.ts).
 *   - NO MULTI-STATEMENT `exec`. Schema work belongs in migrations, not in a
 *     request.
 *
 * When the Workers runtime lands, `sql()` returns a D1-backed implementation
 * and no call site changes.
 */

export type SqlParam = string | number | null;

export type RunResult = {
  /** Rows changed by the statement. */
  changes: number;
  /** Rowid of an INSERT. Zero when the statement inserted nothing. */
  lastRowId: number;
};

export type Statement = { sql: string; params?: SqlParam[] };

export interface Sql {
  /** Every matching row. */
  all<T = Record<string, unknown>>(sql: string, params?: SqlParam[]): Promise<T[]>;
  /** The first matching row, or null. */
  first<T = Record<string, unknown>>(sql: string, params?: SqlParam[]): Promise<T | null>;
  /** A write. */
  run(sql: string, params?: SqlParam[]): Promise<RunResult>;
  /**
   * Several writes, applied atomically and in order.
   *
   * On better-sqlite3 this is a real transaction; on D1 it is `batch()`, which
   * is also all-or-nothing. Neither lets you inspect a result between
   * statements — that is the constraint, not an oversight.
   */
  batch(statements: Statement[]): Promise<RunResult[]>;
}

/**
 * The active implementation.
 *
 * Resolved lazily and per call rather than captured in a module-level constant:
 * on Workers the binding lives on the per-request environment, so a value
 * frozen at module scope would be wrong (and on a cold isolate, absent).
 */
export function sql(): Sql {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { nodeSql } = require("./sql-node") as typeof import("./sql-node");
  return nodeSql();
}

/** Convenience: a single scalar column from the first row. */
export async function scalar<T = number>(query: string, params?: SqlParam[]): Promise<T | null> {
  const row = await sql().first<Record<string, T>>(query, params);
  if (!row) return null;
  const values = Object.values(row);
  return values.length > 0 ? values[0] : null;
}

/** Convenience: `SELECT COUNT(*) …` without the row-shape ceremony at every call site. */
export async function count(query: string, params?: SqlParam[]): Promise<number> {
  return Number((await scalar<number>(query, params)) ?? 0);
}
