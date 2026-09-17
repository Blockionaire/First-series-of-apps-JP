import { registerSqlDriver, type RunResult, type Sql, type SqlParam, type Statement } from "./sql";

/**
 * Cloudflare D1 behind the async seam.
 *
 * The only module in the application that knows D1 exists. Routes and pages
 * call sql() and cannot tell which engine answered — which is the property the
 * seam was built for in Phase 0.
 *
 * The D1 types are declared structurally here rather than imported from
 * @cloudflare/workers-types. That keeps this phase free of a new dependency
 * and, more usefully, states exactly which four calls the application relies
 * on. The runtime phase can swap in the official types without touching any
 * call site.
 */

export interface D1Result<T = Record<string, unknown>> {
  results?: T[];
  success: boolean;
  meta?: { changes?: number; last_row_id?: number; rows_read?: number; rows_written?: number };
}

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  run<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
}

export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T = Record<string, unknown>>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
}

class D1Sql implements Sql {
  constructor(private readonly d1: D1Database) {}

  /**
   * Bind only when there are parameters.
   *
   * D1 rejects a bind() call whose argument count does not match the
   * placeholders in the statement, and a no-argument bind() on a statement
   * with none is needless work. Parameters stay parameters — nothing here
   * interpolates a value into SQL.
   */
  private stmt(query: string, params?: SqlParam[]): D1PreparedStatement {
    const prepared = this.d1.prepare(query);
    return params && params.length > 0 ? prepared.bind(...params) : prepared;
  }

  async all<T>(query: string, params?: SqlParam[]): Promise<T[]> {
    const res = await this.stmt(query, params).all<T>();
    return res.results ?? [];
  }

  async first<T>(query: string, params?: SqlParam[]): Promise<T | null> {
    // D1's first() already returns null for no rows, matching the seam's
    // contract and the Node driver's behaviour.
    return this.stmt(query, params).first<T>();
  }

  async run(query: string, params?: SqlParam[]): Promise<RunResult> {
    const res = await this.stmt(query, params).run();
    return {
      changes: res.meta?.changes ?? 0,
      // D1 reports 0 rather than null when a statement inserted nothing, which
      // is what the Node driver returns too.
      lastRowId: res.meta?.last_row_id ?? 0,
    };
  }

  /**
   * D1 documents batch() as transactional: the statements run in order and a
   * failure rolls the whole batch back. That is the same guarantee the Node
   * driver gives by wrapping them in a real transaction, so callers get
   * identical semantics on both engines.
   *
   * What neither engine offers through this interface is reading a result
   * between statements — the seam deliberately cannot express it, so nothing
   * can come to depend on it.
   */
  async batch(statements: Statement[]): Promise<RunResult[]> {
    if (statements.length === 0) return [];
    const prepared = statements.map((s) => this.stmt(s.sql, s.params));
    const results = await this.d1.batch(prepared);
    return results.map((r) => ({
      changes: r.meta?.changes ?? 0,
      lastRowId: r.meta?.last_row_id ?? 0,
    }));
  }
}

export function d1Sql(binding: D1Database): Sql {
  return new D1Sql(binding);
}

/**
 * Install the D1 driver.
 *
 * Called from the Worker entry point with the per-request binding. The factory
 * is invoked on every sql() call rather than cached, because on Workers the
 * binding belongs to the request environment, not to module scope.
 */
export function registerD1Sql(getBinding: () => D1Database): void {
  registerSqlDriver(() => d1Sql(getBinding()));
}
