/**
 * Parsing primitives shared by site-specific extractors.
 *
 * ── Why this is not the generic scraper ─────────────────────────────────
 * Nothing here decides what an article is. These are mechanical operations —
 * walk the anchors, read a window of surrounding markup, parse a German date —
 * and every one of them is the sort of thing that would otherwise be rewritten
 * slightly differently in each extractor and be subtly wrong in one of them.
 *
 * The judgement stays in the per-site file: which URLs count, what a title
 * must look like, what to do when nothing matches. A shared `findAnchors` is
 * a tokenizer; a shared `extractArticles` would be the thing this codebase
 * refuses to have.
 */

import { decodeEntities, plainText } from "../feed.ts";

export type Anchor = {
  /** The href exactly as written, unresolved. */
  href: string;
  /** Visible link text, entities resolved and tags stripped. */
  text: string;
  /** Index of the anchor's start in the source, for windowing. */
  start: number;
  /** Index just past the anchor's end. */
  end: number;
};

/**
 * Every `<a href=…>…</a>` in document order.
 *
 * Regex rather than a DOM library for the same reason feed.ts parses XML by
 * hand: this runs on Cloudflare Workers, where every added dependency is
 * bundle size on a 3 MB budget, and the alternative is a full HTML parser to
 * read attributes off anchors.
 *
 * Tolerant of unquoted and single-quoted attributes, because government CMS
 * output frequently is.
 */
export function findAnchors(html: string): Anchor[] {
  const out: Anchor[] = [];
  const re = /<a\b([^>]*?)>([\s\S]*?)<\/a\s*>/gi;
  for (const m of html.matchAll(re)) {
    const href = attr(m[1], "href");
    if (!href) continue;
    out.push({
      href,
      text: plainText(m[2]).trim(),
      start: m.index ?? 0,
      end: (m.index ?? 0) + m[0].length,
    });
  }
  return out;
}

/** Read one attribute out of a tag's attribute string. */
export function attr(attrs: string, name: string): string {
  const quoted = new RegExp(`\\b${name}\\s*=\\s*(["'])([\\s\\S]*?)\\1`, "i").exec(attrs);
  if (quoted) return decodeEntities(quoted[2]).trim();
  const bare = new RegExp(`\\b${name}\\s*=\\s*([^\\s"'>]+)`, "i").exec(attrs);
  return bare ? decodeEntities(bare[1]).trim() : "";
}

/**
 * The markup belonging to one anchor, for finding its date and its attachment.
 *
 * ── Why not simply a character radius ───────────────────────────────────
 * A radius was the first attempt and it was wrong in the way that matters: an
 * entry's date sits beside its link, so a window wide enough to catch it is
 * also wide enough to catch the NEIGHBOUR's date. In testing, the second APAS
 * item took the first item's date and its PDF, and an entry with no date at
 * all was given the date of the one below it — the worst outcome available,
 * because a wrong date is indistinguishable from a right one downstream.
 *
 * So the window is the enclosing list item where the page has one, which is
 * what actually delimits an entry. Depth-counted, so a nested container does
 * not end the block early. The radius survives only as a fallback for
 * templates with no recognisable item container, and is tight for the same
 * reason.
 */
const BLOCK_TAGS = ["li", "article", "tr", "dd"];
const MAX_BLOCK = 8000;

export function windowAround(html: string, a: Anchor, radius = 600): string {
  const block = enclosingBlock(html, a);
  if (block) return block;
  return html.slice(Math.max(0, a.start - radius), Math.min(html.length, a.end + radius));
}

/** The innermost list-item-like element containing this anchor, if any. */
export function enclosingBlock(html: string, a: Anchor): string | null {
  let best: { from: number; to: number } | null = null;

  for (const tag of BLOCK_TAGS) {
    const open = new RegExp(`<${tag}\\b[^>]*>`, "gi");
    const close = new RegExp(`</${tag}\\s*>`, "gi");

    // The last opening tag before the anchor is the innermost candidate.
    let from = -1;
    for (const m of html.slice(0, a.start).matchAll(open)) from = m.index ?? -1;
    if (from < 0) continue;

    // Walk forward counting depth, so a nested <li> inside this one does not
    // close it. Cheap because the search starts at the opening tag.
    const rest = html.slice(from);
    const events = [
      ...[...rest.matchAll(open)].map((m) => ({ at: m.index ?? 0, d: 1 })),
      ...[...rest.matchAll(close)].map((m) => ({ at: m.index ?? 0, d: -1 })),
    ].sort((x, y) => x.at - y.at);

    let depth = 0;
    let to = -1;
    for (const e of events) {
      depth += e.d;
      if (depth === 0) {
        to = from + e.at;
        break;
      }
    }
    // Closed BEFORE the anchor ends: not an enclosure. `<` and not `<=`,
    // because a container that closes exactly where the anchor ends —
    // `</a></li>` with no whitespace between, which is what a minified or
    // tightly-written template emits — does contain it. With `<=` that block
    // was discarded and the search fell back to the character radius, which
    // then swept in the neighbouring entry's date: the exact bleed this
    // function exists to prevent, reappearing only on templates that happen
    // not to pretty-print.
    if (to < a.end) continue;
    if (to - from > MAX_BLOCK) continue; // a page wrapper, not an entry

    if (!best || to - from < best.to - best.from) best = { from, to };
  }

  return best ? html.slice(best.from, best.to) : null;
}

