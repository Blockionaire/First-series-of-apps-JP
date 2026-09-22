/**
 * What a site-specific extractor is, and what it is not.
 *
 * ── The rule this type exists to enforce ────────────────────────────────
 * There is no generic scraper and there must never be one. A function that
 * takes any HTML page and returns "the articles" is wrong in a way that looks
 * right: it fills the Inbox with navigation links, cookie banners and footer
 * items, all of which cluster and rank like real stories, and the failure is
 * invisible until somebody reads a published piece sourced from a menu entry.
 *
 * So an extractor is bound to ONE publisher. It declares the domain it serves,
 * it refuses to run against a URL it does not recognise, and it validates
 * every item it produces against that publisher's own conventions. Adding a
 * site means writing a file; there is no configuration that turns this loose
 * on an arbitrary page.
 *
 * ── Failing loudly ──────────────────────────────────────────────────────
 * An extractor returns an ERROR rather than an empty list when a page parses
 * but yields nothing recognisable. A silent empty result reads as "this
 * regulator published nothing this week", which is indistinguishable from
 * "this regulator redesigned their site and we have been blind for a month".
 * The first is news; the second is an outage, and it has to look like one.
 */

import type { FeedItem } from "../feed.ts";

/**
 * A link the index recognised as a publication, whose facts are not on the index.
 *
 * Some publishers list their publications by link alone: the anchor carries a
 * file name and nothing else, and the title and date live on the page behind
 * it. APAS is one — its Verlautbarungen index links
 * `/SharedDocs/Downloads/APAS/DE/vb_verlautbarung_26.html` with no headline
 * and no date anywhere near it.
 *
 * The honest response to that is a second request, not a guess. `linkText` is
 * carried for the error message only: it is what the index called the link,
 * which is exactly the thing that turned out not to be a title.
 */
export type PendingDetail = {
  url: string;
  linkText?: string;
};

export type ExtractResult =
  | {
      ok: true;
      items: FeedItem[];
      /** Items seen but rejected, and why. */
      rejected: string[];
      /**
       * Recognised publications that still need their detail page read.
       *
       * The extractor does not fetch these — it stays pure and testable
       * against a saved fixture. `hydrate()` makes the requests and feeds each
       * body back through `detail()`.
       */
      pending?: PendingDetail[];
    }
  | { ok: false; error: string };

/** One detail page, parsed. */
export type DetailResult = { ok: true; item: FeedItem } | { ok: false; error: string };

export type Extractor = {
  /** The single registered domain this serves. Matched exactly, or as a subdomain. */
  domain: string;
  /** For the fetch log and the admin UI. */
  name: string;
  /**
   * Is this a page this extractor understands?
   *
   * Checked before any parsing. An extractor pointed at a publisher's home
   * page, or at a page on the right domain that is not an index of
   * publications, must say so rather than guess.
   */
  accepts(url: string): boolean;
  /**
   * Where this publisher actually lists its publications.
   *
   * Candidates, not gospel — nobody here has fetched them. Their job is to
   * make a refusal actionable: "this is the homepage" is a true and useless
   * error, while "this is the homepage; publications are listed at X or Y" is
   * something an operator can act on without reading the source.
   *
   * The APAS row was registered against the site's landing page, which served
   * 200 and linked plenty of /SharedDocs/ URLs — none of them publications.
   * That is the failure this exists to shorten.
   */
  indexUrls?: string[];
  extract(html: string, pageUrl: string): ExtractResult;
  /**
   * Read ONE publication's detail page.
   *
   * Required whenever `extract` can return `pending`, and pure for the same
   * reason `extract` is: the fetching lives in `hydrate()`, so a detail page
   * can be tested from a saved fixture without a network.
   *
   * The contract is deliberately all-or-nothing. A detail page that yields no
   * title, or no date, returns an error and the publication is not emitted —
   * an undated regulatory pronouncement cannot be ranked for recency or judged
   * by the freshness gate, and a title taken from a file name is not a title.
   */
  detail?(html: string, pageUrl: string): DetailResult;
  /**
   * How many detail pages one retrieval may open.
   *
   * A courtesy limit, not a correctness one. The index is a list that grows;
   * without a cap a redesign that made every nav link look like a publication
   * would turn one poll into several hundred requests at a government host.
   */
  detailLimit?: number;
};
