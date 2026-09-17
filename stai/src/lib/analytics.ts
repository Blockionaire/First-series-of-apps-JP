import { sql } from "./sql";

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

/**
 * Records one event. Never throws — analytics must not be able to break a page.
 *
 * Await it. It used to be fire-and-forget, which was harmless when the write
 * was synchronous; with an async database an un-awaited promise can outlive the
 * response, and on Workers an isolate may be torn down before it settles.
 */
export async function track(
  kind: EventKind,
  opts: { path?: string; label?: string; visitor?: string } = {}
): Promise<void> {
  try {
    await sql().run("INSERT INTO events (kind, path, label, visitor) VALUES (?, ?, ?, ?)", [
      kind,
      (opts.path ?? "").slice(0, 300),
      (opts.label ?? "").slice(0, 200),
      (opts.visitor ?? "").slice(0, 64),
    ]);
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

export async function summary(w: Window): Promise<Summary> {
  const s = sql();
  const count = async (kind: string) =>
    (
      (await s.first<{ n: number }>(
        "SELECT COUNT(*) AS n FROM events WHERE kind=? AND created_at >= datetime('now', ?)",
        [kind, since(w)]
      )) ?? { n: 0 }
    ).n;
  const visitorRow = await s.first<{ n: number }>(
    "SELECT COUNT(DISTINCT visitor) AS n FROM events WHERE visitor <> '' AND created_at >= datetime('now', ?)",
    [since(w)]
  );
  return {
    window: w,
    pageViews: await count("page_view"),
    visitors: visitorRow?.n ?? 0,
    articleViews: await count("article_view"),
    promptViews: await count("prompt_view"),
    askQuestions: await count("ask_question"),
    signups: await count("signup"),
    earlyAccess: await count("early_access"),
    briefWaitlist: await count("brief_waitlist"),
  };
}

export async function topPaths(w: Window, limit = 10): Promise<{ path: string; n: number }[]> {
  return sql().all<{ path: string; n: number }>(
    `SELECT path, COUNT(*) AS n FROM events
     WHERE kind='page_view' AND path <> '' AND created_at >= datetime('now', ?)
     GROUP BY path ORDER BY n DESC LIMIT ?`,
    [since(w), limit]
  );
}

export async function topContent(
  w: Window,
  kind: "article_view" | "prompt_view",
  limit = 8
): Promise<{ label: string; n: number }[]> {
  return sql().all<{ label: string; n: number }>(
    `SELECT label, COUNT(*) AS n FROM events
     WHERE kind=? AND label <> '' AND created_at >= datetime('now', ?)
     GROUP BY label ORDER BY n DESC LIMIT ?`,
    [kind, since(w), limit]
  );
}

/** Retention: aggregate counts are kept for 12 months, as the privacy notice states. */
export async function pruneOldEvents(): Promise<void> {
  try {
    await sql().run("DELETE FROM events WHERE created_at < datetime('now', '-12 months')");
  } catch {
    /* best effort */
  }
}
