/**
 * Turning someone else's feed into items we can reason about.
 *
 * Hand-written, with no dependency, for two reasons. The bundle runs on
 * Workers, where every kilobyte counts against a 3 MB gzip ceiling this
 * project already tracks; and real-world feeds are not well-formed XML often
 * enough that a strict parser would reject documents a browser renders fine.
 * What is wanted here is not validation — it is extraction that does not fall
 * over.
 *
 * ── Deliberately tolerant, deliberately shallow ─────────────────────────
 * This reads the handful of fields that matter (link, title, date, summary)
 * out of RSS 2.0, Atom and JSON Feed, and ignores everything else. It does not
 * build a tree, resolve namespaces or handle nested CDATA inside nested
 * elements. When it cannot find a link it drops the entry, because an item
 * with no address cannot be deduplicated, cited or opened by a human.
 *
 * ── Why no `html_scrape` parser here ────────────────────────────────────
 * Several standard setters publish nothing machine-readable, and the registry
 * has an `html_scrape` method for them. That method is NOT implemented in
 * phase 2: writing a per-site extractor for a dozen sites is a different piece
 * of work with a different failure mode, and pretending a generic scraper
 * works would fill the Inbox with navigation links. Those sources report
 * `skipped_unsupported` and are visible as such. See DISCOVERY.md.
 */

export type FeedItem = {
  url: string;
  title: string;
  /** ISO instant, or null when the feed gives no usable date. */
  publishedAt: string | null;
  /** A short extract. Plain text, tags stripped, never the whole document. */
  lead: string;
  /**
   * The official document behind the item, where the publisher links one.
   *
   * A regulator's announcement page is usually a wrapper around a PDF, and the
   * PDF is the primary text — the thing phase 3's evidence packs have to cite.
   * Recording it at discovery saves finding it again later, when the page may
   * have moved on.
   *
   * Deliberately NOT folded into `lead`: `lead` is tokenised for clustering,
   * and a URL sharing a host and path prefix with every other item from the
   * same publisher would give them all common vocabulary and merge them.
   *
   * Only extractors set this today. Feeds have an `enclosure` element that
   * could carry it, but it is used for podcast audio far more often than for
   * documents, and reading it as a document would be wrong more than it is
   * right.
   */
  documentUrl?: string;
};

export type FeedParse =
  | { ok: true; items: FeedItem[]; format: "rss" | "atom" | "json" }
  | { ok: false; error: string };

/** How much of a summary is kept. Enough to cluster on, far short of a copy. */
const LEAD_MAX = 600;

/* ── Small XML helpers ───────────────────────────────────────────────── */

/**
 * The five XML entities, plus the Latin-1 names European publishers use.
 *
 * XML only requires the first five, and for a well-formed feed that would be
 * enough. The extractors changed that: they read HTML, where `&uuml;` and
 * `&sect;` are everywhere, and a German regulator's headline that renders as
 * "Bekanntmachung nach &sect; 66a WPO &uuml;ber…" is not merely ugly — it is
 * tokenised that way, so "uuml" becomes a term shared by every item from that
 * publisher and clustering starts merging them.
 *
 * Bounded to the accented letters and punctuation that appear in the desk's
 * languages rather than the full HTML5 set, which is 2,000 entries and mostly
 * mathematical.
 */
const ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  // German
  auml: "ä", ouml: "ö", uuml: "ü", szlig: "ß",
  // French, Dutch, Spanish, Italian, Nordic
  agrave: "à", aacute: "á", acirc: "â", atilde: "ã", aring: "å", aelig: "æ",
  ccedil: "ç", egrave: "è", eacute: "é", ecirc: "ê", euml: "ë",
  igrave: "ì", iacute: "í", icirc: "î", iuml: "ï", ntilde: "ñ",
  ograve: "ò", oacute: "ó", ocirc: "ô", otilde: "õ", oslash: "ø",
  ugrave: "ù", uacute: "ú", ucirc: "û", yacute: "ý", yuml: "ÿ",
  // Punctuation and symbols that appear in legal and financial copy
  sect: "§", para: "¶", deg: "°", middot: "·", bull: "•",
  ndash: "–", mdash: "—", lsquo: "‘", rsquo: "’",
  ldquo: "“", rdquo: "”", hellip: "…", prime: "′", Prime: "″",
  euro: "€", pound: "£", yen: "¥", cent: "¢", copy: "©", reg: "®", trade: "™",
  times: "×", divide: "÷", plusmn: "±", frac12: "½", frac14: "¼", frac34: "¾",
  laquo: "«", raquo: "»", shy: "", ensp: " ", emsp: " ", thinsp: " ",
};

