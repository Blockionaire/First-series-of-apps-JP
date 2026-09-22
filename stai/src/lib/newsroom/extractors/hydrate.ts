/**
 * The second request: opening a publication's own page to learn what it is.
 *
 * ── Why this exists at all ──────────────────────────────────────────────
 * Most publishers put the facts on the index. A feed entry, or a well-built
 * listing page, carries the headline and the date beside the link, and one
 * request is the whole job.
 *
 * APAS does not. Its Verlautbarungen index links
 *
 *     /SharedDocs/Downloads/APAS/DE/vb_verlautbarung_26.html
 *
 * and the anchor text is a file reference, not a headline; the date is not on
 * the index at all. There are exactly two honest responses to that. One is to
 * refuse the source, which costs the desk its only primary source for German
 * audit oversight. The other is to open the page and read it. This is the
 * second, made explicit and bounded rather than left to each extractor to
 * improvise.
 *
 * ── Why the fetching is here and not in the extractor ───────────────────
 * Extractors stay pure. `extract()` and `detail()` take HTML and return
 * results, which is what lets every one of them be tested against a saved
 * fixture with no network — the property that makes this suite meaningful in
 * a build environment that has never been able to reach a real site.
 *
 * So the extractor names the pages it needs (`pending`) and parses them when
 * handed the bodies (`detail`), and exactly one module knows how to make a
 * request. Putting `fetch` inside apas.ts would have been fewer lines and
 * would have made the APAS rules untestable.
 *
 * ── Why this is not a crawler ───────────────────────────────────────────
 * It follows links the extractor has already recognised as publications of
 * that publisher, one level deep, up to a cap, and never follows a link found
 * on a detail page. Every URL is re-checked against the extractor's own
 * `accepts`-grade rules before it is requested, so a redesign that put a
 * third-party link where a publication used to be cannot send a request off
 * the publisher's domain.
 */

import type { FeedItem } from "../feed.ts";
import type { ExtractResult, Extractor } from "./types.ts";

const TIMEOUT_MS = 15_000;
const MAX_BYTES = 2 * 1024 * 1024;

/** Requests per retrieval when the extractor names no limit of its own. */
export const DEFAULT_DETAIL_LIMIT = 25;

export type HydrateDeps = {
  fetch?: typeof globalThis.fetch;
  userAgent?: string;
  /** Overrides the extractor's own cap. The probe passes a smaller one. */
  limit?: number;
};

export type Hydrated = {
  result: ExtractResult;
  /** Detail pages actually requested. */
  fetched: number;
  /** Detail pages the index offered, before the cap. */
  listed: number;
};

/**
 * Turn an extract result's `pending` links into finished items.
 *
 * Returns the result unchanged when there is nothing pending, so every caller
 * can run this unconditionally and no caller has to know which extractors are
 * two-phase.
 */
export async function hydrate(
  extractor: Extractor,
  out: ExtractResult,
  deps: HydrateDeps = {}
): Promise<Hydrated> {
  if (!out.ok) return { result: out, fetched: 0, listed: 0 };

  const pending = out.pending ?? [];
  if (pending.length === 0) return { result: out, fetched: 0, listed: 0 };

  if (!extractor.detail) {
    // A programming error, not a site change, so it says so plainly rather
    // than blaming the publisher's template.
    return {
      result: {
        ok: false,
        error: `${extractor.name} returned ${pending.length} pages to open but implements no detail parser`,
      },
      fetched: 0,
      listed: pending.length,
    };
  }

  const doFetch = deps.fetch ?? globalThis.fetch;
  const cap = Math.max(0, deps.limit ?? extractor.detailLimit ?? DEFAULT_DETAIL_LIMIT);

  const items: FeedItem[] = [...out.items];
  const rejected: string[] = [...out.rejected];
  const seen = new Set(items.map((i) => i.url));

  let fetched = 0;

  for (const p of pending.slice(0, cap)) {
    if (seen.has(p.url)) continue;

    // The last line of defence before a request leaves the building.
    //
    // Deliberately the DOMAIN and not `accepts`: `accepts` answers "is this a
    // publications index", which a publication page is not, so testing it here
    // would refuse exactly the URLs this exists to open. What must hold is
    // that the request goes to the publisher this extractor is registered for
    // — that is the property that makes following a link one level deep safe,
    // and it holds even for a future extractor whose own checks are wrong.
    if (!sameRegisteredDomain(p.url, extractor.domain)) {
      rejected.push(`${p.url} — outside ${extractor.domain}, not opened`);
      continue;
    }

    // Sequential on purpose. These are government hosts serving a handful of
    // publications a month; opening twenty connections at once to save four
    // seconds on a job that runs on a cron is the kind of politeness failure
    // that ends in a block, and a block costs the source entirely.
    const body = await readPage(doFetch, p.url, deps.userAgent);
    fetched += 1;

    if (!body.ok) {
      rejected.push(`${p.url} — ${body.error}`);
      continue;
    }

    const parsed = extractor.detail(body.text, body.finalUrl);
    if (!parsed.ok) {
      rejected.push(`${p.url} — ${parsed.error}`);
      continue;
    }

    if (seen.has(parsed.item.url)) continue;
    seen.add(parsed.item.url);
    items.push(parsed.item);
  }

  // Every page opened, every page refused. On a site that was working
  // yesterday this is a template change, and it has to read as an outage
  // rather than as a quiet week — the whole reason extractors fail loudly.
  if (items.length === 0 && fetched > 0) {
    return {
      result: {
        ok: false,
        error:
          `opened ${fetched} of ${pending.length} publication pages and none yielded both a ` +
          `title and a date — the page structure has probably changed (${rejected[0] ?? "no detail"})`,
      },
      fetched,
      listed: pending.length,
    };
  }

  return {
    result: { ok: true, items, rejected },
    fetched,
    listed: pending.length,
  };
}

/** Same registered domain, or a subdomain of it. */
function sameRegisteredDomain(url: string, domain: string): boolean {
  try {
    const host = new URL(url).host.toLowerCase().replace(/^www\./, "");
    return host === domain || host.endsWith(`.${domain}`);
  } catch {
    return false;
  }
}

type Page = { ok: true; text: string; finalUrl: string } | { ok: false; error: string };

async function readPage(
  doFetch: typeof globalThis.fetch,
  url: string,
  userAgent?: string
): Promise<Page> {
  let res: Response;
  try {
    res = await doFetch(url, {
      headers: {
        accept: "text/html, application/xhtml+xml;q=0.9, */*;q=0.1",
        ...(userAgent ? { "user-agent": userAgent } : {}),
      },
      redirect: "follow",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const timedOut = e instanceof Error && (e.name === "TimeoutError" || /timeout|abort/i.test(message));
    return { ok: false, error: timedOut ? `no response within ${TIMEOUT_MS / 1000}s` : message };
  }

  if (!res.ok) return { ok: false, error: `${res.status} ${res.statusText}`.trim() };

  let text: string;
  try {
    text = await res.text();
  } catch {
    return { ok: false, error: "body could not be read" };
  }
  if (text.length > MAX_BYTES) {
    return { ok: false, error: `${text.length} bytes, limit is ${MAX_BYTES}` };
  }
  return { ok: true, text, finalUrl: res.url || url };
}
