/**
 * APAS — Abschlussprüferaufsichtsstelle, the German audit oversight body.
 *
 * Tier 1 for Germany: it supervises the statutory auditors of public-interest
 * entities, runs the inspections, and publishes the enforcement measures. For
 * a desk whose hardest rule is that a regulatory claim needs a primary source,
 * APAS is the only primary source for anything about German audit oversight.
 * It publishes no RSS and no API.
 *
 * ── What makes this APAS-specific rather than a scraper ─────────────────
 * The anchor is the URL taxonomy, not the markup. APAS runs on the German
 * federal Government Site Builder, where every published document lives under
 * `/SharedDocs/` and section indexes are `_node.html`. That taxonomy is a
 * property of the publishing system and changes far less often than the class
 * names on a page, so matching on it is both more robust and — the point here
 * — not transferable: point this at another site and `accepts()` refuses.
 *
 * Everything that survives must additionally look like a publication: a title
 * of plausible length that is not a known navigation label, and a German date
 * found near the link. Items failing either are dropped and COUNTED, so a
 * template change shows up as "34 rejected" rather than as silence.
 *
 * ── The selectors here are unverified ───────────────────────────────────
 * This was written without network access — the build environment refuses
 * every outbound host — so no page from apasbafa.bund.de has ever been
 * fetched by this code. The URL taxonomy above is documented behaviour of the
 * platform; the surrounding markup is not, which is exactly why nothing here
 * depends on a class name and why the failure modes are loud.
 *
 * Verify with Test source on the APAS row before marking it retrievable. If
 * the structure differs, `extract` will say which stage failed rather than
 * return a plausible-looking empty list. Replace tests/fixtures/apas-index.html
 * with a real saved page when one is available; the tests are written against
 * behaviour, not against that file's exact bytes.
 */

import type { FeedItem } from "../feed.ts";
import type { Extractor, ExtractResult } from "./types.ts";
import { findAnchors, parseGermanDate, windowAround } from "./html.ts";

const DOMAIN = "apasbafa.bund.de";

/**
 * Pages this may be pointed at.
 *
 * An index of publications, not an arbitrary page on the domain. Being
 * specific here is what stops the extractor being quietly repurposed: aimed at
 * the contact page it refuses, instead of returning whatever links it finds.
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
  // Either a SharedDocs section index, or one of the site's own listing pages
  // under /APAS/ that aggregates them.
  return /\/SharedDocs\//i.test(path) || /\/APAS\/[A-Z]{2}\//i.test(path);
}

/**
 * Is this href a published APAS document rather than a part of the furniture?
 *
 * `_node.html` is the Government Site Builder's own suffix for a section
 * node — an overview page listing other pages. Those are navigation by
 * definition, and excluding them is the single most valuable rule here: they
 * are numerous, they sit in the same lists as real items, and their titles
 * ("Bekanntmachungen", "Publikationen") read like plausible headlines.
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
  if (!/\/SharedDocs\//i.test(path)) return false;
  if (/_node\.html?$/i.test(path)) return false;

  return /\.html?$/i.test(path);
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
  return /\/SharedDocs\//i.test(u.pathname) && /\.pdf$/i.test(u.pathname);
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

  const candidates = anchors.filter((a) => {
    try {
      return isApasPublication(new URL(a.href, pageUrl).href);
    } catch {
      return false;
    }
  });

  if (candidates.length === 0) {
    return {
      ok: false,
      error:
        `found ${anchors.length} links but none under /SharedDocs/ — ` +
        `the APAS page structure has probably changed, or this is not a publications index`,
    };
  }

  const items: FeedItem[] = [];
  const rejected: string[] = [];
  const seen = new Set<string>();

  for (const a of candidates) {
    const url = new URL(a.href, pageUrl).href;
    if (seen.has(url)) continue;

    if (!plausibleTitle(a.text)) {
      rejected.push(`${url} — link text is not a headline: "${a.text.slice(0, 60)}"`);
      continue;
    }

    const context = windowAround(html, a);
    const publishedAt = parseGermanDate(context);
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
    const documentUrl = findDocument(html, a, pageUrl);

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
        `found ${candidates.length} /SharedDocs/ links but none carried both a headline and a date ` +
        `— the APAS page structure has probably changed (${rejected[0] ?? "no detail"})`,
    };
  }

  return { ok: true, items, rejected };
}

/** A PDF linked from the same list entry, if there is one. */
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
  extract: extractApas,
};
