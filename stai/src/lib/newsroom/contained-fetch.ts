/**
 * An outbound request that stays inside one publisher.
 *
 * A source is registered for a domain and ingested at that domain's authority
 * tier. `redirect: "follow"` let the publisher's server — or anyone who can
 * make it answer with a 301 — hand the request to any host at all, and the
 * content that came back was filed under the registered source's tier
 * (CODE_AUDIT.md, Phase C). A Tier-1 regulator whose feed path was taken
 * over, or that moved its feed to a third-party host, would have made that
 * host's text read as the regulator's.
 *
 * So redirects are followed by hand, one hop at a time, and every hop is held
 * to the same rule the feed URL was held to when it was registered:
 * `feedUrlBelongsTo` — https, and the registered domain or a subdomain of it.
 * A hop that leaves is not requested. The caller gets `off_domain` with the
 * address it was sent to, which is what an operator needs to decide whether
 * the source moved (update the registry) or something is wrong.
 *
 * Used by all three places that fetch publisher content: the discovery
 * fetcher, the admin "Test source" probe, and detail-page hydration behind
 * an index. One implementation, so the rule cannot drift between them.
 */

import { feedUrlBelongsTo } from "./sources.ts";

/** More than this and it is a loop or a maze, not a moved feed. */
export const MAX_REDIRECTS = 5;

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

export type Contained =
  | { ok: true; res: Response; finalUrl: string; hops: number }
  | { ok: false; kind: "off_domain"; location: string; hops: number; error: string }
  | { ok: false; kind: "redirect_error"; hops: number; error: string };

/** The domain a request must stay inside when the caller did not name one. */
function domainOf(url: string): string {
  try {
    return new URL(url).host.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

/**
 * Fetch `url`, following redirects only within `domain`.
 *
 * `domain` is the source's registered domain. When a caller has none, the
 * starting URL's own host is used, which is stricter (no sibling subdomains)
 * and never looser. Network errors and timeouts are thrown, exactly as
 * `fetch` throws them, so callers keep their existing handling.
 */
export async function containedFetch(
  doFetch: typeof globalThis.fetch,
  url: string,
  init: RequestInit,
  domain?: string
): Promise<Contained> {
  const within = (domain ?? "").trim() || domainOf(url);
  let current = url;
  for (let hops = 0; ; hops++) {
    const res = await doFetch(current, { ...init, redirect: "manual" });

    if (REDIRECT_STATUSES.has(res.status)) {
      const location = res.headers.get("location");
      // A redirect we will not follow is not read either: release the body.
      await res.body?.cancel().catch(() => {});
      if (!location) {
        return { ok: false, kind: "redirect_error", hops, error: `${res.status} redirect with no Location` };
      }
      let next: string;
      try {
        next = new URL(location, current).toString();
      } catch {
        return { ok: false, kind: "redirect_error", hops, error: `${res.status} redirect to an invalid address` };
      }
      if (!feedUrlBelongsTo(next, within)) {
        return {
          ok: false,
          kind: "off_domain",
          location: next,
          hops: hops + 1,
          error: `redirected to ${next}, outside ${within} — not followed`,
        };
      }
      if (hops + 1 > MAX_REDIRECTS) {
        return { ok: false, kind: "redirect_error", hops: hops + 1, error: `more than ${MAX_REDIRECTS} redirects` };
      }
      current = next;
      continue;
    }

    // A runtime that followed anyway (or a test double that reports where it
    // ended up) is held to the same rule on its final address.
    const finalUrl = res.url || current;
    if (finalUrl !== current && !feedUrlBelongsTo(finalUrl, within)) {
      await res.body?.cancel().catch(() => {});
      return {
        ok: false,
        kind: "off_domain",
        location: finalUrl,
        hops: hops + 1,
        error: `redirected to ${finalUrl}, outside ${within} — not used`,
      };
    }
    return { ok: true, res, finalUrl, hops };
  }
}