/**
 * Names whose capitalisation is meaningful, so the lower-casing lookup below
 * must not flatten them. `&Prime;` is ″ and `&prime;` is ′.
 */
const CASE_SENSITIVE: Record<string, string> = { Prime: "″" };

/** Resolve the entities that actually appear in feeds, and numeric escapes. */
export function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => safeCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => safeCodePoint(parseInt(dec, 10)))
    .replace(
      /&([a-zA-Z][a-zA-Z0-9]*);/g,
      (whole, name) => CASE_SENSITIVE[name] ?? ENTITIES[name.toLowerCase()] ?? whole
    );
}

function safeCodePoint(n: number): string {
  // An out-of-range escape is a broken feed, not a reason to throw.
  if (!Number.isFinite(n) || n < 0 || n > 0x10ffff) return "";
  try {
    return String.fromCodePoint(n);
  } catch {
    return "";
  }
}

/** Strip markup and collapse whitespace. Feeds routinely put HTML in summaries. */
export function plainText(s: string): string {
  return decodeEntities(
    s
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]*>/g, " ")
  )
    .replace(/\s+/g, " ")
    .trim();
}

/** The text content of the first `<tag>` inside `xml`, or "". */
function tagText(xml: string, tag: string): string {
  const m = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "i").exec(xml);
  if (!m) return "";
  const cdata = /<!\[CDATA\[([\s\S]*?)\]\]>/.exec(m[1]);
  return decodeEntities((cdata ? cdata[1] : m[1]).trim());
}

function blocks(xml: string, tag: string): string[] {
  return [...xml.matchAll(new RegExp(`<${tag}(?:\\s[^>]*)?>[\\s\\S]*?</${tag}>`, "gi"))].map(
    (m) => m[0]
  );
}

/* ── Dates ───────────────────────────────────────────────────────────── */

/**
 * A feed date as an ISO instant, or null.
 *
 * RFC 822 (RSS) and RFC 3339 (Atom) are both handled by Date.parse in every
 * runtime this ships to. What matters more is the rejection: a date that does
 * not parse becomes null rather than "now". Defaulting to the retrieval time
 * would make every item from a broken feed look like breaking news, and
 * recency is a ranking input.
 */
export function parseFeedDate(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  const t = Date.parse(s);
  if (!Number.isFinite(t)) return null;
  const iso = new Date(t).toISOString();
  // A feed claiming something was published in 1970 or in 2140 is a broken
  // feed. Both extremes appear in the wild, usually from a templating bug.
  const year = Number(iso.slice(0, 4));
  if (year < 1995 || year > new Date().getUTCFullYear() + 2) return null;
  return iso;
}

/* ── Formats ─────────────────────────────────────────────────────────── */

