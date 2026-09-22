/**
 * Turning a feed entry into a row we can deduplicate.
 *
 * Deduplication is only as good as the key it compares. The same press
 * release reaches this system as
 *
 *   https://ec.europa.eu/…/ip_26_1234
 *   https://ec.europa.eu/…/ip_26_1234?utm_source=rss&utm_medium=feed
 *   https://www.ec.europa.eu/…/ip_26_1234/#main-content
 *
 * and unless those three collapse to one string, the Inbox shows one
 * development three times and the clusterer has to work out that they match.
 * Canonicalisation is therefore not tidying — it is the dedup key.
 */

import { GLOBAL, isJurisdiction } from "./jurisdictions.ts";

/**
 * Query parameters that never identify a different document.
 *
 * Tracking parameters and feed markers only. Anything not on this list is
 * KEPT, because a parameter can be load-bearing — `?doc=32024R1689` is a
 * different regulation, and stripping unknown parameters would merge distinct
 * documents into one. Over-merging is worse than under-merging: a missed
 * duplicate shows up twice in a list, a wrong merge loses a story.
 */
const TRACKING_PARAMS = [
  /^utm_/i,
  /^ga_/i,
  /^mc_/i,
  /^_hs/i,
  /^fbclid$/i,
  /^gclid$/i,
  /^msclkid$/i,
  /^igshid$/i,
  /^mkt_tok$/i,
  /^ref$/i,
  /^source$/i,
  /^at_medium$/i,
  /^at_campaign$/i,
];

const isTracking = (k: string) => TRACKING_PARAMS.some((re) => re.test(k));

/**
 * The address this item will be known by.
 *
 * Returns null for anything that is not an http(s) URL, which drops
 * javascript:, mailto: and relative links that could not be resolved.
 */
