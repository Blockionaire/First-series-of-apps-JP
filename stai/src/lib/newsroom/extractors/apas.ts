/**
 * APAS — Abschlussprüferaufsichtsstelle, the German audit oversight body.
 *
 * Tier 1 for Germany: it supervises the statutory auditors of public-interest
 * entities, runs the inspections, and publishes the enforcement measures. For
 * a desk whose hardest rule is that a regulatory claim needs a primary source,
 * APAS is the only primary source for anything about German audit oversight.
 * It publishes no RSS and no API.
 *
 * ── Two live tests, two things learned ──────────────────────────────────
 * The first version was pointed at the site's landing page. It returned 200,
 * it linked plenty of `/SharedDocs/…/APAS/DE/…` URLs, and not one of them was
 * a publication — the example that settled it was `…/APAS/DE/slogan.html`, a
 * strapline embedded into pages as a reusable block. On the Government Site
 * Builder `/SharedDocs/` is a shared CONTENT REPOSITORY, not a publications
 * folder: slogans, teasers and contact blocks live there beside real
 * announcements. So "mandant, and not `_node.html`" tested for the ABSENCE of
 * navigation, and absence of navigation is not presence of a publication.
 * That remains true and the rules against it are still here.
 *
 * The fix for it was a dated-address rule — publications are filed under the
 * year, straplines are not — and the second live test showed that rule to be
 * half right. The index is real and serves 20 genuine APAS links, and they
 * look like this:
 *
 *     /SharedDocs/Downloads/APAS/DE/vb_verlautbarung_26.html
 *     /SharedDocs/Downloads/APAS/DE/vb_verlautbarung_25.html
 *
 * A Verlautbarung is numbered in a series, not filed under a year. The date
 * is not in the address, and it is not on the index either: the anchor text is
 * a file reference and the listing carries no dates. The assumption that a
 * publication's URL must contain a date was simply wrong for this site.
 *
 * ── What replaced it ────────────────────────────────────────────────────
 * A dated address is now ONE of two kinds of positive evidence, not the only
 * one. The other is a numbered publication series, named explicitly — see
 * PUBLICATION_SERIES. Both are positive tests; neither is "anything that is
 * not obviously navigation".
 *
 * And the rule that actually keeps the output honest moved to where the facts
 * are. A series page is not a publication because of its file name; it is a
 * candidate because of its file name, and it becomes a publication only once
 * its own page has yielded a real title and a real publication date. An entry
 * that cannot produce both is dropped, however convincing its URL looked.
 * That is what `pending` and `detail()` below are for.
 *
 * ── Still unverified ────────────────────────────────────────────────────
 * The build environment refuses every outbound host, so no APAS page has been
 * fetched by this code. The index URL and the `vb_verlautbarung_NN.html`
 * pattern are the operator's report from a live test and are relied on as
 * such. What a Verlautbarung's DETAIL page looks like — which element holds
 * the title, which metadata holds the date — has not been seen by anyone, so
 * the detail parser tries the Government Site Builder's documented
 * conventions in order and fails loudly rather than guessing. Expect the
 * detail selectors, not the URL rules, to be what the next live test corrects.
 */

import type { FeedItem } from "../feed.ts";
import type { DetailResult, Extractor, ExtractResult, PendingDetail } from "./types.ts";
import {
  findAnchors,
  findDate,
  firstHeading,
  mainRegion,
  metaContent,
  parseGermanDate,
  parseIsoish,
  parseTimeAttr,
  stripComments,
  windowAround,
} from "./html.ts";

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
 *
 * This is the isolation rule. Everything else in this file may be relaxed by
 * a future live test; this may not.
 */
const MANDANT = /\/SharedDocs\/[^/]+\/APAS\//i;

/** The same isolation, for the site's own section pages outside /SharedDocs/. */
const APAS_SECTION = /\/APAS\/[A-Z]{2}\//i;

/**
 * Where APAS publications are listed.
 *
 * The FIRST is confirmed in production and is the one registered: the
 * operator's live test found it returns 200 and links twenty genuine APAS
 * `/SharedDocs/` addresses, among them `vb_verlautbarung_26.html` and
 * `vb_verlautbarung_25.html`. That is the retrieval surface.
 *
 * The rest have NOT been fetched by anyone. They are plausible Government
 * Site Builder addresses, kept only so a refusal can name somewhere to look
 * instead of ending at a true and useless "this is not a publications index".
 * Do not read their presence here as a claim that they resolve.
 */
