/**
 * ENISA — the EU Agency for Cybersecurity.
 *
 * Tier 1 for the cyber half of IT audit. NIS2 implementation guidance, threat
 * landscape reports and the certification schemes all land in scope for an
 * audit desk, and ENISA is the primary source for every one of them.
 *
 * ── Why an extractor rather than the feed ───────────────────────────────
 * The registry carried an RSS URL for ENISA from the original proposal —
 * `/media/news-items/news-wires/RSS`, a Plone-era address that predates the
 * site's redesign. The operator has asked for the news index to be read
 * instead. Worth stating plainly, because this codebase's standing rule is
 * that a feed beats a scraper and nothing may silently fall back from one to
 * the other: this is not a fallback, it is a deliberate re-registration. If a
 * working feed is ever found, it should replace this.
 *
 * ── What counts as an item ──────────────────────────────────────────────
 * One rule, positive: `/news/<slug>` — exactly one segment under `/news`,
 * slug-shaped. That is the shape of a news item and a press release, and it
 * is not the shape of anything else the page carries:
 *
 *   · `/news` itself, and `/news?page=2` — the index and its pagination;
 *   · `/topics/…`, `/publications/…` — other sections, reachable from the nav;
 *   · `/news/foo/bar` — a section under news, not an entry.
 *
 * Filters and pagination are query strings on the index, so stripping the
 * query is what removes them. Stripping it also collapses the featured card
 * and the list row for the same story — the commonest source of duplicates on
 * a page like this — into one canonical URL.
 *
 * A date is required. An undated item cannot be ranked for recency or judged
 * by the freshness gate, and an index that has lost its dates is a template
 * change rather than a news item without one.
 *
 * ── Unverified ──────────────────────────────────────────────────────────
 * Written without network access; no ENISA page has been fetched by this code.
 * The `/news/<slug>` shape is inferred from the index URL the operator gave,
 * not observed. If it is wrong, the refusal below names the path shapes the
 * page actually carries, which is one round trip rather than three.
 */

import type { FeedItem } from "../feed.ts";
import type { Extractor, ExtractResult } from "./types.ts";
import {
  enrich,
  findAnchors,
  findDate,
  pathShapes,
  stripComments,
  windowAround,
} from "./html.ts";

const DOMAIN = "enisa.europa.eu";

/** The news index, and nothing else on the site. */
export function acceptsEnisaIndex(url: string): boolean {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  if (u.protocol !== "https:") return false;
  const host = u.host.toLowerCase().replace(/^www\./, "");
  if (host !== DOMAIN && !host.endsWith(`.${DOMAIN}`)) return false;
  // `/news`, with an optional locale prefix and an optional trailing slash.
  // A query is allowed so a paginated or filtered index can still be tested.
  return /^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?news\/?$/i.test(u.pathname);
}

/**
 * Is this a news entry?
 *
 * The identity is the slug, so the query and fragment are not part of it —
 * `?utm_source=`, `?highlight=` and `#main` all name the same story.
 */
export function isEnisaNewsItem(url: string): boolean {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  const host = u.host.toLowerCase().replace(/^www\./, "");
  if (host !== DOMAIN && !host.endsWith(`.${DOMAIN}`)) return false;

  const path = u.pathname.replace(/\/+$/, "");
  const m = /^(?:\/[a-z]{2}(?:-[a-z]{2})?)?\/news\/([^/]+)$/i.exec(path);
  if (!m) return false;
  return /^[a-z0-9][a-z0-9._-]*$/i.test(m[1]);
}

/** The published report or press pack an entry links, where it links one. */
export function isEnisaDocument(url: string): boolean {
  try {
    const u = new URL(url);
    const host = u.host.toLowerCase().replace(/^www\./, "");
    if (host !== DOMAIN && !host.endsWith(`.${DOMAIN}`)) return false;
    return /\.(pdf|docx?|xlsx?|pptx?)$/i.test(u.pathname);
  } catch {
    return false;
  }
}

/**
 * The labels ENISA files news under.
 *
 * Checked in order, most specific first, so "Press Release" wins over the
 * generic "News". An unrecognised label yields no category rather than a
 * guess — the field is optional, and a wrong label is worse than a missing
 * one because it is acted on.
 */
const CATEGORIES: { label: string; pattern: RegExp }[] = [
  { label: "Press Release", pattern: /\bpress\s+release\b/i },
  { label: "Report", pattern: /\b(report|threat landscape|study)\b/i },
  { label: "Guidance", pattern: /\b(guidance|guidelines|good practices?|recommendations?)\b/i },
  { label: "Certification", pattern: /\b(certification|scheme|EUCC|EUCS)\b/i },
  { label: "Event", pattern: /\b(event|conference|webinar|workshop)\b/i },
  { label: "News", pattern: /\bnews(\s+item)?\b/i },
];

export function enisaCategory(block: string): string {
  const text = block.replace(/<[^>]+>/g, " ");
  for (const c of CATEGORIES) if (c.pattern.test(text)) return c.label;
  return "";
}

/** Link text that is a control rather than a headline. */
const FURNITURE = new Set(
  [
    "read more", "read the full story", "learn more", "more", "all news", "news",
    "next", "previous", "back", "home", "search", "filter", "reset",
    "press releases", "publications", "topics", "about enisa", "contact",
    "skip to main content", "accept all cookies", "cookies", "privacy policy",
  ].map((s) => s.toLowerCase())
);

