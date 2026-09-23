/**
 * H2A — the Haute Autorité de l'Audit, France's audit oversight body.
 *
 * Tier 1 for France. H2A supervises the commissaires aux comptes, and its
 * positions on CSRD assurance are primary text for the sustainability work the
 * desk's audience is being asked to sign.
 *
 * ── This replaces H3C, which no longer exists ───────────────────────────
 * The registry carried `h3c.org` — the Haut Conseil du Commissariat aux
 * Comptes, which was reconstituted as the Haute Autorité de l'Audit. Both the
 * name and the DOMAIN changed, which matters operationally: a domain is the
 * registry's identity for a source, so this is not an edit to a row but a
 * different row. The old one has to be retired by hand; see the seed.
 *
 * ── A feed was asked for first, and could not be tried ──────────────────
 * The instruction was to prefer an official feed and fall back to an extractor
 * only if the feed is not reliably usable. That is the right order, and this
 * build environment cannot carry it out: it has no outbound network, so no
 * h2a-france.org URL has been fetched and no feed has been confirmed to exist.
 *
 * Writing a guessed feed URL into the registry would be worse than useless —
 * it would read as a checked fact. So the row is registered against the news
 * surface with an extractor, and the feed question is handed to the operator,
 * who does have a network, in the one place they will meet it:
 *
 *   `extract` recognises an RSS or Atom body and REFUSES IT LOUDLY, saying to
 *   switch the source's method to `rss`. So if this row is ever pointed at a
 *   feed, the answer is not a parse failure — it is an instruction.
 *
 * That keeps the stated priority intact. The extractor is the fallback, and
 * nothing here silently prefers scraping to a feed.
 *
 * ── What counts as an item ──────────────────────────────────────────────
 * A positive rule: a path under one of the publication sections — actualités,
 * publications, communiqués — with a further segment. Plus a date, plus a
 * headline.
 *
 * ── Unverified ──────────────────────────────────────────────────────────
 * No page on this host has been fetched by this code. The section names are
 * the conventions a French public authority's site uses and the shape the
 * predecessor site used (`h3c.org/actualites`), not observation. If they are
 * wrong, the refusal names the path shapes the page actually carries.
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

const DOMAIN = "h2a-france.org";

/**
 * The sections H2A publishes under.
 *
 * Accented and unaccented spellings both, because a CMS may slugify either
 * way and the difference is invisible to a reader.
 */
const SECTIONS = [
  "actualites",
  "actualités",
  "publications",
  "communiques",
  "communiqués",
  "communiques-de-presse",
  "espace-presse",
  "doctrine",
];

const SECTION_RE = new RegExp(
  `^(?:/[a-z]{2}(?:-[a-z]{2})?)?/(?:${SECTIONS.join("|")})(?:/|$)`,
  "i"
);

/** Pages this may be pointed at: one of the publication sections. */
export function acceptsH2aPage(url: string): boolean {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  if (u.protocol !== "https:") return false;
  const host = u.host.toLowerCase().replace(/^www\./, "");
  if (host !== DOMAIN && !host.endsWith(`.${DOMAIN}`)) return false;
  return SECTION_RE.test(decodeURIComponent(u.pathname));
}

/**
 * Is this a publication rather than the section index?
 *
 * Under a publication section with at least one further segment, and the last
 * segment slug-shaped so a paginated path is not read as a story.
 */
export function isH2aPublication(url: string): boolean {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  const host = u.host.toLowerCase().replace(/^www\./, "");
  if (host !== DOMAIN && !host.endsWith(`.${DOMAIN}`)) return false;

  const path = decodeURIComponent(u.pathname).replace(/\/+$/, "");
  if (!SECTION_RE.test(path)) return false;

  // A published file is an item's ATTACHMENT, not the item. Without this the
  // PDF linked from a card is collected a second time, under the link text
  // that pointed at it — "Télécharger (PDF, 480 Ko)" arriving in the Inbox as
  // though it were the headline.
  if (/\.(pdf|docx?|xlsx?|pptx?)$/i.test(path)) return false;

  const segments = path.split("/").filter(Boolean);
  // Drop a locale prefix so `/fr/actualites/x` counts its segments like
  // `/actualites/x` does.
  if (segments.length && /^[a-z]{2}(-[a-z]{2})?$/i.test(segments[0])) segments.shift();
  if (segments.length < 2) return false; // the section index itself

  const last = segments[segments.length - 1];
  if (/^(page|p)$/i.test(segments[1])) return false; // pagination
  return /^[a-z0-9][a-z0-9._%-]*$/i.test(last);
}