export const APAS_INDEX_URLS = [
  `${ORIGIN}/SharedDocs/Kurzmeldungen/APAS/DE/kurzmeldungen_node.html`,
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
 * APAS publication series, by the shape of their addresses.
 *
 * An explicit table, and it stays explicit. The temptation here is to
 * generalise to "a file name ending in an underscore and a number", which
 * would be shorter and would also accept `teaser_2.html` and every numbered
 * content block the CMS ever emits. A series earns a row when someone has
 * seen it in production; `vb_verlautbarung_NN.html` is here because the
 * operator's live test found `vb_verlautbarung_25` and `_26` on the index.
 *
 * `kind` is carried onto the item as its category, so an editor reading the
 * Inbox can see that an item is a Verlautbarung — a binding pronouncement —
 * rather than a news note, without opening it.
 */
const PUBLICATION_SERIES: { pattern: RegExp; kind: string }[] = [
  // Verlautbarungen: APAS's official pronouncements, numbered in one series.
  { pattern: /\/vb_verlautbarung_\d{1,4}\.html?$/i, kind: "Verlautbarung" },
];

/** Which series a URL belongs to, or null. */
export function seriesKind(path: string): string | null {
  for (const s of PUBLICATION_SERIES) if (s.pattern.test(path)) return s.kind;
  return null;
}

/**
 * Pages this may be pointed at.
 *
 * A listing of publications, not an arbitrary page on the domain. An index
 * under the APAS mandant, or one of the site's own APAS section pages —
 * excluding the front door and the service furniture.
 *
 * Also accepts a publication page itself, because `hydrate` re-checks every
 * URL against this before opening it. A rule that refused the very pages this
 * extractor asks to have fetched would be a rule against its own output.
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

  const path = cleanPath(u.pathname);
  if (NOT_A_LISTING.test(path)) return false;
  // The GSB search form, scoped to APAS, is a legitimate listing surface.
  if (/\/SiteGlobals\/Forms\//i.test(path)) return /APAS/i.test(u.href);
  return MANDANT.test(path) || APAS_SECTION.test(path);
}

/**
 * A Java session id is stripped rather than rejected.
 *
 * APAS is Java-backed and appends `;jsessionid=` to every link served to a
 * client without a session cookie — which a crawler always is — so rejecting
 * on sight would drop real publications on most runs, and treating the ids as
 * part of the identity would re-ingest everything on every poll.
 */
function cleanPath(pathname: string): string {
  return pathname.replace(/;jsessionid=[^/;?]*/gi, "");
}

/**
 * The same URL with the session id removed.
 *
 * Applied before a page is queued for fetching and before its address becomes
 * an item's identity. Two links to one Verlautbarung carrying two different
 * session ids are one publication, and leaving the ids on would fetch it
 * twice and file it twice.
 */
function withoutSession(u: URL): string {
  const out = new URL(u.href);
  out.pathname = cleanPath(out.pathname);
  return out.href;
}

/**
 * Does this address carry a publication date?
 *
 * One of the two positive tests. APAS files some announcements under the year
 * they belong to — as a path segment (`/APAS/DE/2026/…`) or inside the file
 * name (`bekanntmachung_2026_03.html`) — and a reusable content block never
 * does, because it was not published on a day.
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
 * Is this href an APAS publication, dated in its own address?
 *
 * The single-request path: everything needed is on the index beside the link,
 * so no second fetch is warranted. Used for the `/APAS/DE/2026/…` shape.
 */
export function isApasPublication(url: string): boolean {
  const u = apasUrl(url);
  if (!u) return false;
  const path = cleanPath(u.pathname);

  if (!MANDANT.test(path)) return false;
  if (/_node\.html?$/i.test(path)) return false;
  if (!hasDatedPath(path)) return false;
  return /\.html?$/i.test(path) || isApasDocument(u.href);
}

/**
 * Is this href a numbered publication page whose facts live behind it?
 *
 * The two-request path. A match here is a CANDIDATE — it earns a fetch, not a
 * place in the Inbox. Whether it is a publication is settled by `detail()`,
 * which has to find a title and a date on the page itself.
 */
export function isApasDetailPage(url: string): boolean {
  const u = apasUrl(url);
  if (!u) return false;
  const path = cleanPath(u.pathname);

  if (!MANDANT.test(path)) return false;
  if (/_node\.html?$/i.test(path)) return false;
  return seriesKind(path) !== null;
}

/** The official document behind a publication, where the page links one. */
export function isApasDocument(url: string): boolean {
  const u = apasUrl(url);
  if (!u) return false;
  return MANDANT.test(cleanPath(u.pathname)) && /\.(pdf|docx?|xlsx?)$/i.test(cleanPath(u.pathname));
}

/** Parsed, and on the APAS host. Null for anything else. */
function apasUrl(url: string): URL | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  const host = u.host.toLowerCase().replace(/^www\./, "");
  if (host !== DOMAIN && !host.endsWith(`.${DOMAIN}`)) return null;
  return u;
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
    "aktuelles", "newsletter", "downloads", "formulare", "verlautbarungen",
  ].map((s) => s.toLowerCase())
);

