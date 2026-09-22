/**
 * COSO — the Committee of Sponsoring Organizations of the Treadway Commission.
 *
 * The internal-control framework every ICFR conversation rests on, and the
 * publisher of the guidance that extends it — including its AI and fraud risk
 * material. Tier 1 for the controls half of the audience.
 *
 * ── The registered URL changed, and why that matters ────────────────────
 * The registry pointed at `/guidance`, which is a catalogue of frameworks: a
 * page of evergreen landing pages, not of news. Everything on it is a
 * publication that exists indefinitely, so an extractor reading it would have
 * reported the same twenty items on every poll and dated them by whatever
 * happened to sit nearby. The operator has moved the source to `/news`, which
 * is a stream — items appear, carry a date, and stop being new.
 *
 * Guidance landing pages are now excluded by name as well as by rule, because
 * a news page that links to the frameworks it announces is exactly where they
 * would otherwise come back in.
 *
 * ── What counts as an item ──────────────────────────────────────────────
 * A positive rule: a same-host page whose first path segment is `news`, with
 * one segment under it. Plus a date. Plus a headline.
 *
 * This is ONE shape, and it is the shape implied by the index URL. It has not
 * been observed — COSO's site has never been fetched by this code — so if the
 * site files news somewhere else, the refusal below names the path shapes the
 * page actually carries. That turns a wrong guess into one round trip rather
 * than three, which is the lesson two live tests on APAS paid for.
 *
 * ── Duplicates ──────────────────────────────────────────────────────────
 * The canonical URL is the origin and path with the query and fragment
 * removed. A news page typically shows its lead story twice — once as a
 * feature panel and once in the list — and `?utm_source=` variants of the
 * same link are common in promotional chrome. Both collapse here.
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

const DOMAIN = "coso.org";

/** The news index, and nothing else on the site. */
export function acceptsCosoIndex(url: string): boolean {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  if (u.protocol !== "https:") return false;
  const host = u.host.toLowerCase().replace(/^www\./, "");
  if (host !== DOMAIN && !host.endsWith(`.${DOMAIN}`)) return false;
  return /^\/news\/?$/i.test(u.pathname);
}

/**
 * Is this a news entry?
 *
 * One positive rule, and it is the whole rule: `/news/<slug>`.
 *
 * There is deliberately NO denylist of sections beside it. A first draft
 * carried one — guidance, store, membership, about — and sabotaging it failed
 * ZERO tests, because every path on it was already excluded by the positive
 * rule: nothing can both begin with `/guidance` and match `/news/<slug>`. A
 * list that catches nothing its neighbour does not is worse than no list,
 * because it reads like a safety rule, so the next person to meet a new
 * section adds it there and believes the job is done.
 *
 * So the guidance catalogue — the evergreen framework landings that a release
 * announcing a framework links straight to, and the reason this source moved
 * off `/guidance` — is excluded by the shape of a news address, not by name.
 */
export function isCosoNewsItem(url: string): boolean {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  const host = u.host.toLowerCase().replace(/^www\./, "");
  if (host !== DOMAIN && !host.endsWith(`.${DOMAIN}`)) return false;

  const path = u.pathname.replace(/\/+$/, "");
  const m = /^\/news\/([^/]+)$/i.exec(path);
  if (!m) return false;
  return /^[a-z0-9][a-z0-9._-]*$/i.test(m[1]);
}

/** The published document behind a release, where one is linked. */
export function isCosoDocument(url: string): boolean {
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
 * The kinds of thing COSO announces.
 *
 * Optional, and absent rather than guessed when nothing matches. Ordered
 * most specific first so a press release about a new framework is filed as a
 * Press release rather than as Guidance.
 */
const CATEGORIES: { label: string; pattern: RegExp }[] = [
  { label: "Press release", pattern: /\bpress\s+release\b/i },
  { label: "Framework", pattern: /\b(framework|internal control[- ]integrated)\b/i },
  { label: "Guidance", pattern: /\b(guidance|supplement|companion|interpretive)\b/i },
  { label: "Research", pattern: /\b(research|study|thought paper|white ?paper)\b/i },
  { label: "Announcement", pattern: /\b(announce[sd]?|announcement|appoint(s|ed|ment)?|names?)\b/i },
  { label: "Event", pattern: /\b(webinar|conference|event|summit)\b/i },
];

export function cosoCategory(block: string): string {
  const text = block.replace(/<[^>]+>/g, " ");
  for (const c of CATEGORIES) if (c.pattern.test(text)) return c.label;
  return "";
}

const FURNITURE = new Set(
  [
    "read more", "read the release", "learn more", "more", "view all", "see all",
    "all news", "news", "next", "previous", "back", "home", "search", "download",
    "guidance", "store", "membership", "about", "contact", "privacy policy",
    "terms of use", "subscribe", "sign up", "register", "buy now", "order",
  ].map((s) => s.toLowerCase())
);

export function plausibleCosoTitle(t: string): boolean {
  if (t.length < 12 || t.length > 300) return false;
  if (FURNITURE.has(t.toLowerCase())) return false;
  if (!/\s/.test(t)) return false;
  if (/^[\d.,\s]+$/.test(t)) return false;
  if (/^\(?\s*(pdf|docx?|xlsx?)\b/i.test(t)) return false;
  return true;
}

/** The teaser under a card, where the template offers one. */
export function cosoLead(block: string, title: string): string {
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

export function extractCoso(raw: string, pageUrl: string): ExtractResult {
  const html = stripComments(raw);
  const anchors = findAnchors(html);
  if (anchors.length === 0) {
    return { ok: false, error: "no links found — the response did not parse as an HTML page" };
  }

  const items: FeedItem[] = [];
  const rejected: string[] = [];
  // Keyed by canonical URL: a second sighting of a story may carry facts the
  // first did not — see `enrich`.
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

    if (!isCosoNewsItem(u.href)) continue;

    const url = `${u.origin}${u.pathname.replace(/\/+$/, "")}`;
    const already = byUrl.get(url);
    entries += already ? 0 : 1;

    if (!plausibleCosoTitle(a.text)) {
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
    const category = cosoCategory(`${a.text} ${block}`);
    const item: FeedItem = {
      url,
      title: a.text,
      lead: cosoLead(block, a.text),
      publishedAt,
      ...(category ? { category } : {}),
      ...(document ? { documentUrl: document } : {}),
    };

    // The feature panel comes first and carries no document. Filling its gaps
    // from the list row keeps the published PDF.
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
      error: `found ${anchors.length} links but none on ${DOMAIN} — this is not the COSO news index`,
    };
  }

  if (entries === 0) {
    return {
      ok: false,
      error:
        `found ${onHost.length} links on ${DOMAIN} but none matches /news/<slug> — ` +
        `the paths here are ${pathShapes(onHost)}. If releases live under a different ` +
        `path, that is the rule to correct`,
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
      if (isCosoDocument(candidate)) return candidate;
    } catch {
      /* an unresolvable href is not an attachment */
    }
  }
  return "";
}

export const coso: Extractor = {
  domain: DOMAIN,
  name: "COSO",
  accepts: acceptsCosoIndex,
  indexUrls: [`https://www.${DOMAIN}/news`],
  extract: extractCoso,
};