/**
 * The document with its comments removed.
 *
 * Not cosmetic. A comment is markup as far as every regex in this file is
 * concerned, and CMS templates are full of them — editor notes, build
 * markers, and above all blocks of old page structure left commented out
 * during a redesign. Two things go wrong if they are left in:
 *
 *   · A commented-out `<a href="…">` is collected as a live link, so a
 *     publication that was taken down comes back on the next poll.
 *   · A comment containing something tag-shaped but unclosed — `<h1>` written
 *     inside a note about the template — is opened by the matcher and closed
 *     by the NEXT real tag of that name, swallowing everything between. That
 *     is not hypothetical: it is how the comment in a fixture here ended up
 *     inside an extracted title.
 *
 * Applied at the top of each extractor rather than inside `findAnchors`,
 * because anchors carry offsets into the string they were found in and the
 * windowing helpers index back into it. One stripped string, used throughout.
 */
export function stripComments(html: string): string {
  return html.replace(/<!--[\s\S]*?-->/g, " ");
}

/**
 * Fill an item's empty optional fields from a second sighting of it.
 *
 * News indexes show their lead story twice: once as a feature panel and once
 * in the list. The two cards are not identical — the panel is usually the
 * poorer of the two, carrying the headline and the date but not the teaser
 * and not the link to the published document.
 *
 * Deduplicating by canonical URL keeps whichever came first in the markup,
 * which is the panel, so the PDF quietly disappears from the one story most
 * likely to matter. `documentUrl` is the primary text an evidence pack has to
 * cite, so losing it is not cosmetic.
 *
 * This fills the gaps and nothing else: a field already set is never
 * overwritten, so the first card still decides the title, the date and
 * anything else it actually carried. Mechanical — it merges what two sightings
 * said, and decides nothing about what an item is.
 */
export function enrich<T extends Record<string, unknown>>(existing: T, extra: T): void {
  for (const key of ["lead", "category", "documentUrl"] as const) {
    const have = existing[key];
    const found = extra[key];
    if ((have === undefined || have === "") && typeof found === "string" && found !== "") {
      (existing as Record<string, unknown>)[key] = found;
    }
  }
}

/**
 * The distinct path shapes among a set of URLs, for a failure message.
 *
 * Mechanical, and it decides nothing — but it is the difference between one
 * round trip and three when an extractor meets a site it does not recognise.
 * "Found 40 links and none is a news item" is true and leaves the operator
 * with nowhere to go. "…the paths here are /news/, /publications/, /topics/"
 * tells them, and me, exactly which rule is wrong.
 *
 * That lesson cost two live tests on APAS. Every extractor here now reports
 * what it saw when it refuses.
 */
export function pathShapes(urls: string[], limit = 6): string {
  const seen = new Map<string, number>();
  for (const raw of urls) {
    let path: string;
    try {
      path = new URL(raw).pathname;
    } catch {
      continue;
    }
    // The first two segments: enough to tell /en/news/ from /en/library/,
    // short enough that fifty article slugs collapse to one entry.
    const parts = path.split("/").filter(Boolean).slice(0, 2);
    const shape = parts.length ? `/${parts.join("/")}/` : "/";
    seen.set(shape, (seen.get(shape) ?? 0) + 1);
  }
  return [...seen.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([shape, n]) => `${shape} (${n})`)
    .join(", ");
}

/**
 * The content of one named `<meta>`, by `name` or by `property`.
 *
 * Named explicitly by the caller rather than swept up wholesale. A page's head
 * carries several date-shaped values — when it was published, when it was last
 * touched, when the CMS rebuilt it — and they are not interchangeable: the
 * difference between `dcterms.issued` and `og:updated_time` is the difference
 * between a two-year-old pronouncement and breaking news. An extractor that
 * takes the first date it finds in the head will eventually take the wrong one
 * and there will be nothing in the output to show it.
 */
