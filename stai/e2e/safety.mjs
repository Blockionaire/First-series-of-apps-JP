/**
 * The rules that make this suite safe to point at production.
 *
 * They live in their own file because they are the part that must not drift.
 * Everything else here is a convenience; these are the reason the suite can be
 * run against a live site with real members and real content.
 *
 * ── The four rules ───────────────────────────────────────────────────────
 *
 * 1. GET only. The suite navigates and clicks links. It never submits a form,
 *    never fills an input, never issues a POST. Verified against the app: all
 *    three auth routes are POST-only and no GET route in src/app/api contains
 *    an INSERT, UPDATE or DELETE, so following a link cannot mutate anything.
 *
 * 2. The analytics beacon is blocked. This is the one write a pure GET crawl
 *    would otherwise cause: every page view POSTs to /api/track, so a crawl of
 *    a hundred URLs would write a hundred page views and a fresh visitor into
 *    production analytics. The Growth dashboard would then show a spike that
 *    is entirely this test. Aborting the request at the browser leaves the
 *    numbers honest.
 *
 * 3. No admin surface beyond one redirect check. /admin is fetched once,
 *    unauthenticated, to confirm it refuses. Nothing under /admin/ is opened,
 *    and the suite never signs in.
 *
 * 4. Forms are found and reported, never exercised. A form's entry point is
 *    checked — it renders, its fields are present, its submit control exists —
 *    and submission is reported as untested with the reason.
 */

/** Requests aborted at the browser, with why. */
export const BLOCKED_REQUESTS = [
  {
    match: (url) => new URL(url).pathname === "/api/track",
    why: "analytics beacon — would write page views and a visitor into production",
  },
];

/**
 * Paths the crawler will not follow.
 *
 * `/api/` is excluded wholesale rather than per-route: the crawl should not
 * depend on today's knowledge of which endpoints are read-only, because that
 * is a property of the application that can change without this file changing.
 */
export const SKIP_PREFIXES = ["/api/", "/admin/"];

/** True if this href is a same-origin page the crawler may open. */
export function crawlable(href, origin) {
  let u;
  try {
    u = new URL(href, origin);
  } catch {
    return false;
  }
  if (u.origin !== origin) return false;
  if (!/^https?:$/.test(u.protocol)) return false;
  if (SKIP_PREFIXES.some((p) => u.pathname.startsWith(p))) return false;
  // /admin itself is checked once, deliberately, outside the crawl.
  if (u.pathname === "/admin") return false;
  return true;
}

/**
 * Elements the suite refuses to click.
 *
 * Anything inside a <form>, and any submit control, whatever it is labelled.
 * A "Join waitlist" button is a link-shaped thing that writes a row.
 */
export const CLICK_GUARD = `
  (el) => {
    if (el.closest("form")) return "inside a form";
    const tag = el.tagName.toLowerCase();
    if (tag === "button" && (el.type === "submit" || !el.type)) return "submit button";
    if (tag === "input") return "form input";
    return null;
  }
`;
