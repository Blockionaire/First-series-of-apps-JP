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

/* ── Shape over time ──────────────────────────────────────────────────────
 *
 * Buckets are UTC, because `datetime('now')` — which stamps every row — is
 * UTC. Reading them back in local time would shift every count by the offset
 * and quietly put this evening's traffic on tomorrow.
 *
 * They are also ROLLING, not calendar: "24 hours" means the last 24 hours,
 * matching the existing summary() windows. A calendar day would need a
 * timezone the server does not have.
 */

export type Bucket = { key: string; label: string; pageViews: number; visitors: number };

/** SQLite strftime formats. Fixed strings from this file, never from a request. */
const BUCKET = {
  hour: { fmt: "%Y-%m-%dT%H", slice: 13, step: 3_600_000 },
  day: { fmt: "%Y-%m-%d", slice: 10, step: 86_400_000 },
} as const;

/**
 * Page views and visitors per bucket across the window.
 *
 * GROUP BY only returns buckets that have rows, so the empty ones are
 * generated here and filled with zero. Without that a quiet Tuesday would not
 * flatten the line, it would vanish from the axis and make the chart lie about
 * how much time had passed.
 */
export async function timeSeries(w: Window): Promise<Bucket[]> {
  const hourly = w === "1";
  const { fmt, slice, step } = hourly ? BUCKET.hour : BUCKET.day;
  const count = hourly ? 24 : DAYS[w];

  const rows = await sql().all<{ bucket: string; views: number; visitors: number }>(
    `SELECT strftime('${fmt}', created_at) AS bucket,
            SUM(CASE WHEN kind='page_view' THEN 1 ELSE 0 END) AS views,
            COUNT(DISTINCT CASE WHEN visitor <> '' THEN visitor END) AS visitors
       FROM events
      WHERE created_at >= datetime('now', ?)
      GROUP BY bucket`,
    [since(w)]
  );
  const byKey = new Map(rows.map((r) => [r.bucket, r]));

  const now = Date.now();
  const out: Bucket[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const at = new Date(now - i * step);
    const key = at.toISOString().slice(0, slice);
    const hit = byKey.get(key);
    out.push({
      key,
      label: hourly ? `${key.slice(11)}:00 UTC` : key.slice(5),
      pageViews: hit?.views ?? 0,
      visitors: hit?.visitors ?? 0,
    });
  }
  return out;
}

/* ── Live ─────────────────────────────────────────────────────────────── */

export type Live = { now: number; buckets: number[]; minutes: number };

/**
 * Visitors seen in the last five minutes, plus the last hour in five-minute
 * buckets for the sparkline.
 *
 * Five minutes is the window every other analytics tool calls "now", and it is
 * a floor as much as a ceiling: shorter than that and a reader who is quietly
 * reading a long briefing disappears from the count.
 */
export async function liveVisitors(): Promise<Live> {
  const s = sql();
  const nowRow = await s.first<{ n: number }>(
    "SELECT COUNT(DISTINCT visitor) AS n FROM events WHERE visitor <> '' AND created_at >= datetime('now', '-5 minutes')"
  );
  const rows = await s.all<{ bucket: string; n: number }>(
    `SELECT CAST((strftime('%s','now') - strftime('%s', created_at)) / 300 AS INTEGER) AS bucket,
            COUNT(DISTINCT visitor) AS n
       FROM events
      WHERE visitor <> '' AND created_at >= datetime('now', '-60 minutes')
      GROUP BY bucket`
  );
  const byBucket = new Map(rows.map((r) => [Number(r.bucket), r.n]));
  // Oldest first, so the sparkline reads left-to-right like every other chart.
  const buckets = Array.from({ length: 12 }, (_, i) => byBucket.get(11 - i) ?? 0);
  return { now: nowRow?.n ?? 0, buckets, minutes: 60 };
}

/* ── Funnel ───────────────────────────────────────────────────────────── */

export type FunnelStep = { label: string; n: number; of: number | null };

/**
 * Visitors → the three things they can commit to.
 *
 * Every step is measured against visitors rather than against the step above,
 * because these are not sequential: someone can join the Brief waitlist
 * without an account. Stacking them as a classic funnel would invent a path
 * the product does not have.
 */
export async function funnel(w: Window): Promise<FunnelStep[]> {
  const s = await summary(w);
  const base = s.visitors;
  // `of` is the denominator a rate is quoted against; null when there is no
  // denominator to quote, so the page prints nothing rather than "0%".
  const of = base > 0 ? base : null;
  return [
    { label: "Visitors", n: base, of: null },
    { label: "Account signups", n: s.signups, of },
    { label: "STAI+ early access", n: s.earlyAccess, of },
    { label: "Brief waitlist", n: s.briefWaitlist, of },
  ];
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
