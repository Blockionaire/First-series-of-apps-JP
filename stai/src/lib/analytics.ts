import { db } from "./db";

/**
 * First-party, aggregate-only analytics.
 *
 * Deliberately the smallest thing that answers three questions: is anyone
 * using STAI, which parts, and do they want STAI+. No third party sees any of
 * it — there is no Google Analytics, no pixel, no external script.
 *
 * What is NOT collected: IP addresses, user ids, user agents, referrers,
 * device fingerprints. The only identifier is a random token in a
 * session-scoped cookie, used to approximate "different browsers" for a visitor
 * count. It disappears when the browser session ends and is never linked to an
 * account.
 */

export const EVENT_KINDS = [
  "page_view",
  "article_view",
  "prompt_view",
  "ask_question",
  "signup",
  "early_access",
  "brief_waitlist",
] as const;
export type EventKind = (typeof EVENT_KINDS)[number];

const KINDS = new Set<string>(EVENT_KINDS);
export const isEventKind = (k: string): k is EventKind => KINDS.has(k);

/** Records one event. Never throws — analytics must not be able to break a page. */
export function track(kind: EventKind, opts: { path?: string; label?: string; visitor?: string } = {}) {
  try {
    db()
      .prepare("INSERT INTO events (kind, path, label, visitor) VALUES (?, ?, ?, ?)")
      .run(kind, (opts.path ?? "").slice(0, 300), (opts.label ?? "").slice(0, 200), (opts.visitor ?? "").slice(0, 64));
  } catch {
    // A failed counter is never worth a failed request.
  }
}

export type Window = "1" | "7" | "30";
const DAYS: Record<Window, number> = { "1": 1, "7": 7, "30": 30 };

function since(w: Window) {
  return `-${DAYS[w]} days`;
}

export type Summary = {
  window: Window;
  pageViews: number;
  visitors: number;
  articleViews: number;
  promptViews: number;
  askQuestions: number;
  signups: number;
  earlyAccess: number;
  briefWaitlist: number;
};

export function summary(w: Window): Summary {
  const d = db();
  const count = (kind: string) =>
    (
      d
        .prepare("SELECT COUNT(*) AS n FROM events WHERE kind=? AND created_at >= datetime('now', ?)")
        .get(kind, since(w)) as { n: number }
    ).n;
  const visitors = (
    d
      .prepare(
        "SELECT COUNT(DISTINCT visitor) AS n FROM events WHERE visitor <> '' AND created_at >= datetime('now', ?)"
      )
      .get(since(w)) as { n: number }
  ).n;
  return {
    window: w,
    pageViews: count("page_view"),
    visitors,
    articleViews: count("article_view"),
    promptViews: count("prompt_view"),
    askQuestions: count("ask_question"),
    signups: count("signup"),
    earlyAccess: count("early_access"),
    briefWaitlist: count("brief_waitlist"),
  };
}

export function topPaths(w: Window, limit = 10): { path: string; n: number }[] {
  return db()
    .prepare(
      `SELECT path, COUNT(*) AS n FROM events
       WHERE kind='page_view' AND path <> '' AND created_at >= datetime('now', ?)
       GROUP BY path ORDER BY n DESC LIMIT ?`
    )
    .all(since(w), limit) as { path: string; n: number }[];
}

export function topContent(w: Window, kind: "article_view" | "prompt_view", limit = 8) {
  return db()
    .prepare(
      `SELECT label, COUNT(*) AS n FROM events
       WHERE kind=? AND label <> '' AND created_at >= datetime('now', ?)
       GROUP BY label ORDER BY n DESC LIMIT ?`
    )
    .all(kind, since(w), limit) as { label: string; n: number }[];
}

/** Retention: aggregate counts are kept for 12 months, as the privacy notice states. */
export function pruneOldEvents() {
  try {
    db().prepare("DELETE FROM events WHERE created_at < datetime('now', '-12 months')").run();
  } catch {
    /* best effort */
  }
}
