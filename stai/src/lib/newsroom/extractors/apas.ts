/**
 * APAS — Abschlussprüferaufsichtsstelle, the German audit oversight body.
 *
 * Tier 1 for Germany: it supervises the statutory auditors of public-interest
 * entities, runs the inspections, and publishes the enforcement measures. For
 * a desk whose hardest rule is that a regulatory claim needs a primary source,
 * APAS is the only primary source for anything about German audit oversight.
 * It publishes no RSS and no API.
 *
 * ── What the first live test taught, and what changed ───────────────────
 * The first version was pointed at the site's landing page. It returned 200,
 * it linked plenty of `/SharedDocs/…/APAS/DE/…` URLs, and not one of them was
 * a publication. The example that settled it was
 *
 *     /SharedDocs/Kurzmeldungen/APAS/DE/slogan.html
 *
 * which is a strapline, embedded into pages as a reusable block.
 *
 * That is not a quirk. On the Government Site Builder, `/SharedDocs/` is a
 * shared CONTENT REPOSITORY, not a publications folder: slogans, teasers,
 * standard paragraphs and contact blocks live there beside real
 * announcements, all under the same mandant and the same `Kurzmeldungen`
 * type. So the old rule — mandant, plus not `_node.html` — was a test for the
 * ABSENCE of navigation, and absence of navigation is not presence of a
 * publication.
 *
 * Two changes follow, and both tighten:
 *
 *   1. `accepts` no longer takes the landing page. `/APAS/DE/Home/…` and the
 *      service pages are refused by name, so the extractor cannot be pointed
 *      at the front door and asked what it finds.
 *
 *   2. `isApasPublication` now requires POSITIVE evidence: a year in the path.
 *      APAS files its announcements under a dated address; `slogan.html`,
 *      `teaser.html` and their siblings have no date because they are not
 *      published on a day. This is the rule that separates them, and it is a
 *      property of how the content is addressed rather than of how the page
 *      looked this month.
 *
 * Nothing was relaxed to make the live test pass. Everything below is a
 * narrower filter than the version that failed.
 *
 * ── Still unverified ────────────────────────────────────────────────────
 * The build environment refuses every outbound host, so no APAS page has been
 * fetched by this code. The mandant and `_node.html` conventions are
 * documented platform behaviour; the dated-path rule is inferred from the
 * operator's own report of where genuine publications live. `indexUrls` below
 * are candidates to try with Test source, not confirmed addresses.
 */

import type { FeedItem } from "../feed.ts";
import type { Extractor, ExtractResult } from "./types.ts";
import { findAnchors, findDate, windowAround } from "./html.ts";

const DOMAIN = "apasbafa.bund.de";
const ORIGIN = `https://www.${DOMAIN}`;

/**
 * The APAS mandant segment.
 *
 * `apasbafa.bund.de` serves TWO authorities. BAFA is the federal office for
 * economic affairs and export control; APAS is the audit oversight body that
 * sits inside it. Their content shares the host and the taxonomy, and is
 * separated only by this segment:
 *
 *   /SharedDocs/Kurzmeldungen/APAS/DE/…   audit oversight
 *   /SharedDocs/Kurzmeldungen/BAFA/DE/…   export control, energy, trade
 *
 * Matching `/SharedDocs/` alone would file dual-use export licensing notices
 * as Tier-1 German audit-oversight primary sources. That is not a missed item;
 * it is a wrong citation with a regulator's authority attached to it.
 */
const MANDANT = /\/SharedDocs\/[^/]+\/APAS\//i;

/**
 * Where APAS publications are listed.
 *
 * Candidates. Reported in the refusal message so an operator pointed at the
 * wrong surface is told where to look instead, rather than being left with a
 * true and useless "this is not a publications index".
 */
export const APAS_INDEX_URLS = [
  `${ORIGIN}/SharedDocs/Kurzmeldungen/APAS/DE/kurzmeldungen_node.html`,
  `${ORIGIN}/APAS/DE/Aktuelles/aktuelles_node.html`,
  `${ORIGIN}/APAS/DE/Publikationen/publikationen_node.html`,
  `${ORIGIN}/SharedDocs/Downloads/APAS/DE/downloads_node.html`,
];

/**
 * Sections of the site that are never a publications listing.
 *
 * The landing page is the one that matters: it served 200, it linked
 * `/SharedDocs/` URLs, and it produced nothing — the most expensive kind of
 * wrong surface, because it looks like it is working.
 */
const NOT_A_LISTING =
  /\/APAS\/[A-Z]{2}\/(Home|Service|Impressum|Datenschutz|Kontakt|Barrierefreiheit)\//i;

/**
 * Pages this may be pointed at.
 *
 * A listing of publications, not an arbitrary page on the domain. An index
 * under the APAS mandant, or one of the site's own APAS section pages —
 * excluding the front door and the service furniture.
 */