export function metaContent(html: string, names: string[]): string {
  const head = html.slice(0, 60_000);
  const wanted = new Set(names.map((n) => n.toLowerCase()));
  for (const m of head.matchAll(/<meta\b([^>]*)>/gi)) {
    const attrs = m[1];
    const key = (attr(attrs, "name") || attr(attrs, "property") || attr(attrs, "itemprop")).toLowerCase();
    if (!key || !wanted.has(key)) continue;
    const value = attr(attrs, "content");
    if (value) return value;
  }
  return "";
}

/**
 * The page's own content, with the furniture around it removed.
 *
 * Dates and headings appear in a government template's header, breadcrumb,
 * sidebar and footer as well as in the article: a "Stand: 01.01.2026" in a
 * site-wide footer would date every publication on the site to the same day,
 * and it would look entirely plausible.
 *
 * Falls back to the whole document when no landmark is found, because a page
 * with no `<main>` is still a page — the caller's own validation is what keeps
 * that case honest, not this.
 */
export function mainRegion(html: string): string {
  const stripped = stripComments(html)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    // The head goes too. It is the richest source of date-shaped values on the
    // page and none of them is the content: a caller that wants metadata asks
    // for it by name through `metaContent`, where it has to say which field it
    // means. Leaving the head in would make "the date in the content" quietly
    // include og:updated_time on any page without a <main>.
    .replace(/<head\b[\s\S]*?<\/head\s*>/i, " ")
    .replace(/<nav\b[\s\S]*?<\/nav>/gi, " ")
    .replace(/<header\b[\s\S]*?<\/header>/gi, " ")
    .replace(/<footer\b[\s\S]*?<\/footer>/gi, " ");

  const main = /<main\b[^>]*>([\s\S]*?)<\/main\s*>/i.exec(stripped);
  if (main) return main[1];

  // Government Site Builder marks its content column this way, and has since
  // long before it emitted HTML5 landmarks.
  const byId = /<div\b[^>]*\b(?:id|class)\s*=\s*(["'])[^"']*\b(?:content|inhalt|main)\b[^"']*\1[^>]*>([\s\S]*)/i.exec(
    stripped
  );
  if (byId) return byId[2];

  return stripped;
}

/**
 * The first `<h1>`, as plain text.
 *
 * `<h1>` and not `<title>`: the title element on these sites is the headline
 * plus the authority's name plus the section, assembled by the CMS, and
 * splitting that back apart is guesswork that fails differently on every page.
 */
export function firstHeading(html: string, level: 1 | 2 = 1): string {
  const m = new RegExp(`<h${level}\\b[^>]*>([\\s\\S]*?)</h${level}\\s*>`, "i").exec(html);
  return m ? plainText(m[1]).trim() : "";
}

/**
 * German dates: 15.01.2026, 5.1.2026, and the written month form.
 *
 * `Date.parse` cannot be used here. It reads "01.02.2026" as an American
 * month-first date where it accepts it at all, so a February publication would
 * be stored as January and rank as five weeks older than it is.
 *
 * Returns midday UTC rather than midnight. These pages give a day, not an
 * instant, and midnight in Berlin is the previous day in UTC — which would
 * make every APAS item appear to be published the day before it was.
 */
const MONTHS: Record<string, number> = {
  januar: 1, februar: 2, "märz": 3, maerz: 3, april: 4, mai: 5, juni: 6,
  juli: 7, august: 8, september: 9, oktober: 10, november: 11, dezember: 12,
};

export function parseGermanDate(raw: string): string | null {
  const numeric = /\b(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})\b/.exec(raw);
  if (numeric) return iso(+numeric[1], +numeric[2], +numeric[3]);

  const written = /\b(\d{1,2})\.?\s+([A-Za-zÄÖÜäöüß]+)\s+(\d{4})\b/.exec(raw);
  if (written) {
    const month = MONTHS[written[2].toLowerCase()];
    if (month) return iso(+written[1], month, +written[3]);
  }
  return null;
}

