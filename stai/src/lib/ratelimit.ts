import type { NextRequest } from "next/server";

/**
 * Sliding-window rate limiting.
 *
 * NOTE ON CORPORATE NAT: our readers sit behind audit-firm gateways, so a
 * whole firm can share one egress IP. That is why IP limits here are *burst*
 * protection (stop a script looping), never a product quota. Product quotas
 * are metered per account/cookie in usage_counters, and cost is capped
 * globally. Never turn these into per-IP entitlements.
 *
 * ── Why this is behind an interface ──────────────────────────────────────
 * This used to be a module-level `Map`, which is exactly right for one Node
 * process next to one SQLite file. On Cloudflare Workers it is not right and,
 * worse, not visibly wrong: each isolate gets its own empty Map, isolates are
 * created and discarded constantly and exist per colo, so a limit of "5 per
 * hour" silently becomes "5 per hour per isolate" — effectively no limit at
 * all, with nothing in the logs to say so.
 *
 * So the store is pluggable, and a Workers store has NOT been built yet. Under
 * `wrangler dev` this still reports scope "process", which is honest and is
 * why /api/health exposes it.
 *
 * The choice, when it is made: Cloudflare's native Rate Limiting binding only
 * supports short fixed periods, so it cannot express the limits below without
 * changing what they mean — "5 per hour" becoming "5 per 60 seconds" is a 60×
 * weakening dressed up as a port. A Durable Object counts exactly over
 * arbitrary windows and is the only primitive that preserves these as written.
 * The security-sensitive buckets are the reason: login, signup, account-delete
 * and ask. See the Phase 3 report.
 */

export type RateLimitResult = { ok: boolean; remaining: number; retryAfter: number };

export interface RateLimitStore {
  /**
   * What this store can actually promise. `process` means "correct only if
   * there is exactly one process", and is a deployment error on Workers.
   */
  readonly scope: "process" | "global";
  /** Count one hit against `key`, and say whether the caller may proceed. */
  hit(key: string, limit: number, windowMs: number): Promise<RateLimitResult>;
}

/* ── The in-process store ──────────────────────────────────────────────────
 * Correct on a single Node process. Also the degraded fallback everywhere
 * else: it needs no network and cannot fail, which is what makes it a safe
 * floor when a remote store is unreachable.
 */

type Hit = { count: number; resetAt: number };
const buckets = new Map<string, Hit>();

let lastSweep = Date.now();
function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
}

function countInMemory(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  sweep(now);
  const hit = buckets.get(key);
  if (!hit || hit.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, retryAfter: 0 };
  }
  hit.count += 1;
  if (hit.count > limit) {
    return { ok: false, remaining: 0, retryAfter: Math.ceil((hit.resetAt - now) / 1000) };
  }
  return { ok: true, remaining: limit - hit.count, retryAfter: 0 };
}

export const memoryStore: RateLimitStore = {
  scope: "process",
  async hit(key, limit, windowMs) {
    return countInMemory(key, limit, windowMs);
  },
};

let _store: RateLimitStore = memoryStore;

/** Install the store for this runtime. Workers registers a Durable Object store. */
export function registerRateLimitStore(store: RateLimitStore): void {
  _store = store;
}

export function rateLimitScope(): RateLimitStore["scope"] {
  return _store.scope;
}

/** Degradations since boot, surfaced on /api/health rather than left silent. */
let _degraded = 0;
export function rateLimitDegradations(): number {
  return _degraded;
}

export async function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): Promise<RateLimitResult> {
  try {
    return await _store.hit(key, limit, windowMs);
  } catch {
    // Degrade to in-process counting rather than failing open entirely.
    //
    // The alternative designs are both worse. Failing OPEN on a store blip
    // hands an attacker an unthrottled window against /api/auth/login.
    // Failing CLOSED locks every reader out of the site because a counter is
    // unavailable. In-process counting is weaker than global counting but
    // strictly stronger than nothing, and it cannot itself fail.
    _degraded++;
    return countInMemory(key, limit, windowMs);
  }
}

/** Client IP behind a reverse proxy. Trusts x-forwarded-for's first entry. */
export function clientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

/**
 * Guard a route. Returns a 429 Response when the caller should be stopped,
 * or null to proceed.
 */
export async function guard(
  req: NextRequest,
  bucket: string,
  limit: number,
  windowMs: number
): Promise<Response | null> {
  const res = await rateLimit(`${bucket}:${clientIp(req)}`, limit, windowMs);
  if (res.ok) return null;
  return Response.json(
    { error: "Too many requests — slow down and try again shortly." },
    { status: 429, headers: { "Retry-After": String(res.retryAfter) } }
  );
}

export const WINDOW = {
  minute: 60_000,
  tenMinutes: 600_000,
  hour: 3_600_000,
  day: 86_400_000,
} as const;