export function plausibleEnisaTitle(t: string): boolean {
  if (t.length < 12 || t.length > 300) return false;
  if (FURNITURE.has(t.toLowerCase())) return false;
  // A headline is more than one word.
  if (!/\s/.test(t)) return false;
  // A page number from the pagination control.
  if (/^[\d.,\s]+$/.test(t)) return false;
  if (/^\(?\s*(pdf|docx?|xlsx?)\b/i.test(t)) return false;
  return true;
}

/**
 * The teaser beneath a card, where the template offers one.
 *
 * Validated as prose and kept short. `lead` is tokenised for clustering, so a
 * run of navigation text swept up here would give unrelated items shared
 * vocabulary and merge them — the failure mode is silent and downstream.
 */
export function leadFor(block: string, title: string): string {
  const text = block
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const at = text.indexOf(title);
  const tail = (at >= 0 ? text.slice(at + title.length) : text).trim();
  const sentence = tail.slice(0, 300).trim();
  if (sentence.length < 40) return "";
  if (!/\s/.test(sentence)) return "";
  return sentence;
}

export function extractEnisa(raw: string, pageUrl: string): ExtractResult {
  // A redesign leaves the old listing commented out, and its anchors still
  // point at real URLs — see stripComments.
  const html = stripComments(raw);
  const anchors = findAnchors(html);
  if (anchors.length === 0) {
    // No links at all is not a quiet news week — it is a page that is not the
    // page we think it is, or a body that never arrived.
    return { ok: false, error: "no links found — the response did not parse as an HTML page" };
  }

  const items: FeedItem[] = [];
  const rejected: string[] = [];
  // Keyed by canonical URL, because a second sighting of a story is not
  // always a worse one — see `enrich`.
  const byUrl = new Map<string, FeedItem>();
  const onHost: string[] = [];
  let entries = 0;

  for (const a of anchors) {
    let u: URL;
    try {
      u = new URL(a.href, pageUrl);
    } catch {
      continue;
    }
    const host = u.host.toLowerCase().replace(/^www\./, "");
    if (host !== DOMAIN && !host.endsWith(`.${DOMAIN}`)) continue;
    onHost.push(u.href);

    if (!isEnisaNewsItem(u.href)) continue;

    // The canonical address: no query, no fragment, no trailing slash. This
    // is what collapses the featured card and the list row for one story into
    // a single item, and what keeps a filter link from looking like a new one.
    const url = `${u.origin}${u.pathname.replace(/\/+$/, "")}`;
    const already = byUrl.get(url);
    entries += already ? 0 : 1;

    if (!plausibleEnisaTitle(a.text)) {
      rejected.push(`${url} — link text is not a headline: "${a.text.slice(0, 60)}"`);
      continue;
    }

    const block = windowAround(html, a);
    const publishedAt = findDate(block, "en");
    if (!publishedAt) {
      rejected.push(`${url} — no date found in the entry`);
      continue;
    }

    const document = findDocument(html, a, pageUrl);
    const category = enisaCategory(`${a.text} ${block}`);
    const item: FeedItem = {
      url,
      title: a.text,
      lead: leadFor(block, a.text),
      publishedAt,
      ...(category ? { category } : {}),
      ...(document ? { documentUrl: document } : {}),
    };

    // The lead story appears twice — feature panel first, list row second —
    // and the panel is the poorer card. Keeping the first and filling its
    // gaps from the second is how the published PDF survives the duplicate.
    if (already) {
      enrich(already as unknown as Record<string, unknown>, item as unknown as Record<string, unknown>);
      continue;
    }
    byUrl.set(url, item);
    items.push(item);
  }

  if (onHost.length === 0) {
    return {
      ok: false,
      error:
        `found ${anchors.length} links but none on ${DOMAIN} — ` +
        `this is not the ENISA news index`,
    };
  }

  if (entries === 0) {
    // The actionable refusal. Naming the shapes the page actually carries is
    // what turns "the rule is wrong" into "the rule should be this instead".
    return {
      ok: false,
      error:
        `found ${onHost.length} links on ${DOMAIN} but none matches /news/<slug> — ` +
        `the paths here are ${pathShapes(onHost)}. If news items live under a ` +
        `different path, that is the rule to correct`,
    };
  }

  if (items.length === 0) {
    return {
      ok: false,
      error:
        `found ${entries} news entries but none carried both a headline and a date — ` +
        `the index structure has probably changed (${rejected[0] ?? "no detail"})`,
    };
  }

  return { ok: true, items, rejected };
}

/** A published file linked from the same card, if there is one. */
function findDocument(
  html: string,
  a: ReturnType<typeof findAnchors>[number],
  pageUrl: string
): string {
  for (const near of findAnchors(windowAround(html, a, 400))) {
    try {
      const candidate = new URL(near.href, pageUrl).href;
      if (isEnisaDocument(candidate)) return candidate;
    } catch {
      /* an unresolvable href is not an attachment */
    }
  }
  return "";
}

export const enisa: Extractor = {
  domain: DOMAIN,
  name: "ENISA (EU Agency for Cybersecurity)",
  accepts: acceptsEnisaIndex,
  indexUrls: [`https://www.${DOMAIN}/news`],
  extract: extractEnisa,
};