export function acceptsApasIndex(url: string): boolean {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  if (u.protocol !== "https:") return false;
  const host = u.host.toLowerCase().replace(/^www\./, "");
  if (host !== DOMAIN && !host.endsWith(`.${DOMAIN}`)) return false;

  const path = u.pathname;
  if (NOT_A_LISTING.test(path)) return false;
  // The GSB search form, scoped to APAS, is a legitimate listing surface.
  if (/\/SiteGlobals\/Forms\//i.test(path)) return /APAS/i.test(u.href);
  return MANDANT.test(path) || /\/APAS\/[A-Z]{2}\//i.test(path);
}

/**
 * Does this address carry a publication date?
 *
 * The rule that separates a Bekanntmachung from a strapline. APAS addresses
 * its announcements by the year they belong to — as a path segment
 * (`/APAS/DE/2026/…`) or inside the filename (`bekanntmachung_2026_03.html`).
 * Reusable content blocks have no year because they were not published on a
 * day: `slogan.html`, `teaser.html`, `kontakt.html`.
 *
 * Bounded to plausible years so a document number that happens to be four
 * digits — `ISA 3402`, `Formular 1700` — is not read as a date.
 */
export function hasDatedPath(path: string): boolean {
  const thisYear = new Date().getUTCFullYear();
  for (const m of path.matchAll(/(?:^|[^0-9])((?:19|20)\d{2})(?:[^0-9]|$)/g)) {
    const year = Number(m[1]);
    if (year >= 1998 && year <= thisYear + 1) return true;
  }
  return false;
}

/**
 * Is this href a published APAS document?
 *
 * Three conditions, and the third is the one the live test added:
 *   · the APAS mandant, not BAFA's;
 *   · not a `_node.html` section index — navigation by definition;
 *   · a dated address, which is what a publication has and a strapline does not.
 *
 * There is deliberately NO denylist of block names beside this. An earlier
 * draft carried one — slogan, teaser, kontakt and so on — and every name on it
 * was already excluded by the dated-path rule, because a reusable block is
 * undated by nature. A list that catches nothing its neighbour does not is
 * worse than no list: it reads like a safety rule, so the next person to meet
 * a new block name adds it there and believes the job is done. The general
 * rule is the rule.
 */
export function isApasPublication(url: string): boolean {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  const host = u.host.toLowerCase().replace(/^www\./, "");
  if (host !== DOMAIN && !host.endsWith(`.${DOMAIN}`)) return false;

  // A Java session id is stripped rather than rejected. APAS is Java-backed
  // and appends `;jsessionid=` to every link served to a client without a
  // session cookie — which a crawler always is — so rejecting on sight would
  // drop real Bekanntmachungen on most runs. `canonicalUrl` removes it for
  // identity; this only has to see past it.
  const path = u.pathname.replace(/;jsessionid=[^/;?]*/gi, "");

  if (!MANDANT.test(path)) return false;
  if (/_node\.html?$/i.test(path)) return false;
  if (!hasDatedPath(path)) return false;

  // Both shapes the operator confirmed: an announcement page under
  // Kurzmeldungen, and a published file under Downloads.
  return /\.html?$/i.test(path) || isApasDocument(u.href);
}

/** The official document behind a publication, where the page links one. */
export function isApasDocument(url: string): boolean {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  const host = u.host.toLowerCase().replace(/^www\./, "");
  if (host !== DOMAIN && !host.endsWith(`.${DOMAIN}`)) return false;
  return MANDANT.test(u.pathname) && /\.(pdf|docx?|xlsx?)$/i.test(u.pathname);
}

/**
 * Navigation labels that appear as links in the same lists as publications.
 *
 * Deliberately a small list of exact matches rather than a substring filter:
 * "Bekanntmachungen" is a section heading, but "Bekanntmachung nach § 66a
 * WPO vom 3. März 2026" is a publication, and a substring rule would drop it.
 */
const FURNITURE = new Set(
  [
    "startseite", "home", "inhalt", "zur navigation", "zum inhalt", "suche", "suchen",
    "impressum", "datenschutz", "barrierefreiheit", "kontakt", "sitemap",
    "weiter", "zurück", "zurueck", "mehr", "mehr erfahren", "weiterlesen",
    "nach oben", "drucken", "teilen", "english", "deutsch",
    "publikationen", "bekanntmachungen", "kurzmeldungen", "pressemitteilungen",
    "aktuelles", "newsletter", "downloads", "formulare",
  ].map((s) => s.toLowerCase())
);

/** Titles have to look like a headline, not like a button. */
function plausibleTitle(t: string): boolean {
  if (t.length < 12 || t.length > 300) return false;
  if (FURNITURE.has(t.toLowerCase())) return false;
  // A headline has more than one word. "Jahresbericht" alone is a nav label;
  // "Jahresbericht 2025 der Abschlussprüferaufsichtsstelle" is a publication.
  if (!/\s/.test(t)) return false;
  // Pure dates, file-size captions and similar link text.
  if (/^[\d.,\s]+$/.test(t)) return false;
  if (/^\(?\s*(pdf|docx?|xlsx?)\b/i.test(t)) return false;
  return true;
}

export function extractApas(html: string, pageUrl: string): ExtractResult {
  const anchors = findAnchors(html);
  if (anchors.length === 0) {
    // No links at all is not an empty news week — it is a page that is not the
    // page we think it is, or a body that never arrived.
    return { ok: false, error: "no links found — the response did not parse as an HTML page" };
  }

  const resolve = (href: string): string | null => {
    try {
      return new URL(href, pageUrl).href;
    } catch {
      return null;
    }
  };

  // Counted separately so the failure message can distinguish "this is not an
  // APAS surface at all" from "this is an APAS surface listing no
  // publications" — the exact distinction the landing page blurred.
  const mandantLinks = anchors
    .map((a) => resolve(a.href))
    .filter((u): u is string => !!u && MANDANT.test(new URL(u).pathname));

  const candidates = anchors.filter((a) => {
    const u = resolve(a.href);
    return !!u && isApasPublication(u);
  });

  if (candidates.length === 0) {
    const where = APAS_INDEX_URLS.join(" or ");
    if (mandantLinks.length === 0) {
      return {
        ok: false,
        error:
          `found ${anchors.length} links but none under /SharedDocs/…/APAS/ — ` +
          `this is not an APAS publications listing. Try ${where}`,
      };
    }
    const examples = mandantLinks.slice(0, 3).map((u) => new URL(u).pathname).join(", ");
    return {
      ok: false,
      error:
        `found ${mandantLinks.length} APAS /SharedDocs/ links but none is a dated publication ` +
        `— these look like reusable content blocks rather than announcements (${examples}). ` +
        `If this is the landing page, publications are listed at ${where}`,
    };
  }

  const items: FeedItem[] = [];
  const rejected: string[] = [];
  const seen = new Set<string>();

  for (const a of candidates) {
    const url = resolve(a.href)!;
    if (seen.has(url)) continue;

    if (!plausibleTitle(a.text)) {
      rejected.push(`${url} — link text is not a headline: "${a.text.slice(0, 60)}"`);
      continue;
    }

    const context = windowAround(html, a);
    const publishedAt = findDate(context, "de");
    if (!publishedAt) {
      // A regulator's publication without a date cannot be ranked for recency
      // or judged by the freshness gate, and guessing "today" would make every
      // item on a re-read look like breaking news.
      rejected.push(`${url} — no German date found near the link`);
      continue;
    }

    // The official document, where the entry links one. Kept out of `lead`
    // on purpose: `lead` is tokenised for clustering, and a URL shared by
    // every APAS item would make them all look like the same story.
    const documentUrl = isApasDocument(url) ? url : findDocument(html, a, pageUrl);

    seen.add(url);
    items.push({
      url,
      title: a.text,
      lead: leadNear(context, a.text),
      publishedAt,
      ...(documentUrl ? { documentUrl } : {}),
    });
  }

  if (items.length === 0) {
    return {
      ok: false,
      error:
        `found ${candidates.length} dated APAS publications but none carried both a headline ` +
        `and a date — the listing structure has probably changed (${rejected[0] ?? "no detail"})`,
    };
  }

  return { ok: true, items, rejected };
}

/** A document linked from the same list entry, if there is one. */
function findDocument(html: string, a: ReturnType<typeof findAnchors>[number], pageUrl: string): string {
  for (const near of findAnchors(windowAround(html, a, 400))) {
    try {
      const candidate = new URL(near.href, pageUrl).href;
      if (isApasDocument(candidate)) return candidate;
    } catch {
      /* an unresolvable href is not an attachment */
    }
  }
  return "";
}

/**
 * A sentence or two of context, where the template offers one.
 *
 * Validated as prose rather than taken on trust: a teaser is worth having for
 * clustering, and a stray run of navigation text would actively harm it by
 * giving unrelated items shared vocabulary.
 */
function leadNear(context: string, title: string): string {
  const text = context
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const after = text.indexOf(title);
  const tail = after >= 0 ? text.slice(after + title.length) : text;
  const sentence = tail.trim().slice(0, 300).trim();
  if (sentence.length < 40) return "";
  if (!/\s/.test(sentence)) return "";
  return sentence;
}

export const apas: Extractor = {
  domain: DOMAIN,
  name: "APAS (Abschlussprüferaufsichtsstelle)",
  accepts: acceptsApasIndex,
  indexUrls: APAS_INDEX_URLS,
  extract: extractApas,
};
