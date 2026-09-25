/**
 * One deliberate look at a candidate feed, before anything is approved.
 *
 * The registry asks an operator to decide two things about a URL they cannot
 * see: does it serve a feed, and may we retrieve it. Until now the only way to
 * answer the first was to activate the source and read the health column
 * afterwards — which means granting permission in order to find out whether
 * permission is worth granting. This closes that gap.
 *
 * ── What separates this from `fetchSource` ──────────────────────────────
 * `fetchSource` is the engine's retrieval path: permission-gated, cadence-
 * bound, conditional, and everything it returns is ingested. This is a
 * diagnostic. It is initiated by a named human, once, and nothing it retrieves
 * is stored: no source items, no stories, no ETag, no content. What comes back
 * is a description of what was there, which the operator reads and then
 * decides.
 *
 * Deliberately NOT conditional — no If-None-Match, no If-Modified-Since. A 304
 * is the correct answer to a polling crawler and a useless one to a person
 * asking "what is at this address".
 *
 * ── Why this is not an open fetcher ─────────────────────────────────────
 * The URL is not free text. It must pass `feedUrlBelongsTo` against the
 * registered source's own domain, which is the same rule `validateSource`
 * applies, so the worst an admin can aim this at is a different path on a
 * publisher already in the registry. That is what makes it a feed tester
 * rather than a request-forgery proxy with a login.
 */

import { parseFeed } from "./feed.ts";
import { USER_AGENT } from "./fetcher.ts";
import { extractorFor } from "./extractors/index.ts";
import { hydrate } from "./extractors/hydrate.ts";
import { containedFetch } from "./contained-fetch.ts";

/** What the feed turned out to be, including the cases that are not feeds. */
export type ProbeFormat = "rss" | "atom" | "json" | "html" | "html_extractor" | "unknown";

export type Probe = {
  /** True when a feed parsed. A reachable HTML page is a successful request and a failed probe. */
  ok: boolean;
  httpStatus: number | null;
  /** Where the request ended up. A feed that 301s to a landing page looks fine until you read this. */
  finalUrl: string;
  redirected: boolean;
  contentType: string;
  format: ProbeFormat;
  itemCount: number;
  /** Newest publication instant across the items, or null when the feed carries no usable dates. */
  latestPublishedAt: string | null;
  /** Enough of the feed to recognise whether it is the right one. */
  sampleTitles: string[];
  /** How many items carried no parseable date — a feed of nulls ranks badly forever. */
  itemsWithoutDate: number;
  error: string;
  bytes: number;
  durationMs: number;
  /**
   * The extractor that read this page, when one did.
   *
   * Without it an operator testing an extractor-backed source cannot tell a
   * working extractor from a page that happened to parse as a feed, and those
   * need opposite responses.
   */
  extractor?: string;
  /** Links the extractor saw and refused. A jump here is a template change. */
  rejectedCount?: number;
  /**
   * Publication pages this test opened, and how many the index offered.
   *
   * Reported because a test that opens 6 of 20 and says "6 items" is telling
   * the truth in a way that reads as a smaller source than it is. The operator
   * approving retrieval should see that the index has twenty and that a test
   * deliberately sampled six of them.
   */
  detailsFetched?: number;
  detailsListed?: number;
};

const TIMEOUT_MS = 15_000;
const MAX_BYTES = 4 * 1024 * 1024;
const SAMPLE = 3;
/**
 * Publication pages one test may open.
 *
 * Six, against a retrieval's thirty. A test is a sample: enough to show the
 * operator real headlines and real dates so they can recognise the source,
 * far short of pulling the whole index every time somebody clicks a button.
 */
const PROBE_DETAIL_LIMIT = 6;

/**
 * What is this, really?
 *
 * Answered from the body rather than the Content-Type, because the single most
 * common failure in this registry is a feed URL that has moved and now serves
 * a 200 HTML landing page — often still labelled `application/xml`. The header
 * is reported alongside so the operator can see the disagreement.
 */
