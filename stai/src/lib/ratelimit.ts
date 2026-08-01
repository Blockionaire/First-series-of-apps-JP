import type { NextRequest } from "next/server";

/**
 * In-process sliding-window rate limiter.
 *
 * Deliberately in-memory: the platform runs as a single Node process next to
 * its SQLite file, so a Map is both sufficient and faster than a DB round-trip
 * on every request. If this ever runs multi-instance, swap the store for Redis
 * — the call sites don't change.
 *
 * NOTE ON CORPORATE NAT: our readers sit behind audit-firm gateways, so a
 * whole firm can share one egress IP. That is why IP limits here are *burst*
 * protection (stop a script looping), never a product quota. Product quotas
 * are metered per account/cookie in usage_counters, and cost is capped
 * globally. Never turn these into per-IP entitlements.
 */

type Hit = { count: number; resetAt: number };
const buckets = new Map<string, Hit>();

let lastSweep = Date.now();
function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
}

export type RateLimitResult = { ok: boolean; remaining: number; retryAfter: number };

export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
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
export function guard(
  req: NextRequest,
  bucket: string,
  limit: number,
  windowMs: number
): Response | null {
  const res = rateLimit(`${bucket}:${clientIp(req)}`, limit, windowMs);
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