export function canonicalUrl(raw: string, base?: string): string | null {
  let u: URL;
  try {
    u = base ? new URL(raw, base) : new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;

  // A fragment is a position within a document, never a different document.
  u.hash = "";
  u.hostname = u.hostname.toLowerCase().replace(/^www\./, "");
  // Default ports carry no meaning.
  if ((u.protocol === "https:" && u.port === "443") || (u.protocol === "http:" && u.port === "80")) {
    u.port = "";
  }

  for (const key of [...u.searchParams.keys()]) {
    if (isTracking(key)) u.searchParams.delete(key);
  }
  // Stable parameter order, so two orderings of the same query match.
  u.searchParams.sort();

  // Java session ids, which are path parameters rather than query ones and so
  // survive every check above.
  //
  // These matter more than they look. Java-backed sites — which is most of the
  // European public sector, including APAS and much of the Commission — append
  // `;jsessionid=…` for any visitor without a session cookie, and a crawler is
  // permanently in that state. Left in place, the SAME page arrives under a
  // NEW address on every single run: the URL is identity here, so each visit
  // would insert a fresh item, create a fresh story, and the Inbox would fill
  // with duplicates of one announcement.
  u.pathname = u.pathname.replace(/;jsessionid=[^/;?]*/gi, "");

  // One trailing slash policy, applied to paths only — "/news" and "/news/"
  // are the same page everywhere this engine looks.
  if (u.pathname.length > 1 && u.pathname.endsWith("/")) {
    u.pathname = u.pathname.replace(/\/+$/, "");
  }

  return u.toString();
}

/**
 * Stable hash, as hex.
 *
 * SHA-256 through Web Crypto, which exists in both runtimes this ships to —
 * Node 22 and Workers — so the hash of a document is the same wherever it was
 * computed. That matters: a local run and a production run must agree, or
 * every item re-enters as new the first time the runtime changes.
 */
export async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * The content fingerprint for an item.
 *
 * Title and lead, not the whole page: what we want to detect is "this entry
 * changed meaningfully", and feeds routinely re-serve identical entries with a
 * different timestamp or a reordered set of attributes. Hashing the fetched
 * bytes would make every poll look like a change; hashing the address alone
 * would miss a corrected headline.
 */
export function contentFingerprint(item: { title: string; lead: string }): string {
  return `${item.title.trim()}\n${item.lead.trim()}`;
}

/**
 * The jurisdictions to file an item under.
 *
 * Starts from what the source speaks for — a Dutch regulator's feed is NL —
 * and adds anything the text itself names. An EU-wide publication regularly
 * carries an item specifically about one member state, and filing that as
 * plain "EU" would put it in front of the wrong readers.
 *
 * Deliberately conservative. This is a keyword pass, not an entity model, and
 * it only ever ADDS to what the source declares. Nothing here can remove a
 * jurisdiction a human set on the source, because a weak signal must not
 * overrule a considered one.
 */
const JURISDICTION_HINTS: { code: string; patterns: RegExp[] }[] = [
  { code: "NL", patterns: [/\bnetherlands\b/i, /\bdutch\b/i, /\bAFM\b/, /\bNBA\b/, /\bKVK\b/] },
  { code: "UK", patterns: [/\bunited kingdom\b/i, /\bbritish\b/i, /\bFRC\b/, /\bICAEW\b/, /\bHMRC\b/, /\bLondon Stock Exchange\b/i] },
  { code: "DE", patterns: [/\bgermany\b/i, /\bgerman\b/i, /\bBaFin\b/, /\bAPAS\b/, /\bWPK\b/] },
  { code: "FR", patterns: [/\bfrance\b/i, /\bfrench\b/i, /\bAMF\b/, /\bH3C\b/] },
  { code: "BE", patterns: [/\bbelgium\b/i, /\bbelgian\b/i, /\bFSMA\b/] },
  { code: "IE", patterns: [/\bireland\b/i, /\birish\b/i, /\bIAASA\b/] },
  { code: "ES", patterns: [/\bspain\b/i, /\bspanish\b/i, /\bCNMV\b/, /\bICAC\b/] },
  { code: "IT", patterns: [/\bitaly\b/i, /\bitalian\b/i, /\bCONSOB\b/] },
  { code: "LU", patterns: [/\bluxembourg\b/i, /\bCSSF\b/] },
  { code: "CH", patterns: [/\bswitzerland\b/i, /\bswiss\b/i, /\bFINMA\b/] },
  { code: "AT", patterns: [/\baustria\b/i, /\baustrian\b/i] },
  { code: "PL", patterns: [/\bpoland\b/i, /\bpolish\b/i] },
  { code: "PT", patterns: [/\bportugal\b/i, /\bportuguese\b/i] },
  { code: "NORDICS", patterns: [/\bsweden\b/i, /\bswedish\b/i, /\bdenmark\b/i, /\bdanish\b/i, /\bnorway\b/i, /\bnorwegian\b/i, /\bfinland\b/i, /\bfinnish\b/i, /\bnordic\b/i] },
  { code: "EU", patterns: [/\beuropean union\b/i, /\beuropean commission\b/i, /\bEU AI Act\b/i, /\bCSRD\b/, /\bESRS\b/, /\bESMA\b/, /\bEFRAG\b/, /\bdirective\b/i] },
  { code: "US", patterns: [/\bunited states\b/i, /\bPCAOB\b/, /\bSEC\b/, /\bFASB\b/] },
  { code: "APAC", patterns: [/\bsingapore\b/i, /\bhong kong\b/i, /\bjapan\b/i, /\baustralia\b/i] },
];

export function inferJurisdictions(text: string, sourceJurisdictions: string[]): string[] {
  const found = new Set(sourceJurisdictions.filter(isJurisdiction));

  for (const hint of JURISDICTION_HINTS) {
    if (hint.patterns.some((re) => re.test(text))) found.add(hint.code);
  }

  // GLOBAL is exclusive (masterplan §19b). If the text names a specific
  // market, the piece is about that market and mentions a global instrument —
  // it is not global. Dropping GLOBAL here rather than failing validation
  // keeps the rule true without discarding the item.
  if (found.size > 1) found.delete(GLOBAL);
  if (found.size === 0) found.add(GLOBAL);

  return [...found];
}

export type NormalisedItem = {
  url: string;
  urlHash: string;
  title: string;
  lead: string;
  publishedAt: string | null;
  contentHash: string;
  jurisdictions: string[];
  /** The official document behind the page, where the publisher links one. */
  documentUrl: string;
  /** The publisher's own label for the item, verbatim. */
  category: string;
};

/**
 * Normalise one parsed feed entry against the source it came from.
 *
 * Returns null when the entry cannot be made usable — no resolvable address,
 * or no title. Dropping is right: an item with no address can be neither
 * deduplicated nor cited nor opened, and one with no title cannot be
 * clustered or read.
 */
export async function normaliseItem(
  item: {
    url: string;
    title: string;
    lead: string;
    publishedAt: string | null;
    documentUrl?: string;
    category?: string;
  },
  source: { feed_url: string; jurisdictions: string[] }
): Promise<NormalisedItem | null> {
  const url = canonicalUrl(item.url, source.feed_url);
  if (!url) return null;

  const title = item.title.trim();
  if (!title) return null;

  const lead = item.lead.trim();
  return {
    url,
    urlHash: await sha256Hex(url),
    title,
    lead,
    publishedAt: item.publishedAt,
    // Deliberately NOT part of the fingerprint. The fingerprint decides what
    // counts as a revision, and folding a new field into it would make every
    // item already held look revised the first time this ships — a fleet of
    // false "this story moved" events on one deploy.
    contentHash: await sha256Hex(contentFingerprint({ title, lead })),
    jurisdictions: inferJurisdictions(`${title} ${lead}`, source.jurisdictions),
    // Resolved against the page it was found on, and dropped if it does not
    // resolve: a half-stored attachment path is worse than none.
    documentUrl: item.documentUrl ? (canonicalUrl(item.documentUrl, source.feed_url) ?? "") : "",
    category: (item.category ?? "").trim().slice(0, 80),
  };
}
