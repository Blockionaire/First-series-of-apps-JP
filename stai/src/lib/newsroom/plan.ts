/**
 * Which Cloudflare Workers plan discovery is running under, and what that
 * permits.
 *
 * The newsroom is designed for Workers Paid (1,000 D1 queries, 10,000
 * subrequests and minutes of CPU per invocation). STAI launched on Workers
 * Free (50 queries, 50 subrequests, ~10 ms CPU), and will move to Paid before
 * discovery runs at any scale. Until then this module is what keeps a Free
 * deployment safe WITHOUT redesigning the pipeline around Free's limits:
 *
 *   · scheduled discovery refuses to run on Free, even if its switch is on;
 *   · a manual run is clamped to a handful of sources and detail pages, which
 *     fits Free's 50-subrequest and 50-query ceilings with room to spare.
 *
 * The plan is a wrangler var, `STAI_WORKERS_PLAN`. Unset means Free — the safe
 * direction to be wrong in: forgetting to flip it after upgrading only keeps
 * discovery small. After upgrading, set it to "paid" in wrangler.jsonc and
 * deploy (DISCOVERY.md §9 has the order).
 *
 * The Node target (tests, the Docker/VPS deployment) has none of these
 * limits and is never clamped.
 *
 * Pure: reads the environment it is given, touches nothing else.
 */

export type WorkersPlan = "free" | "paid" | "node";

type Env = Record<string, string | undefined>;

export function workersPlan(env: Env = process.env): WorkersPlan {
  if (env.STAI_RUNTIME !== "workers") return "node";
  return env.STAI_WORKERS_PLAN?.trim().toLowerCase() === "paid" ? "paid" : "free";
}

/**
 * The most a MANUAL run may do on Workers Free.
 *
 * Three sources and ten detail pages is at most 13 outbound requests, and a
 * run's own D1 work is 9–21 queries: well inside both 50s even if D1 calls are
 * counted as subrequests. CPU cannot be bounded the same way — Free allows
 * ~10 ms, and even a small first ingest can exceed that. When it does, the
 * invocation is stopped by the platform; because a run writes everything in
 * one transactional batch, nothing is half-written, and its lease is released
 * after the time budget plus five minutes. A killed run is a failed run, not
 * a damaged database.
 */
export const FREE_MANUAL_PROFILE = {
  maxSources: 3,
  maxDetailFetches: 10,
  maxRunSeconds: 30,
} as const;

/** Scheduled discovery needs Workers Paid; on Free it does not start. */
export function scheduledDiscoveryAllowed(plan: WorkersPlan): boolean {
  return plan !== "free";
}

export const SCHEDULED_NEEDS_PAID =
  "scheduled discovery needs Workers Paid — after upgrading, set STAI_WORKERS_PLAN to \"paid\" in wrangler.jsonc and deploy";
