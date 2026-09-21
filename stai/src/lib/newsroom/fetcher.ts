/**
 * Retrieval, and the checks in front of it.
 *
 * Every outbound request the engine makes goes through `fetchSource`. That is
 * the point of the module: the permission rules are not scattered across the
 * orchestrator where a future code path could route around them.
 *
 * ── Three things that must be true before a byte moves ──────────────────
 *   1. the source is `active`     — a human wants it;
 *   2. the source is `fetch_allowed` — a human checked that retrieval is
 *      permitted by robots.txt and the site's terms;
 *   3. the source is due          — its cadence has elapsed.
 *
 * All three are checked here, and each produces a distinct, recorded outcome.
 * "Nothing came from the AFM today" has three very different explanations and
 * an operator cannot act on the first without being able to tell it from the
 * third.
 *
 * ── No silent fallback ──────────────────────────────────────────────────
 * When a feed fails, this reports the failure. It does not try the site's home
 * page, does not switch to scraping, and does not guess an alternative URL.
 * A crawler that responds to a 404 by fetching something else is a crawler
 * nobody approved, and the registry's whole premise is that every retrieval
 * was approved in advance.
 */

import { parseFeed, type FeedItem } from "./feed.ts";
import type { IngestionMethod, Source } from "./sources.ts";

/** Every way a fetch attempt can end. Recorded verbatim in newsroom_fetch_log. */
export const FETCH_OUTCOMES = [
  "ok",
  "not_modified",
  "empty_feed",
  "http_error",
  "network_error",
  "timeout",
  "parse_error",
  "too_large",
  "skipped_inactive",
  "skipped_not_permitted",
  "skipped_not_due",
  "skipped_manual",
  "skipped_unsupported",
] as const;
export type FetchOutcome = (typeof FETCH_OUTCOMES)[number];

/** Outcomes that mean we never made a request. */
export const SKIP_OUTCOMES: readonly FetchOutcome[] = [
  "skipped_inactive",
  "skipped_not_permitted",
  "skipped_not_due",
  "skipped_manual",
  "skipped_unsupported",
];

/** Outcomes that mean the source is not working and somebody should look. */
export const FAILURE_OUTCOMES: readonly FetchOutcome[] = [
  "http_error",
  "network_error",
  "timeout",
  "parse_error",
  "too_large",
];

export type FetchResult = {
  outcome: FetchOutcome;
  httpStatus?: number;
  error: string;
  items: FeedItem[];
  /** Validators to store for the next conditional request. */
  etag?: string;
  lastModified?: string;
  durationMs: number;
};

/** Beyond this a "feed" is something else — an error page, or a whole site. */
const MAX_BYTES = 4 * 1024 * 1024;

const TIMEOUT_MS = 15_000;

/**
 * Identify the crawler honestly.
 *
 * A publisher who wants to block this, or to ask us to slow down, has to be
 * able to recognise it and find out who we are. An anonymous crawler hammering
 * a regulator's feed is the behaviour that gets an IP range banned and, for a
 * publication that writes about compliance, is not a good look.
 */
export const USER_AGENT =
  "STAI-Newsroom/1.0 (+https://stai-ahead.com/about; audit and finance intelligence desk)";

/** Which ingestion methods phase 2 can actually retrieve. */
const SUPPORTED: readonly IngestionMethod[] = ["rss", "atom", "json_api"];

export type DueCheck = { due: true } | { due: false; outcome: FetchOutcome; reason: string };

/**
 * Should this source be fetched right now?
 *
 * Separated from the fetch so it is testable without a network, and so the
 * orchestrator can log a skip without constructing a request.
 */
