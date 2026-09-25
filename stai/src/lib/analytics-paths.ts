/**
 * Which paths analytics counts.
 *
 * Its own module, importing nothing, because both sides of the beacon need
 * this rule: the client component that fires it and the route that records
 * it. lib/analytics.ts cannot be the home for it — that module reaches the
 * database, and importing it from a "use client" component would drag the SQL
 * driver into the browser bundle.
 *
 * ── Why the back office is excluded ──────────────────────────────────────
 * <Analytics /> sits in the root layout, so it fired on /admin too. Every
 * visit to the desk counted as a page view and every admin browser session
 * counted as a visitor, which meant the numbers measuring whether anyone is
 * reading STAI were substantially the operator reading their own dashboard.
 * A metric you inflate by looking at it is worse than no metric.
 *
 * /account, /login and /signup stay counted: those are readers, and the
 * signup funnel is exactly what these numbers exist to show.
 */

/** Path prefixes analytics ignores. Matched as whole segments, never substrings. */
export const UNTRACKED_PREFIXES = ["/admin"] as const;

/**
 * `true` if a page view on this path should be recorded.
 *
 * Compares whole segments: "/admin" and "/admin/growth" are excluded, but a
 * hypothetical "/administrators" is not. A bare `startsWith("/admin")` would
 * quietly swallow it.
 */
export function isTrackablePath(path: string): boolean {
  return !UNTRACKED_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));
}
