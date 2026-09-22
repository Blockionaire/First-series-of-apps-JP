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

export type ExtractResult =
  | { ok: true; items: FeedItem[]; /** Items seen but rejected, and why. */ rejected: string[] }
  | { ok: false; error: string };

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
};
