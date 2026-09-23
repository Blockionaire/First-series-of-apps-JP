/**
 * The FRC — the UK's Financial Reporting Council.
 *
 * Tier 1 for the UK, and the single most developed source in Europe on AI in
 * audit: its guidance, its thematic reviews and its enforcement notices are
 * all primary text a claim can rest on.
 *
 * ── Why an extractor, and why the feed went ─────────────────────────────
 * The registry carried `/news-and-events/rss/`, which the operator reports is
 * obsolete. The standing rule here is that a feed beats a scraper and nothing
 * may silently fall back from one to the other, so this is worth saying
 * plainly: this is a deliberate re-registration after a feed was found dead,
 * not a fallback the code chose. If the FRC publishes a working feed again, it
 * should replace this.
 *
 * ── What counts as an item ──────────────────────────────────────────────
 * A positive rule: a path under `/news-and-events/news/` with at least one
 * further segment. That covers both shapes this kind of CMS emits — a flat
 * `/news/<slug>/` and a dated `/news/2026/09/<slug>/` — without guessing which
 * one is in use, and it excludes the index itself.
 *
 * Events are excluded by that rule alone: they live under
 * `/news-and-events/events/`, which is not `/news/`. There is deliberately no
 * denylist of sections beside it, because such a list would catch nothing the
 * positive rule does not already catch, and a list that catches nothing reads
 * like a safety rule to the next person who meets a new section.
 *
 * ── Podcasts and videos need a real rule, not a path ────────────────────
 * Media is the one exclusion the path cannot make. The FRC lists podcasts and
 * videos IN the news stream, at news addresses, with a type label — so the
 * only thing distinguishing them is that label. A recording is not a document
 * a regulatory claim can cite: there is no text to quote, no paragraph to
 * point at, and the Inbox would carry it as though there were.
 *
 * So `MEDIA_KINDS` is checked against the entry's own type, and it is
 * load-bearing: the fixture carries a podcast at a news address, and removing
 * this rule lets it through.
 *
 * ── Unverified ──────────────────────────────────────────────────────────
 * Written without network access; no FRC page has been fetched by this code.
 * The index URL is the operator's; the item shape under it is inferred. If it
 * is wrong, the refusal names the path shapes the page actually carries.
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

const DOMAIN = "frc.org.uk";
const NEWS_PATH = "/news-and-events/news/";

/** The news index, and nothing else on the site. */
export function acceptsFrcIndex(url: string): boolean {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  if (u.protocol !== "https:") return false;
  const host = u.host.toLowerCase().replace(/^www\./, "");
  if (host !== DOMAIN && !host.endsWith(`.${DOMAIN}`)) return false;
  return /^\/news-and-events\/news\/?$/i.test(u.pathname);
}

/**
 * Is this a news entry?
 *
 * Under `/news-and-events/news/`, with something after it. The trailing
 * segment is checked for slug shape so a paginated view that happens to be
 * expressed as a path — `/news/page/3/` — is not read as a story.
 */
export function isFrcNewsItem(url: string): boolean {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  const host = u.host.toLowerCase().replace(/^www\./, "");
  if (host !== DOMAIN && !host.endsWith(`.${DOMAIN}`)) return false;

  const path = u.pathname.replace(/\/+$/, "").toLowerCase();
  if (!path.startsWith(NEWS_PATH.replace(/\/$/, "") + "/")) return false;

  // A published file is an item's attachment, not the item.
  if (/\.(pdf|docx?|xlsx?|pptx?)$/i.test(path)) return false;

  const rest = path.slice(NEWS_PATH.length - 1).replace(/^\/+/, "");
  if (!rest) return false;
  const segments = rest.split("/");
  // A pagination path is not a story.
  if (/^(page|p)$/i.test(segments[0])) return false;
  const last = segments[segments.length - 1];
  return /^[a-z0-9][a-z0-9._-]*$/i.test(last);
}

