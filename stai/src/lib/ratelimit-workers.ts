import { getCloudflareContext } from "@opennextjs/cloudflare";
import { registerRateLimitStore, type RateLimitResult } from "./ratelimit";

/**
 * Install the Durable Object rate-limit store on Cloudflare Workers.
 *
 * The counterpart to sql-workers.ts, and the same shape for the same reasons:
 * this is the only module that reaches for the ambient Cloudflare context, so
 * the Durable Object itself (worker/rate-limiter-do.ts) stays a plain class
 * with no OpenNext import, and src/lib/ratelimit.ts stays a runtime-agnostic
 * interface that node:test can exercise with a fake.
 *
 * The binding is read PER CALL, not captured at registration. On Workers the
 * environment belongs to the request; a namespace frozen at module scope is
 * stale on the second request and missing on a cold isolate.
 */

/**
 * The Durable Object surface, declared structurally so this file needs no
 * @cloudflare/workers-types (see worker/cloudflare.d.ts for why that package
 * is not installed). `hit` mirrors the RPC method on RateLimiterDO — TypeScript
 * checks the call, workerd performs it.
 */
type RateLimiterStub = {
  hit(limit: number, windowMs: number): Promise<RateLimitResult>;
};
type RateLimiterNamespace = {
  idFromName(name: string): unknown;
  get(id: unknown): RateLimiterStub;
};

export function registerWorkersRateLimit(): void {
  registerRateLimitStore({
    scope: "global",

    async hit(key, limit, windowMs) {
      const env = getCloudflareContext().env as unknown as {
        RATE_LIMITER?: RateLimiterNamespace;
      };
      const ns = env?.RATE_LIMITER;
      if (!ns) {
        // Thrown, not swallowed. rateLimit() catches this, falls back to
        // in-process counting, bumps the degradation counter and logs — so a
        // missing binding costs protection but never availability, and it says
        // so out loud instead of pretending to be global.
        throw new Error(
          "Durable Object binding `RATE_LIMITER` is missing. Check the " +
            "durable_objects block in wrangler.jsonc."
        );
      }

      // One object per key: the key is the object's name, so unrelated buckets
      // cannot contend or collide, and the key itself never has to be stored.
      return await ns.get(ns.idFromName(key)).hit(limit, windowMs);
    },
  });
}
