import { db } from "./db";
import { registerSqlDriver, type RunResult, type Sql, type SqlParam, type Statement } from "./sql";

/**
 * better-sqlite3 behind the async seam.
 *
 * The Promises here resolve immediately — SQLite is synchronous and nothing is
 * gained by pretending otherwise. The point is that call sites are written
 * against the async contract, so swapping in D1 (which really is async) is a
 * change to this file and its sibling, not to the 116 places that query.
 *
 * This module is Node-only by construction: it imports better-sqlite3, which
 * Workers cannot load. It must never be reachable from a Workers build — the
 * `sql()` resolver in sql.ts is what keeps that choice in one place.
 */

/** Positional parameters only, matching what D1 accepts. */
function bind(params?: SqlParam[]): SqlParam[] {
  return params ?? [];
}

class NodeSql implements Sql {
  async all<T>(query: string, params?: SqlParam[]): Promise<T[]> {
    return db().prepare(query).all(...bind(params)) as T[];
  }

  async first<T>(query: string, params?: SqlParam[]): Promise<T | null> {
    const row = db().prepare(query).get(...bind(params));
    return (row as T | undefined) ?? null;
  }

  async run(query: string, params?: SqlParam[]): Promise<RunResult> {
    const info = db().prepare(query).run(...bind(params));
    return { changes: info.changes, lastRowId: Number(info.lastInsertRowid) };
  }

  async batch(statements: Statement[]): Promise<RunResult[]> {
    const d = db();
    // A real transaction, which is what D1's batch() also guarantees. Note it
    // is still all-or-nothing and result-blind: callers must not rely on
    // inspecting one statement's outcome before the next runs.
    const tx = d.transaction((items: Statement[]): RunResult[] =>
      items.map((s) => {
        const info = d.prepare(s.sql).run(...bind(s.params));
        return { changes: info.changes, lastRowId: Number(info.lastInsertRowid) };
      })
    );
    return tx(statements);
  }
}

let _sql: NodeSql | null = null;

export function nodeSql(): Sql {
  if (!_sql) _sql = new NodeSql();
  return _sql;
}

/**
 * Install this driver.
 *
 * Called from src/instrumentation.ts, guarded on NEXT_RUNTIME === "nodejs".
 * That guard is the whole Workers boundary: because nothing in sql.ts names
 * this module, a bundler building for Workers has no edge to follow and
 * better-sqlite3 is simply absent from the graph.
 */
export function registerNodeSql(): void {
  registerSqlDriver(nodeSql);
}