/** The published document behind an item, where one is linked. */
export function isH2aDocument(url: string): boolean {
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
 * A word boundary that understands accented letters.
 *
 * `\b` in JavaScript is defined against `[A-Za-z0-9_]`, so "é" is not a word
 * character and there is no boundary between it and the end of a word. That
 * makes `/\bcommuniqué\b/` match NOTHING, and `/\b[ée]tude\b/` miss "étude"
 * while matching "etude" — silently, on a French-language source where half
 * the vocabulary is accented.
 *
 * Found because the first item in the fixture came back filed as "Doctrine":
 * the Communiqué pattern had failed and the next one down matched the word
 * "position" in its headline. A wrong category is worse than none, because it
 * is acted on.
 *
 * Unicode property escapes need the `u` flag, which is why these are built
 * rather than written as literals.
 */
function word(pattern: string): RegExp {
  return new RegExp(`(?<![\\p{L}\\p{N}])(?:${pattern})(?![\\p{L}\\p{N}])`, "iu");
}

/**
 * What H2A calls the things it publishes.
 *
 * The desk's label, matched against the authority's own French wording.
 * Absent rather than guessed when nothing matches.
 */
const CATEGORIES: { label: string; pattern: RegExp }[] = [
  { label: "Communiqué", pattern: word("communiqu[ée]s?") },
  { label: "Décision", pattern: word("d[ée]cisions?|sanctions?|proc[ée]dure disciplinaire") },
  { label: "Doctrine", pattern: word("doctrine|avis|position|recommandations?") },
  { label: "Consultation", pattern: word("consultation|appel [àa] commentaires") },
  { label: "Rapport", pattern: word("rapport|bilan|[ée]tude") },
  { label: "Actualité", pattern: word("actualit[ée]s?") },
];

export function h2aCategory(block: string): string {
  const text = block.replace(/<[^>]+>/g, " ");
  for (const c of CATEGORIES) if (c.pattern.test(text)) return c.label;
  return "";
}

/** Link text that is a control rather than a headline. */
const FURNITURE = new Set(
  [
    "en savoir plus", "lire la suite", "voir plus", "tout voir", "toutes les actualités",
    "toutes les actualites", "accueil", "suivant", "précédent", "precedent", "retour",
    "rechercher", "recherche", "filtrer", "réinitialiser", "reinitialiser",
    "actualités", "actualites", "publications", "communiqués", "communiques",
    "contact", "mentions légales", "mentions legales", "plan du site",
    "politique de confidentialité", "accessibilité", "télécharger", "telecharger",
    "archives", "voir les archives", "english", "français", "francais",
  ].map((s) => s.toLowerCase())
);

export function plausibleH2aTitle(t: string): boolean {
  if (t.length < 12 || t.length > 300) return false;
  if (FURNITURE.has(t.toLowerCase())) return false;
  if (!/\s/.test(t)) return false;
  if (/^[\d.,/\s]+$/.test(t)) return false;
  if (/^\(?\s*(pdf|docx?|xlsx?)\b/i.test(t)) return false;
  return true;
}

/** The chapô under a card, where the template offers one. */
export function h2aLead(block: string, title: string): string {
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

/** Does this body look like a feed rather than a page? */
export function looksLikeFeed(body: string): boolean {
  const head = body.slice(0, 2000).trim();
  return /<rss[\s>]|<feed[\s>]|<rdf:RDF[\s>]/i.test(head);
}

export function extractH2a(raw: string, pageUrl: string): ExtractResult {
  // The feed-first instruction, enforced at the one moment it can be. If this
  // source has been pointed at a feed, the useful answer is not "that did not
  // parse as HTML" but "you have found the feed — register it as one".
  if (looksLikeFeed(raw)) {
    return {
      ok: false,
      error:
        "this URL serves an RSS/Atom feed, not an HTML page. A feed is always " +
        "preferred to an extractor: set this source's method to `rss` and test " +
        "again, and it will be parsed as a feed",
    };
  }

  const html = stripComments(raw);
  const anchors = findAnchors(html);
  if (anchors.length === 0) {
    return { ok: false, error: "no links found — the response did not parse as an HTML page" };
  }

  const items: FeedItem[] = [];
  const rejected: string[] = [];
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

    if (!isH2aPublication(u.href)) continue;

    const url = `${u.origin}${u.pathname.replace(/\/+$/, "")}`;
    const already = byUrl.get(url);
    entries += already ? 0 : 1;

    if (!plausibleH2aTitle(a.text)) {
      rejected.push(`${url} — link text is not a headline: "${a.text.slice(0, 60)}"`);
      continue;
    }

    const block = windowAround(html, a);
    // French, stated by the extractor that knows. French and German share
    // "mai", which is why one page gets one parser rather than all of them.
    const publishedAt = findDate(block, "fr");
    if (!publishedAt) {
      rejected.push(`${url} — no date found in the entry`);
      continue;
    }

    const document = findDocument(html, a, pageUrl);
    const category = h2aCategory(`${a.text} ${block}`);
    const item: FeedItem = {
      url,
      title: a.text,
      lead: h2aLead(block, a.text),
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
      error:
        `found ${anchors.length} links but none on ${DOMAIN} — ` +
        `this is not an H2A publication listing`,
    };
  }

  if (entries === 0) {
    return {
      ok: false,
      error:
        `found ${onHost.length} links on ${DOMAIN} but none is under a publication section ` +
        `(${SECTIONS.slice(0, 4).join(", ")}…) — the paths here are ${pathShapes(onHost)}. ` +
        `If publications live under a different path, that is the rule to correct`,
    };
  }

  if (items.length === 0) {
    return {
      ok: false,
      error:
        `found ${entries} publication entries but none carried both a headline and a date — ` +
        `the listing structure has probably changed (${rejected[0] ?? "no detail"})`,
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
      if (isH2aDocument(candidate)) return candidate;
    } catch {
      /* an unresolvable href is not an attachment */
    }
  }
  return "";
}

export const h2a: Extractor = {
  domain: DOMAIN,
  name: "H2A (Haute Autorité de l'Audit)",
  accepts: acceptsH2aPage,
  indexUrls: [`https://www.${DOMAIN}/actualites/`, `https://www.${DOMAIN}/publications/`],
  extract: extractH2a,
};
