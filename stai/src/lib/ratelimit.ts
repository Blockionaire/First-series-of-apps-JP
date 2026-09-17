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
 * So the store is pluggable. On Workers, src/lib/ratelimit-workers.ts installs
 * a Durable Object store (worker/rate-limiter-do.ts) and /api/health reports
 * scope "global". The in-process store below remains the Node implementation
 * and the degraded fallback everywhere.
 *
 * Why a Durable Object and not Cloudflare's native Rate Limiting binding: the
 * native binding only supports short fixed periods, so it cannot express the
 * limits below without changing what they mean — "5 per hour" becoming "5 per
 * 60 seconds" is a 60x weakening dressed up as a port. A Durable Object counts
 * exactly over arbitrary windows and is the only primitive that preserves
 * these as written. The security-sensitive buckets are the reason: login,
 * signup, account-delete and ask.
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

/**
 * The store slot and the degradation counters live on globalThis, not in
 * module-level `let`s.
 *
 * Next.js does not guarantee one instance of a module across bundles: the
 * instrumentation bundle and each route's bundle can each get their own copy.
 * A module-level `let` therefore registers the Durable Object store into an
 * instance no route handler ever reads, and every route silently keeps the
 * in-process default — a limiter that reports `scope: "global"` on /api/health
 * while counting per isolate. src/lib/sql.ts moved its driver slot here for
 * exactly this reason, after exactly that bug.
 */
const STORE_KEY = Symbol.for("stai.ratelimit.store");
const STATE_KEY = Symbol.for("stai.ratelimit.state");

type LimiterState = { degradations: number; lastDegradedAt: number };
type LimiterHost = {
  [STORE_KEY]?: RateLimitStore;
  [STATE_KEY]?: LimiterState;
};

function state(): LimiterState {
  const host = globalThis as LimiterHost;
  return (host[STATE_KEY] ??= { degradations: 0, lastDegradedAt: 0 });
}

function store(): RateLimitStore {
  return (globalThis as LimiterHost)[STORE_KEY] ?? memoryStore;
}

/** Install the store for this runtime. Workers registers a Durable Object store. */
export function registerRateLimitStore(s: RateLimitStore): void {
  (globalThis as LimiterHost)[STORE_KEY] = s;
}

export function rateLimitScope(): RateLimitStore["scope"] {
  return store().scope;
}

/** Degradations since boot, surfaced on /api/health rather than left silent. */
export function rateLimitDegradations(): number {
  return state().degradations;
}

/**
 * Whether the limiter is currently delivering what `scope` claims.
 *
 * False means at least one call fell back to in-process counting in the last
 * minute, so a `global` scope is not being honoured right now. Kept separate
 * from `scope` because the two answer different questions: scope is the design,
 * this is the present.
 *
 * CAVEAT, and it is a real one: these counters are per isolate. An isolate that
 * degraded may not be the isolate that serves /api/health, so a `true` here is
 * weaker evidence than a `false`. The authoritative signal is the warning
 * logged on every degradation — observability is enabled in wrangler.jsonc so
 * those reach the dashboard. This field is a cheap hint, not a monitor.
 */
export function rateLimitHealthy(): boolean {
  const { lastDegradedAt } = state();
  return lastDegradedAt === 0 || Date.now() - lastDegradedAt > 60_000;
}

export async function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): Promise<RateLimitResult> {
  try {
    return await store().hit(key, limit, windowMs);
  } catch (e) {
    // Degrade to in-process counting rather than failing open entirely.
    //
    // The alternative designs are both worse. Failing OPEN on a store blip
    // hands an attacker an unthrottled window against /api/auth/login.
    // Failing CLOSED locks every reader out of the site because a counter is
    // unavailable. In-process counting is weaker than global counting but
    // strictly stronger than nothing, and it cannot itself fail.
    const s = state();
    s.degradations++;
    s.lastDegradedAt = Date.now();

    // The operational signal. Deliberately logs the BUCKET only, never the
    // full key: the key's second half is a client IP, and an error path is not
    // a licence to start writing addresses into logs that outlive the request.
    console.warn(
      `[ratelimit] degraded to in-process counting for bucket "${key.split(":")[0]}": ` +
        (e instanceof Error ? e.message : "unknown error")
    );
    return countInMemory(key, limit, windowMs);
  }
}

/**
 * Client IP behind a reverse proxy.
 *
 * `cf-connecting-ip` is consulted FIRST, and that ordering is the whole point.
 * Cloudflare sets that header itself and overwrites any client-supplied copy,
 * whereas it *appends* to `x-forwarded-for` — so on Workers the first entry of
 * x-forwarded-for is whatever the caller put there. Reading it first would let
 * an attacker mint a fresh rate-limit key per request with one header and walk
 * straight through `login` and `signup`. A global counter keyed on a spoofable
 * value is theatre, so the trustworthy header wins where it exists.
 *
 * x-forwarded-for and x-real-ip remain the fallback for the Node deployment,
 * where a reverse proxy in front of the app is the one setting them.
 *
 * This reads a header the platform already provides. It does not derive,
 * combine, hash or store anything else about the caller: no user agent, no TLS
 * or device characteristics, no fingerprint.
 */
export function clientIp(req: NextRequest): string {
  const cf = req.headers.get("cf-connecting-ip");
  if (cf) return cf.trim();
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
