/**
 * The smallest slice of the Workers runtime this project needs, declared here
 * rather than installed.
 *
 * `@cloudflare/workers-types` is deliberately NOT a dependency. tsconfig.json
 * includes every .ts file in the repository and its `lib` includes "dom", so
 * pulling the Workers globals in would redefine Request, Response, fetch and
 * friends underneath the entire Next application. src/lib/sql-d1.ts already
 * declares the D1 surface structurally for exactly that reason; this is the
 * same decision applied to Durable Objects.
 *
 * Everything below is a type-only description of APIs workerd provides at
 * runtime. Nothing here is executed.
 */

interface SqlStorageCursor<T> {
  toArray(): T[];
  [Symbol.iterator](): Iterator<T>;
}

interface SqlStorage {
  exec<T = Record<string, unknown>>(query: string, ...bindings: unknown[]): SqlStorageCursor<T>;
}

interface DurableObjectStorage {
  /** Present only on SQLite-backed Durable Objects. */
  readonly sql: SqlStorage;
}

interface DurableObjectState {
  readonly storage: DurableObjectStorage;
}

declare module "cloudflare:workers" {
  export class DurableObject<Env = unknown> {
    constructor(ctx: DurableObjectState, env: Env);
    protected ctx: DurableObjectState;
    protected env: Env;
  }
}
