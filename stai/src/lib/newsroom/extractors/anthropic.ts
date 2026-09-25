/**
 * Anthropic's newsroom.
 *
 * A vendor source, and read as one. The registry files it Tier 1 "for what the
 * product does, not for what it means", which is exactly right: Anthropic is
 * the primary source for a model release, a deprecation or a pricing change,
 * and is not a source at all for what the AI Act requires. A vendor's post
 * about regulation is coverage; the regulator's text is the primary source,
 * and masterplan §8 still demands one.
 *
 * ── What makes this Anthropic-specific ──────────────────────────────────
 * Newsroom entries live at `/news/<slug>` and nothing else on the site does.
 * That is the anchor: one path prefix, one slug segment, on one host. The
 * index page also links pricing, docs, careers, the API console and every
 * legal page, all of which would look like headlines if matched on markup.
 *
 * ── The trap here is different from APAS's ──────────────────────────────
 * APAS's risk is a neighbouring authority on the same host. Anthropic's is
 * that `/news` is a marketing surface: the same entry appears as a hero card,
 * a "featured" strip and a list row, three anchors to one URL. Deduplicating
 * on the canonical URL is therefore not a nicety — without it a single
 * announcement arrives three times and looks like corroboration.
 *
 * ── Unverified selectors ────────────────────────────────────────────────
 * Written without network access; www.anthropic.com has never been fetched by
 * this code. Dates are read from `<time datetime>` first, which is what the
 * site's framework emits and which survives a redesign better than any visible
 * furniture. Verify with Test source before marking the source retrievable.
 */

import type { FeedItem } from "../feed.ts";
import type { Extractor, ExtractResult } from "./types.ts";
import { findAnchors, findDate, stripComments, windowAround } from "./html.ts";

const DOMAIN = "anthropic.com";

/** The newsroom index, and nothing else on the site. */
export function acceptsAnthropicIndex(url: string): boolean {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  if (u.protocol !== "https:") return false;
  const host = u.host.toLowerCase().replace(/^www\./, "");
  if (host !== DOMAIN && !host.endsWith(`.${DOMAIN}`)) return false;
  // /news, /news/, and the localised variants the site serves.
  return /^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?news\/?$/i.test(u.pathname);
}

/**
 * Is this a newsroom entry?
 *
 * `/news/<slug>` with exactly one segment after `/news`. The index itself is
 * excluded, and so is anything deeper — a `/news/foo/bar` would be a section,
 * not an entry.
 */
export function isAnthropicNewsItem(url: string): boolean {
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

  // A slug, not a query-driven filter or a fragment target.
  return /^[a-z0-9][a-z0-9-]*$/i.test(m[1]);
}

/**
 * The labels Anthropic files newsroom entries under.
 *
 * Matched as a whole word against the entry's own block, so a headline that
 * happens to contain "policy" does not become the Policy category. Unknown
 * labels simply yield no category rather than a guess: the field is optional
 * and a wrong label is worse than a missing one.
 */
const CATEGORIES = [
  "Announcements",
  "Product",
  "Policy",
  "Societal Impacts",
  "Interpretability",
  "Alignment",
  "Research",
  "Safeguards",
  "Education",
  "Startups",
  "Company",
  "Events",
];

export function categoryIn(block: string): string {
  const text = block.replace(/<[^>]+>/g, " ");
  for (const c of CATEGORIES) {
    if (new RegExp(`(^|[^a-z])${c}([^a-z]|$)`, "i").test(text)) return c;
  }
  return "";
}

/** Link text that is a control rather than a headline. */
const FURNITURE = new Set(
  [
    "read more", "learn more", "read the post", "read paper", "view all",
    "see all", "all news", "next", "previous", "more", "news", "featured",
  ].map((s) => s.toLowerCase())
);

function plausibleTitle(t: string): boolean {
  if (t.length < 10 || t.length > 300) return false;
  if (FURNITURE.has(t.toLowerCase())) return false;
  if (!/\s/.test(t)) return false;
  return true;
}

/**
 * A slug read as words, for the case the card's link text is an image.
 *
 * Hero cards frequently wrap artwork rather than text, so the anchor's visible
 * text is empty while the entry is perfectly real. "claude-opus-5" becomes
 * "Claude opus 5" — not the published headline, but a truthful label that lets
 * a human recognise the item in the Inbox, and better than dropping it.
 */
export function titleFromSlug(url: string): string {
  try {
    const slug = new URL(url).pathname.replace(/\/+$/, "").split("/").pop() ?? "";
    const words = slug.replace(/-/g, " ").trim();
    if (words.length < 6) return "";
    return words.charAt(0).toUpperCase() + words.slice(1);
  } catch {
    return "";
  }
}

export function extractAnthropic(raw: string, pageUrl: string): ExtractResult {
  // A redesign leaves the old listing commented out, and its anchors still
  // point at real publication URLs. Stripped once, before anything indexes
  // into the string — see stripComments.
  const html = stripComments(raw);
  const anchors = findAnchors(html);
  if (anchors.length === 0) {
    return { ok: false, error: "no links found — the response did not parse as an HTML page" };
  }

  const candidates = anchors.filter((a) => {
    try {
      return isAnthropicNewsItem(new URL(a.href, pageUrl).href);
    } catch {
      return false;
    }
  });

  if (candidates.length === 0) {
    return {
      ok: false,
      error:
        `found ${anchors.length} links but none matching /news/<slug> — ` +
        `the Anthropic newsroom structure has probably changed, or this is not the news index`,
    };
  }

  const items: FeedItem[] = [];
  const rejected: string[] = [];
  const seen = new Set<string>();

  for (const a of candidates) {
    // Normalised before the duplicate check, because the index links the same
    // entry from a hero card, a featured strip and a list row. Three anchors,
    // one announcement — and without this it would arrive three times and read
    // as corroboration.
    const url = new URL(a.href, pageUrl).href.replace(/\/+$/, "");
    if (seen.has(url)) continue;

    const title = plausibleTitle(a.text) ? a.text : titleFromSlug(url);
    if (!title) {
      rejected.push(`${url} — no usable headline: "${a.text.slice(0, 60)}"`);
      continue;
    }

    const block = windowAround(html, a);
    // The date is optional here and required for APAS, deliberately. A
    // regulator's undated notice is a broken page; a newsroom card genuinely
    // may not carry a visible date, and the entry is still real. A null date
    // ranks low rather than wrong — `parseFeedDate`'s rule, applied here.
    const publishedAt = findDate(block, "en");

    seen.add(url);
    items.push({
      url,
      title,
      lead: "",
      publishedAt,
      ...(categoryIn(block) ? { category: categoryIn(block) } : {}),
    });
  }

  if (items.length === 0) {
    return {
      ok: false,
      error:
        `found ${candidates.length} /news/ links but none carried a usable headline — ` +
        `the Anthropic newsroom structure has probably changed (${rejected[0] ?? "no detail"})`,
    };
  }

  return { ok: true, items, rejected };
}

export const anthropic: Extractor = {
  domain: DOMAIN,
  name: "Anthropic newsroom",
  accepts: acceptsAnthropicIndex,
  extract: extractAnthropic,
};