export function detectFormat(body: string, contentType = ""): ProbeFormat {
  const head = body.slice(0, 2000).trim();
  if (!head) return "unknown";
  if (/^[[{]/.test(head)) return "json";
  if (/<!doctype\s+html|<html[\s>]/i.test(head)) return "html";
  if (/<feed[\s>]/i.test(head)) return "atom";
  if (/<rss[\s>]|<rdf:RDF[\s>]/i.test(head)) return "rss";
  if (/<entry[\s>]/i.test(body.slice(0, 20_000))) return "atom";
  if (/<item[\s>]/i.test(body.slice(0, 20_000))) return "rss";
  if (/\bjson\b/i.test(contentType)) return "json";
  if (/\bhtml\b/i.test(contentType)) return "html";
  return "unknown";
}

function blank(over: Partial<Probe>): Probe {
  return {
    ok: false,
    httpStatus: null,
    finalUrl: "",
    redirected: false,
    contentType: "",
    format: "unknown",
    itemCount: 0,
    latestPublishedAt: null,
    sampleTitles: [],
    itemsWithoutDate: 0,
    error: "",
    bytes: 0,
    durationMs: 0,
    ...over,
  };
}

/**
 * Fetch a candidate feed once and describe it. Never throws.
 *
 * `hint` is the source's registered ingestion method, passed to the parser so
 * a JSON API that serves no recognisable envelope is still read as JSON.
 */
export async function probeFeed(
  url: string,
  deps: {
    fetch?: typeof globalThis.fetch;
    hint?: string;
    /**
     * The source's registered domain, so an extractor-backed publisher is
     * tested the way it will actually be retrieved. Testing APAS through the
     * feed parser would report "served an HTML page" — true, useless, and not
     * what the engine would do.
     */
    domain?: string;
  } = {}
): Promise<Probe> {
  const started = Date.now();
  const doFetch = deps.fetch ?? globalThis.fetch;
  const elapsed = () => Date.now() - started;

  let res: Response;
  let finalUrl: string;
  try {
    const got = await containedFetch(
      doFetch,
      url,
      {
        headers: {
          "user-agent": USER_AGENT,
          // Broad on purpose. The engine's fetcher advertises what it wants;
          // a diagnostic wants to see whatever the server actually serves,
          // including the HTML page that is the answer we are looking for.
          accept: "application/rss+xml, application/atom+xml, application/xml;q=0.9, application/json;q=0.9, text/xml;q=0.8, */*;q=0.5",
        },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      },
      deps.domain
    );
    if (!got.ok) {
      // Reported with where it was sent: "the feed moved to another host" is
      // a real finding, and the operator decides whether to follow it.
      return blank({
        finalUrl: got.kind === "off_domain" ? got.location : "",
        redirected: got.hops > 0,
        error: got.error,
        durationMs: elapsed(),
      });
    }
    res = got.res;
    finalUrl = got.finalUrl;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const timedOut =
      e instanceof Error && (e.name === "TimeoutError" || /timeout|abort/i.test(message));
    return blank({
      error: timedOut ? `no response within ${TIMEOUT_MS / 1000}s` : message,
      durationMs: elapsed(),
    });
  }

  const contentType = res.headers.get("content-type") ?? "";
  // Where the (contained) chain ended. Reported even on failure: a 404 at a
  // redirected address is a different diagnosis from a 404 at the one typed.
  const base = {
    httpStatus: res.status,
    finalUrl,
    redirected: finalUrl.replace(/\/+$/, "") !== url.replace(/\/+$/, ""),
    contentType,
    durationMs: elapsed(),
  };

  if (!res.ok) {
    return blank({ ...base, error: `${res.status} ${res.statusText}`.trim() });
  }

  let body: string;
  try {
    body = await res.text();
  } catch (e) {
    return blank({ ...base, error: e instanceof Error ? e.message : "body could not be read" });
  }

  if (body.length > MAX_BYTES) {
    return blank({
      ...base,
      bytes: body.length,
      format: detectFormat(body, contentType),
      error: `${body.length} bytes, limit is ${MAX_BYTES}`,
    });
  }

  const format = detectFormat(body, contentType);

  // Extractor-backed sources are probed through their extractor, so what the
  // operator sees is what a discovery run would get.
  const extractor = deps.hint === "html_scrape" ? extractorFor(deps.domain ?? "") : null;
  if (extractor) {
    if (!extractor.accepts(finalUrl)) {
      // Naming the right surfaces turns a true-but-useless refusal into
      // something an operator can act on. The APAS row was registered against
      // the site's landing page, which served 200 and linked plenty of
      // publication-shaped URLs — none of them publications.
      const where = extractor.indexUrls?.length
        ? ` Publications are listed at: ${extractor.indexUrls.join(" · ")}`
        : "";
      return blank({
        ...base,
        bytes: body.length,
        format,
        extractor: extractor.name,
        error: `${extractor.name} does not recognise this URL as a publications index.${where}`,
      });
    }
    const extracted = extractor.extract(body, finalUrl);
    // A two-phase extractor is tested the way it runs, or the test proves
    // nothing about the thing being approved. Capped well below a real
    // retrieval: this is a diagnostic an admin may fire a hundred times an
    // hour, and each firing is requests at a government host.
    const { result: out, fetched, listed } = await hydrate(extractor, extracted, {
      fetch: doFetch,
      userAgent: USER_AGENT,
      limit: PROBE_DETAIL_LIMIT,
    });
    const detail = listed > 0 ? { detailsFetched: fetched, detailsListed: listed } : {};
    if (!out.ok) {
      return blank({
        ...base,
        bytes: body.length,
        format,
        extractor: extractor.name,
        ...detail,
        error: out.error,
        durationMs: elapsed(),
      });
    }
    const dates = out.items.map((i) => i.publishedAt).filter((d): d is string => !!d);
    return {
      ...base,
      ok: out.items.length > 0,
      format: "html_extractor",
      extractor: extractor.name,
      ...detail,
      rejectedCount: out.rejected.length,
      bytes: body.length,
      itemCount: out.items.length,
      latestPublishedAt: dates.length
        ? dates.reduce((a, b) => (Date.parse(b) > Date.parse(a) ? b : a))
        : null,
      sampleTitles: out.items.slice(0, SAMPLE).map((i) => i.title),
      itemsWithoutDate: out.items.length - dates.length,
      error: out.items.length === 0 ? "the extractor ran but found no publications" : "",
      durationMs: elapsed(),
    };
  }

  const parsed = parseFeed(body, deps.hint);

  if (!parsed.ok) {
    return blank({
      ...base,
      bytes: body.length,
      format,
      error: parsed.error,
      durationMs: elapsed(),
    });
  }

  const dated = parsed.items.map((i) => i.publishedAt).filter((d): d is string => !!d);
  // Compared as instants, not strings: feeds mix offsets, and "+02:00" sorts
  // before "Z" lexically while being later in time.
  const latest = dated.length
    ? dated.reduce((a, b) => (Date.parse(b) > Date.parse(a) ? b : a))
    : null;

  return {
    ...base,
    // An empty feed parsed correctly and is still not something to approve, so
    // it is not `ok`. The error says which of the two happened.
    ok: parsed.items.length > 0,
    format: parsed.format,
    bytes: body.length,
    itemCount: parsed.items.length,
    latestPublishedAt: latest,
    sampleTitles: parsed.items.slice(0, SAMPLE).map((i) => i.title),
    itemsWithoutDate: parsed.items.length - dated.length,
    error: parsed.items.length === 0 ? "parsed as a feed but contains no items" : "",
    durationMs: elapsed(),
  };
}