function parseRss(xml: string): FeedItem[] {
  const out: FeedItem[] = [];
  for (const item of blocks(xml, "item")) {
    // `<link>` normally, falling back to `<guid>` only when that guid is
    // itself an address. A guid is often an opaque identifier, and treating
    // one as a URL produces items nobody can open.
    const link = tagText(item, "link");
    const guid = tagText(item, "guid");
    const url = link || (/^https?:\/\//i.test(guid) ? guid : "");
    const title = plainText(tagText(item, "title"));
    if (!url || !title) continue;
    out.push({
      url: url.trim(),
      title,
      publishedAt:
        parseFeedDate(tagText(item, "pubDate")) ??
        parseFeedDate(tagText(item, "dc:date")) ??
        null,
      lead: plainText(tagText(item, "description") || tagText(item, "content:encoded")).slice(
        0,
        LEAD_MAX
      ),
    });
  }
  return out;
}

function parseAtom(xml: string): FeedItem[] {
  const out: FeedItem[] = [];
  for (const entry of blocks(xml, "entry")) {
    // Atom puts the address in an attribute, and an entry may carry several
    // links. `rel="alternate"` is the human-readable one; a bare <link href>
    // means the same thing.
    const alternate =
      /<link\s[^>]*rel\s*=\s*["']alternate["'][^>]*>/i.exec(entry)?.[0] ??
      /<link\s[^>]*>/i.exec(entry)?.[0] ??
      "";
    const url = /href\s*=\s*["']([^"']+)["']/i.exec(alternate)?.[1] ?? "";
    const title = plainText(tagText(entry, "title"));
    if (!url || !title) continue;
    out.push({
      url: decodeEntities(url).trim(),
      title,
      publishedAt:
        parseFeedDate(tagText(entry, "published")) ?? parseFeedDate(tagText(entry, "updated")),
      lead: plainText(tagText(entry, "summary") || tagText(entry, "content")).slice(0, LEAD_MAX),
    });
  }
  return out;
}

/**
 * JSON Feed, and the loose "array of objects with a url and a title" shape
 * that most ad-hoc APIs return.
 *
 * Kept deliberately forgiving about field names because a registry entry
 * marked `json_api` may point at anything. What it is NOT forgiving about is
 * the absence of a url or a title — those are what make an item usable.
 */
function parseJson(body: string): FeedItem[] {
  let doc: unknown;
  try {
    doc = JSON.parse(body);
  } catch {
    return [];
  }
  const list: unknown[] = Array.isArray(doc)
    ? doc
    : Array.isArray((doc as { items?: unknown[] })?.items)
      ? (doc as { items: unknown[] }).items
      : Array.isArray((doc as { results?: unknown[] })?.results)
        ? (doc as { results: unknown[] }).results
        : [];

  const out: FeedItem[] = [];
  for (const raw of list) {
    if (!raw || typeof raw !== "object") continue;
    const o = raw as Record<string, unknown>;
    const url = String(o.url ?? o.link ?? o.external_url ?? o.id ?? "").trim();
    const title = plainText(String(o.title ?? o.name ?? o.headline ?? ""));
    if (!/^https?:\/\//i.test(url) || !title) continue;
    out.push({
      url,
      title,
      publishedAt: parseFeedDate(
        String(o.date_published ?? o.published ?? o.published_at ?? o.updated ?? "")
      ),
      lead: plainText(
        String(o.summary ?? o.description ?? o.content_text ?? o.abstract ?? "")
      ).slice(0, LEAD_MAX),
    });
  }
  return out;
}

/**
 * Parse a fetched body, sniffing the format rather than trusting the registry.
 *
 * The registry says what a source is *expected* to serve. Feeds move: a source
 * registered as `rss` that starts serving Atom should keep working, and one
 * that starts serving an HTML error page should fail loudly rather than
 * silently yielding zero items. Sniffing gives both.
 */
export function parseFeed(body: string, hint?: string): FeedParse {
  const head = body.slice(0, 2000).trimStart();

  if (head.startsWith("{") || head.startsWith("[") || hint === "json_api") {
    const items = parseJson(body);
    if (items.length === 0 && !(head.startsWith("{") || head.startsWith("["))) {
      return { ok: false, error: "expected JSON, got something else" };
    }
    return { ok: true, items, format: "json" };
  }

  if (/<feed[\s>]/i.test(head)) return { ok: true, items: parseAtom(body), format: "atom" };
  if (/<rss[\s>]|<rdf:RDF[\s>]|<channel[\s>]/i.test(head)) {
    return { ok: true, items: parseRss(body), format: "rss" };
  }

  // An HTML page where a feed was expected is the single most common failure:
  // the URL moved and the server returned a 200 landing page. Naming it is the
  // difference between "this source is quiet" and "this source is broken".
  if (/^<!doctype html|^<html[\s>]/i.test(head)) {
    return { ok: false, error: "served an HTML page, not a feed — the feed URL has probably moved" };
  }

  // Last resort: some feeds omit the declaration entirely.
  if (/<item[\s>]/i.test(body)) return { ok: true, items: parseRss(body), format: "rss" };
  if (/<entry[\s>]/i.test(body)) return { ok: true, items: parseAtom(body), format: "atom" };

  return { ok: false, error: "unrecognised format" };
}
