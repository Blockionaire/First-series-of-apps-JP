import { DurableObject } from "cloudflare:workers";
import type { RateLimitResult } from "../src/lib/ratelimit";

/**
 * The global rate-limit counter.
 *
 * ── Why this exists ──────────────────────────────────────────────────────
 * The in-process store in src/lib/ratelimit.ts is correct next to exactly one
 * Node process and wrong on Workers in a way that does not show up in logs:
 * every isolate gets its own empty Map, isolates are created and discarded
 * constantly and exist per colo, so "5 per hour" silently becomes "5 per hour
 * per isolate". For `login`, `signup` and `account-delete` that is not a
 * degradation, it is the absence of a control.
 *
 * ── Why a Durable Object and not the native binding ──────────────────────
 * Cloudflare's Rate Limiting binding only supports short fixed periods. It
 * cannot express "5 per hour" at all, and rewriting that policy as "5 per 60
 * seconds" to fit the primitive would be a 60x weakening wearing the costume
 * of a port. A Durable Object counts exactly, over whatever window it is
 * given, so the policies in the route handlers survive the move unchanged.
 *
 * ── Why one Durable Object per key ───────────────────────────────────────
 * `idFromName(key)` maps each bucket key to its own object, so two unrelated
 * keys cannot contend and cannot collide: isolation is structural rather than
 * something the table layout has to get right.
 *
 * It also means the key does NOT need to be stored. A sharded design would
 * have to persist `bucket:ip` as a primary key in order to tell rows apart;
 * here the object *is* the key, the table holds exactly one row, and the only
 * columns are a counter and an expiry. No IP address, no account id, no route
 * name and no request content is ever written to disk — which is both the
 * privacy-minimal choice and one less thing to erase under Art. 17.
 */

/** The single row. `id` is pinned so the table can never grow past one row. */
type Bucket = { count: number; reset_at: number };

export class RateLimiterDO extends DurableObject {
  constructor(ctx: DurableObjectState, env: unknown) {
    super(ctx, env);
    // Durable Object constructors run before any request the object handles,
    // and SQLite storage is synchronous, so this needs no lazy-init guard.
    this.ctx.storage.sql.exec(
      `CREATE TABLE IF NOT EXISTS bucket (
         id       INTEGER PRIMARY KEY CHECK (id = 1),
         count    INTEGER NOT NULL,
         reset_at INTEGER NOT NULL
       )`
    );
  }

  /**
   * Count one hit and say whether the caller may proceed.
   *
   * Deliberately identical in behaviour to countInMemory() in
   * src/lib/ratelimit.ts: a fixed window that starts on the first hit, a
   * counter that keeps climbing past the limit, and an expiry that is never
   * extended by later hits. Matching it exactly is the point — the fallback
   * path must not enforce a subtly different policy from the primary one.
   */
  hit(limit: number, windowMs: number): RateLimitResult {
    const now = Date.now();
    const sql = this.ctx.storage.sql;
    const current = sql.exec<Bucket>("SELECT count, reset_at FROM bucket WHERE id = 1").toArray()[0];

    // No window yet, or the previous one has expired. Start a fresh one.
    if (!current || current.reset_at <= now) {
      sql.exec(
        `INSERT INTO bucket (id, count, reset_at) VALUES (1, 1, ?)
           ON CONFLICT(id) DO UPDATE SET count = 1, reset_at = excluded.reset_at`,
        now + windowMs
      );
      return { ok: true, remaining: limit - 1, retryAfter: 0 };
    }

    const count = current.count + 1;
    sql.exec("UPDATE bucket SET count = ? WHERE id = 1", count);

    if (count > limit) {
      return { ok: false, remaining: 0, retryAfter: Math.ceil((current.reset_at - now) / 1000) };
    }
    return { ok: true, remaining: limit - count, retryAfter: 0 };
  }
}
