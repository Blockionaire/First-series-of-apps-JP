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
    if (to <= a.end) continue; // closed before the anchor: not an enclosure
    if (to - from > MAX_BLOCK) continue; // a page wrapper, not an entry

    if (!best || to - from < best.to - best.from) best = { from, to };
  }

  return best ? html.slice(best.from, best.to) : null;
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

/**
 * The best date available for one entry, tried most to least reliable.
 *
 * `locale` picks which prose parser runs, and only that one runs: reading a
 * German page with the English parser would turn "1.2.2026" into nothing and,
 * worse, could match a stray "Mai 2026" as May in a numbering that meant
 * something else. One page, one language, stated by the extractor that knows.
 */
export function findDate(block: string, locale: "de" | "en"): string | null {
  return (
    parseTimeAttr(block) ??
    (locale === "de" ? parseGermanDate(block) : parseEnglishDate(block))
  );
}