/** Titles have to look like a headline, not like a button or a file name. */
export function plausibleTitle(t: string): boolean {
  if (t.length < 12 || t.length > 300) return false;
  if (FURNITURE.has(t.toLowerCase())) return false;
  // A headline has more than one word. "Jahresbericht" alone is a nav label;
  // "Jahresbericht 2025 der Abschlussprüferaufsichtsstelle" is a publication.
  if (!/\s/.test(t)) return false;
  // Pure dates, file-size captions and similar link text.
  if (/^[\d.,\s]+$/.test(t)) return false;
  if (/^\(?\s*(pdf|docx?|xlsx?)\b/i.test(t)) return false;
  // A file name is not a title, however long. This is the specific thing the
  // Verlautbarungen index offers in place of a headline.
  if (/^[\w.-]+\.(html?|pdf|docx?|xlsx?)$/i.test(t.trim())) return false;
  return true;
}

/* ── The index ──────────────────────────────────────────────────────────── */

export function extractApas(raw: string, pageUrl: string): ExtractResult {
  // Comments out, once, before anything indexes into the string. A redesign
  // leaves old listings commented out, and they link real publication URLs.
  const html = stripComments(raw);
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
    .filter((u): u is string => !!u && MANDANT.test(cleanPath(new URL(u).pathname)));

  const items: FeedItem[] = [];
  const rejected: string[] = [];
  const pending: PendingDetail[] = [];
  const seen = new Set<string>();
  // Dated addresses that reached the per-entry checks. Counted so the two
  // failures below stay distinguishable: a page with no publications on it at
  // all is the wrong surface, while a page whose publications all lost their
  // dates is the right surface after a template change. They need opposite
  // responses — one is "look somewhere else", the other is "the site moved".
  let dated = 0;

  for (const a of anchors) {
    const url = resolve(a.href);
    if (!url || seen.has(url)) continue;

    // Numbered series pages first: their titles and dates are behind them, so
    // nothing about the index can disqualify them and nothing about the index
    // can qualify them either.
    if (isApasDetailPage(url)) {
      seen.add(url);
      // Queued without its session id, so two links to one Verlautbarung are
      // one request and one item.
      pending.push({ url: withoutSession(new URL(url)), linkText: a.text });
      continue;
    }

    if (!isApasPublication(url)) continue;

    seen.add(url);
    dated += 1;

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

    items.push({
      url,
      title: a.text,
      lead: leadNear(context, a.text),
      publishedAt,
      ...(documentUrl ? { documentUrl } : {}),
    });
  }

  if (items.length === 0 && pending.length === 0) {
    const where = APAS_INDEX_URLS.join(" or ");
    if (dated > 0) {
      return {
        ok: false,
        error:
          `found ${dated} dated APAS publications but none carried both a headline and a date ` +
          `— the listing structure has probably changed (${rejected[0] ?? "no detail"})`,
      };
    }
    if (mandantLinks.length === 0) {
      return {
        ok: false,
        error:
          `found ${anchors.length} links but none under /SharedDocs/…/APAS/ — ` +
          `this is not an APAS publications listing. Try ${where}`,
      };
    }
    const examples = mandantLinks.slice(0, 3).map((u) => cleanPath(new URL(u).pathname)).join(", ");
    return {
      ok: false,
      error:
        `found ${mandantLinks.length} APAS /SharedDocs/ links but none is a publication — ` +
        `no numbered series page and no dated address among them, so these look like reusable ` +
        `content blocks rather than announcements (${examples}). ` +
        `If this is the landing page, publications are listed at ${where}`,
    };
  }

  return { ok: true, items, rejected, ...(pending.length ? { pending } : {}) };
}

/* ── One publication's own page ─────────────────────────────────────────── */

/**
 * Metadata fields that mean "when this was published".
 *
 * Tried in this order, and `og:updated_time` and `last-modified` are
 * deliberately absent: a CMS touching a page in March does not make a 2023
 * pronouncement current, and an item dated by its last rebuild would arrive
 * at the top of the Inbox looking like news.
 */
const DATE_META = [
  "dcterms.issued",
  "dcterms.date",
  "dc.date.issued",
  "dc.date",
  "date",
  "article:published_time",
  "citation_publication_date",
];

/**
 * Labels a German government page puts in front of a publication date.
 *
 * Word-bounded so "Stand" does not match inside "Umstand" or "Gegenstand",
 * which appear in the prose of half these pronouncements.
 */
const DATE_LABEL =
  /\b(?:Stand|Datum|Veröffentlicht(?:\s+am)?|Erschienen(?:\s+am)?|vom)\b\s*:?\s*([^<]{0,40})/gi;

export function detailApas(raw: string, pageUrl: string): DetailResult {
  const html = stripComments(raw);
  const u = apasUrl(pageUrl);
  if (!u || !MANDANT.test(cleanPath(u.pathname))) {
    return { ok: false, error: "not an APAS page" };
  }

  const title = detailTitle(html);
  if (!title) {
    return {
      ok: false,
      error: "no usable title on the page — expected an <h1> or an og:title",
    };
  }

  const publishedAt = detailDate(html);
  if (!publishedAt) {
    return {
      ok: false,
      error: `no publication date on the page for "${title.slice(0, 60)}"`,
    };
  }

  const body = mainRegion(html);
  const documentUrl = detailDocument(body, pageUrl);
  const kind = seriesKind(cleanPath(u.pathname));

  return {
    ok: true,
    item: {
      url: withoutSession(u),
      title,
      lead: detailLead(body, title),
      publishedAt,
      ...(documentUrl ? { documentUrl } : {}),
      ...(kind ? { category: kind } : {}),
    },
  };
}

/**
 * The headline, from the page rather than from the link that led here.
 *
 * `<h1>` first because it is the one element on a CMS page that is the
 * document's own title rather than an assembled string. `og:title` second:
 * it is written for sharing, so it is usually the headline alone. `<title>`
 * is the last resort and is trimmed, because these templates append the
 * authority's name and the section to it with a separator.
 */
export function detailTitle(raw: string): string {
  const html = stripComments(raw);
  const h1 = firstHeading(mainRegion(html), 1) || firstHeading(html, 1);
  if (plausibleTitle(h1)) return h1;

  const og = metaContent(html, ["og:title", "twitter:title"]).trim();
  if (plausibleTitle(og)) return og;

  const titleEl = /<title\b[^>]*>([\s\S]*?)<\/title\s*>/i.exec(html)?.[1] ?? "";
  const head = titleEl.replace(/\s+/g, " ").trim().split(/\s+[-–—|]\s+/)[0].trim();
  if (plausibleTitle(head)) return head;

  return "";
}

/**
 * The publication date, from metadata where the page offers it.
 *
 * Four tiers, most to least trustworthy:
 *
 *   1. a named metadata field that means publication — the only value on the
 *      page written for a program rather than a reader;
 *   2. `<time datetime="…">` in the content, which is the same thing said in
 *      the body;
 *   3. a labelled date line, "Stand: 15.03.2026";
 *   4. an unlabelled German date in the content.
 *
 * The last is a real fallback rather than a guess, because everything below
 * tier 1 runs against `mainRegion` — the head, the banner, the navigation and
 * the footer are gone by then. The site-wide "Stand: 01.01.2026" in the
 * footer of every page on this site would otherwise stamp the whole series
 * with one plausible-looking date, which is the failure mode that is hardest
 * to notice afterwards because nothing about it looks broken.
 */
export function detailDate(raw: string): string | null {
  const html = stripComments(raw);
  const meta = metaContent(html, DATE_META);
  if (meta) {
    const iso = parseIsoish(meta) ?? parseGermanDate(meta);
    if (iso) return iso;
  }

  const body = mainRegion(html);

  const machine = parseTimeAttr(body);
  if (machine) return machine;

  // Every labelled position, not just the first. "vom" and "Stand" appear in
  // prose as well as in date lines, and stopping at the first one would let a
  // sentence beginning "Stand der Technik" hide the real date below it.
  for (const m of body.matchAll(DATE_LABEL)) {
    const iso = parseGermanDate(m[1]) ?? parseIsoish(m[1].trim());
    if (iso) return iso;
  }

  return parseGermanDate(body);
}

/** The official document this page wraps, where it links one. */
function detailDocument(body: string, pageUrl: string): string {
  for (const a of findAnchors(body)) {
    try {
      const candidate = new URL(a.href, pageUrl).href;
      if (isApasDocument(candidate)) return candidate;
    } catch {
      /* an unresolvable href is not an attachment */
    }
  }
  return "";
}

/** A sentence or two from the page body, where there is prose to take. */
function detailLead(body: string, title: string): string {
  const paragraphs = [...body.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p\s*>/gi)]
    .map((m) => m[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim())
    .filter((t) => t.length >= 40 && t !== title && /\s/.test(t));
  return paragraphs[0]?.slice(0, 300) ?? "";
}

/* ── Shared ─────────────────────────────────────────────────────────────── */

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
  detail: detailApas,
  // The Verlautbarungen index listed 20 in the live test. Thirty leaves room
  // for the series to grow without one poll turning into a crawl.
  detailLimit: 30,
};