export function shouldFetch(
  source: Pick<
    Source,
    "active" | "fetch_allowed" | "ingestion_method" | "fetch_frequency" | "last_attempt_at"
  > & { last_attempt_at?: string | null },
  now = Date.now(),
  force = false
): DueCheck {
  if (!source.active) {
    return { due: false, outcome: "skipped_inactive", reason: "source is not activated" };
  }
  if (!source.fetch_allowed) {
    return {
      due: false,
      outcome: "skipped_not_permitted",
      reason: "retrieval has not been approved for this source",
    };
  }
  if (source.ingestion_method === "manual") {
    return { due: false, outcome: "skipped_manual", reason: "entered by hand, never fetched" };
  }
  if (!SUPPORTED.includes(source.ingestion_method)) {
    // html_scrape is registered but not implemented in phase 2. Saying so is
    // better than a generic extractor that fills the Inbox with navigation
    // links and looks like it works.
    return {
      due: false,
      outcome: "skipped_unsupported",
      reason: `${source.ingestion_method} is not implemented yet — no generic scraper is used`,
    };
  }

  // `force` exists for the manual "run discovery now" button. It skips the
  // cadence check and nothing else: permission is never forced.
  if (force) return { due: true };

  const last = source.last_attempt_at ? Date.parse(source.last_attempt_at) : NaN;
  if (Number.isFinite(last) && now - last < source.fetch_frequency * 60_000) {
    const mins = Math.round((now - last) / 60_000);
    return {
      due: false,
      outcome: "skipped_not_due",
      reason: `last attempted ${mins}m ago, cadence is ${source.fetch_frequency}m`,
    };
  }
  return { due: true };
}

/**
 * Retrieve one source. Never throws.
 *
 * A failing source must not take down a discovery run that has forty other
 * sources to visit, so every error path here becomes a recorded outcome.
 */
export async function fetchSource(
  source: Pick<Source, "feed_url" | "ingestion_method" | "etag" | "last_modified_header">,
  deps: { fetch?: typeof globalThis.fetch } = {}
): Promise<FetchResult> {
  const started = Date.now();
  const doFetch = deps.fetch ?? globalThis.fetch;
  const elapsed = () => Date.now() - started;

  const headers: Record<string, string> = {
    "user-agent": USER_AGENT,
    accept:
      source.ingestion_method === "json_api"
        ? "application/json, application/feed+json;q=0.9, */*;q=0.1"
        : "application/rss+xml, application/atom+xml, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.1",
  };
  // Conditional request. Most polls then cost a 304 with no body, which is
  // the difference between a courteous crawler and one that gets blocked.
  if (source.etag) headers["if-none-match"] = source.etag;
  if (source.last_modified_header) headers["if-modified-since"] = source.last_modified_header;

  let res: Response;
  try {
    res = await doFetch(source.feed_url, {
      headers,
      redirect: "follow",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const timedOut = e instanceof Error && (e.name === "TimeoutError" || /timeout|abort/i.test(message));
    return {
      outcome: timedOut ? "timeout" : "network_error",
      error: timedOut ? `no response within ${TIMEOUT_MS / 1000}s` : message,
      items: [],
      durationMs: elapsed(),
    };
  }

  if (res.status === 304) {
    return {
      outcome: "not_modified",
      httpStatus: 304,
      error: "",
      items: [],
      etag: source.etag,
      lastModified: source.last_modified_header,
      durationMs: elapsed(),
    };
  }

  if (!res.ok) {
    return {
      outcome: "http_error",
      httpStatus: res.status,
      error: `${res.status} ${res.statusText}`.trim(),
      items: [],
      durationMs: elapsed(),
    };
  }

  const declared = Number(res.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > MAX_BYTES) {
    return {
      outcome: "too_large",
      httpStatus: res.status,
      error: `${declared} bytes declared, limit is ${MAX_BYTES}`,
      items: [],
      durationMs: elapsed(),
    };
  }

  let body: string;
  try {
    body = await res.text();
  } catch (e) {
    return {
      outcome: "network_error",
      httpStatus: res.status,
      error: e instanceof Error ? e.message : "body could not be read",
      items: [],
      durationMs: elapsed(),
    };
  }

  if (body.length > MAX_BYTES) {
    return {
      outcome: "too_large",
      httpStatus: res.status,
      error: `${body.length} bytes received, limit is ${MAX_BYTES}`,
      items: [],
      durationMs: elapsed(),
    };
  }

  const parsed = parseFeed(body, source.ingestion_method);
  if (!parsed.ok) {
    return {
      outcome: "parse_error",
      httpStatus: res.status,
      error: parsed.error,
      items: [],
      durationMs: elapsed(),
    };
  }

  return {
    // A feed that parses to zero items is not an error, but it is not health
    // either: repeated over a day it is how a redesigned site looks. It gets
    // its own outcome so the health check can see the pattern.
    outcome: parsed.items.length === 0 ? "empty_feed" : "ok",
    httpStatus: res.status,
    error: "",
    items: parsed.items,
    etag: res.headers.get("etag") ?? "",
    lastModified: res.headers.get("last-modified") ?? "",
    durationMs: elapsed(),
  };
}