function iso(day: number, month: number, year: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  // Guards the same bugs parseFeedDate guards: a templating placeholder that
  // renders as 01.01.1970, and a date far enough ahead to be a typo.
  if (year < 1995 || year > new Date().getUTCFullYear() + 2) return null;
  const d = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  // Rejects 31.02: the Date constructor rolls over rather than failing.
  if (d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return null;
  if (d.getTime() > Date.now() + 2 * 86_400_000) return null;
  return d.toISOString();
}


/* ── Dates ───────────────────────────────────────────────────────────────
 * Three publishers, three notations, and one rule: never hand a string to
 * `Date.parse` and hope. It reads "01.02.2026" as an American month-first
 * date where it accepts it at all, so a German February publication would be
 * stored as January and rank five weeks older than it is.
 */

/**
 * A machine-readable date, where the page offers one.
 *
 * `<time datetime="2026-01-15">` is the only date on a page that was written
 * for a program rather than for a reader: no locale, no ambiguity between day
 * and month, no "yesterday". Both Anthropic's site and the Commission's emit
 * it, so it is tried first everywhere and the prose parsers below are the
 * fallback rather than the plan.
 */
export function parseTimeAttr(block: string): string | null {
  for (const m of block.matchAll(/<time\b[^>]*\bdatetime\s*=\s*(["'])([^"']+)\1/gi)) {
    const iso = parseIsoish(m[2]);
    if (iso) return iso;
  }
  // Schema.org markup, which Europa pages carry and which survives redesigns
  // better than the visible furniture around it.
  for (const m of block.matchAll(
    /\bcontent\s*=\s*(["'])(\d{4}-\d{2}-\d{2}[^"']*)\1/gi
  )) {
    const iso = parseIsoish(m[2]);
    if (iso) return iso;
  }
  return null;
}

/** An ISO-ish instant or plain date, bounded by the same sanity rules. */
export function parseIsoish(raw: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw.trim());
  if (!m) return null;
  return iso(+m[3], +m[2], +m[1]);
}

const EN_MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

/**
 * English dates, in the three shapes these publishers actually use.
 *
 *   "Jan 15, 2026" / "January 15, 2026"  — Anthropic's newsroom
 *   "15 January 2026"                     — Commission pages
 *
 * Numeric-only forms such as 01/02/2026 are deliberately NOT read. On an EU
 * page that is 1 February and on an American one it is 2 January, the page
 * rarely says which, and a date that is wrong by eleven months is worse than
 * a date that is missing — missing is visible.
 */
export function parseEnglishDate(raw: string): string | null {
  const dayFirst = /\b(\d{1,2})\s+([A-Za-z]{3,9})\.?,?\s+(\d{4})\b/.exec(raw);
  if (dayFirst) {
    const month = EN_MONTHS[dayFirst[2].slice(0, 3).toLowerCase()];
    if (month) return iso(+dayFirst[1], month, +dayFirst[3]);
  }
  const monthFirst = /\b([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})\b/.exec(raw);
  if (monthFirst) {
    const month = EN_MONTHS[monthFirst[1].slice(0, 3).toLowerCase()];
    if (month) return iso(+monthFirst[2], month, +monthFirst[3]);
  }
  return null;
}

const FR_MONTHS: Record<string, number> = {
  janvier: 1, "février": 2, fevrier: 2, mars: 3, avril: 4, mai: 5, juin: 6,
  juillet: 7, "août": 8, aout: 8, septembre: 9, octobre: 10,
  novembre: 11, "décembre": 12, decembre: 12,
};

/**
 * French dates: "15 septembre 2026", "1er septembre 2026", "15/09/2026".
 *
 * Two notes on what is accepted here and not elsewhere.
 *
 * `1er` — French writes the first of the month as an ordinal and no other day,
 * so the suffix is matched rather than the general `\d+(st|nd|rd|th)` an
 * English parser would need.
 *
 * The numeric form IS read, where `parseEnglishDate` deliberately refuses it.
 * The English refusal is about ambiguity: "01/02/2026" is 1 February on an EU
 * page and 2 January on an American one, and the page rarely says which. On a
 * French-language page from a French authority there is no such ambiguity —
 * day-first is the only convention in use — so the reason for refusing does
 * not apply. The extractor states the locale, which is what makes this safe.
 */
export function parseFrenchDate(raw: string): string | null {
  const written = /\b(\d{1,2})\s*(?:er)?\s+([A-Za-zÀ-ÿ]+)\s+(\d{4})\b/.exec(raw);
  if (written) {
    const month = FR_MONTHS[written[2].toLowerCase()];
    if (month) return iso(+written[1], month, +written[3]);
  }
  const numeric = /\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/.exec(raw);
  if (numeric) return iso(+numeric[1], +numeric[2], +numeric[3]);
  return null;
}

/**
 * The best date available for one entry, tried most to least reliable.
 *
 * `locale` picks which prose parser runs, and only that one runs: reading a
 * German page with the English parser would turn "1.2.2026" into nothing and,
 * worse, could match a stray "Mai 2026" as May in a numbering that meant
 * something else. One page, one language, stated by the extractor that knows.
 *
 * French and German share "mai", which is exactly the kind of overlap that
 * makes running every parser over every page a bad idea.
 */
export function findDate(block: string, locale: "de" | "en" | "fr"): string | null {
  const machine = parseTimeAttr(block);
  if (machine) return machine;
  if (locale === "de") return parseGermanDate(block);
  if (locale === "fr") return parseFrenchDate(block);
  return parseEnglishDate(block);
}