/** The published document behind an item, where one is linked. */
export function isFrcDocument(url: string): boolean {
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
 * The types the FRC files things under.
 *
 * Ordered most specific first, and absent rather than guessed when nothing
 * matches — a wrong label is worse than a missing one, because it is acted on.
 */
const CATEGORIES: { label: string; pattern: RegExp }[] = [
  { label: "Podcast", pattern: /\bpodcast\b/i },
  { label: "Video", pattern: /\b(video|webcast|recording)\b/i },
  { label: "Webinar", pattern: /\bwebinar\b/i },
  { label: "Event", pattern: /\b(event|conference)\b/i },
  { label: "Press release", pattern: /\bpress\s+release\b/i },
  { label: "Consultation", pattern: /\b(consultation|call for (evidence|feedback)|exposure draft)\b/i },
  { label: "Publication", pattern: /\b(publication|report|thematic review|guidance|standard)\b/i },
  { label: "Speech", pattern: /\b(speech|remarks|address by)\b/i },
  { label: "Blog", pattern: /\bblog\b/i },
  { label: "News", pattern: /\bnews\b/i },
];

export function frcCategory(block: string): string {
  const text = block.replace(/<[^>]+>/g, " ");
  for (const c of CATEGORIES) if (c.pattern.test(text)) return c.label;
  return "";
}

/**
 * Types that are a recording rather than a document.
 *
 * The one exclusion the URL cannot make, and the reason `frcCategory` runs
 * before the item is built rather than after.
 */
const MEDIA_KINDS = new Set(["Podcast", "Video", "Webinar", "Event"]);

const FURNITURE = new Set(
  [
    "read more", "read the news", "find out more", "learn more", "more", "view all",
    "see all", "all news", "news", "next", "previous", "back", "home", "search",
    "filter", "clear filters", "apply", "reset", "download", "subscribe",
    "news and events", "events", "podcasts", "contact us", "cookies",
    "privacy policy", "accessibility", "skip to content",
  ].map((s) => s.toLowerCase())
);

export function plausibleFrcTitle(t: string): boolean {
  if (t.length < 12 || t.length > 300) return false;
  if (FURNITURE.has(t.toLowerCase())) return false;
  if (!/\s/.test(t)) return false;
  // A bare page number from the pagination control.
  if (/^[\d.,\s]+$/.test(t)) return false;
  if (/^\(?\s*(pdf|docx?|xlsx?)\b/i.test(t)) return false;
  return true;
}

/** The standfirst under a card, where the template offers one. */
export function frcLead(block: string, title: string): string {
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

export function extractFrc(raw: string, pageUrl: string): ExtractResult {
  const html = stripComments(raw);
  const anchors = findAnchors(html);
  if (anchors.length === 0) {
    return { ok: false, error: "no links found — the response did not parse as an HTML page" };
  }

  const items: FeedItem[] = [];
  const rejected: string[] = [];
  // Keyed by canonical URL: the lead story appears as a feature panel and
  // again in the list, and the panel is usually the poorer card — see `enrich`.
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

    if (!isFrcNewsItem(u.href)) continue;

    // No query, no fragment, no trailing slash. This is what collapses the
    // featured card and the list row for one story, and what stops a filter
    // or a tracking parameter looking like a new item.
    const url = `${u.origin}${u.pathname.replace(/\/+$/, "")}`;
    const already = byUrl.get(url);
    entries += already ? 0 : 1;

    if (!plausibleFrcTitle(a.text)) {
      rejected.push(`${url} — link text is not a headline: "${a.text.slice(0, 60)}"`);
      continue;
    }

    const block = windowAround(html, a);
    const category = frcCategory(`${a.text} ${block}`);

    // A recording is not text a regulatory claim can cite. Dropped here
    // rather than downstream, because in the Inbox it would look like one.
    if (MEDIA_KINDS.has(category)) {
      rejected.push(`${url} — ${category.toLowerCase()}, not a document`);
      continue;
    }

    const publishedAt = findDate(block, "en");
    if (!publishedAt) {
      rejected.push(`${url} — no date found in the entry`);
      continue;
    }

    const document = findDocument(html, a, pageUrl);
    const item: FeedItem = {
      url,
      title: a.text,
      lead: frcLead(block, a.text),
      publishedAt,
      ...(category ? { category } : {}),
      ...(document ? { documentUrl: document } : {}),
    };

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
      error: `found ${anchors.length} links but none on ${DOMAIN} — this is not the FRC news index`,
    };
  }

  if (entries === 0) {
    return {
      ok: false,
      error:
        `found ${onHost.length} links on ${DOMAIN} but none is under ${NEWS_PATH} — ` +
        `the paths here are ${pathShapes(onHost)}. If news items live under a different ` +
        `path, that is the rule to correct`,
    };
  }

  if (items.length === 0) {
    return {
      ok: false,
      error:
        `found ${entries} news entries but none survived — ` +
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
      if (isFrcDocument(candidate)) return candidate;
    } catch {
      /* an unresolvable href is not an attachment */
    }
  }
  return "";
}

export const frc: Extractor = {
  domain: DOMAIN,
  name: "FRC (Financial Reporting Council)",
  accepts: acceptsFrcIndex,
  indexUrls: [`https://www.${DOMAIN}${NEWS_PATH}`],
  extract: extractFrc,
};
