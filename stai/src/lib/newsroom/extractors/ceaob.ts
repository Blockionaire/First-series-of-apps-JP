/**
 * CEAOB — the Committee of European Auditing Oversight Bodies.
 *
 * The forum where the national audit regulators coordinate. Low volume and
 * high relevance: when CEAOB publishes, it is directly about how the audit
 * profession is supervised across the Union, and there is no other primary
 * source for it.
 *
 * ── The scoping problem, and why `accepts` is so narrow ─────────────────
 * The other two extractors own a host. This one does not: `finance.ec.europa.eu`
 * is the whole of DG FISMA — banking, insurance, capital markets, sustainable
 * finance, sanctions. An extractor keyed on that domain could, if it accepted
 * any page there, be pointed at the sanctions index and would happily return
 * items filed under a committee that had nothing to do with them.
 *
 * So `accepts` matches the CEAOB expert-group page and its immediate children
 * and nothing else. The domain gets the extractor; only one page on it is
 * eligible. That is a narrower guarantee than APAS's and it has to be, because
 * the host is shared with far more unrelated material.
 *
 * ── What counts as an item ──────────────────────────────────────────────
 * The page mixes published material with navigation, and the published
 * material is of several kinds — reports, consultations, plenary conclusions,
 * work programmes. Two rules, both narrow:
 *
 *   · a document: a PDF or Office file under the Commission's asset paths;
 *   · a page: a Commission URL whose own link text or surrounding block names
 *     one of the CEAOB content kinds.
 *
 * The second rule is the weaker of the two, so it additionally requires a date
 * in the entry. A Commission page with no date and no recognisable kind is
 * navigation until proven otherwise.
 *
 * ── Unverified selectors ────────────────────────────────────────────────
 * Written without network access; the page has never been fetched by this
 * code. The operator reports it returns 200 and is HTML rather than RSS.
 * Verify with Test source before marking the source retrievable.
 */

import type { FeedItem } from "../feed.ts";
import type { Extractor, ExtractResult } from "./types.ts";
import { findAnchors, findDate, windowAround } from "./html.ts";

const DOMAIN = "finance.ec.europa.eu";

/** The CEAOB page itself, and pages beneath it. Nothing else on DG FISMA. */
const CEAOB_PATH =
  /\/regulation-and-supervision\/expert-groups-comitology-and-other-committees\/committee-european-auditing-oversight-bodies/i;

export function acceptsCeaobPage(url: string): boolean {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  if (u.protocol !== "https:") return false;
  const host = u.host.toLowerCase().replace(/^www\./, "");
  if (host !== DOMAIN && !host.endsWith(`.${DOMAIN}`)) return false;
  return CEAOB_PATH.test(u.pathname);
}

/** Commission hosts whose documents CEAOB links to. */
function isCommissionHost(host: string): boolean {
  const h = host.toLowerCase().replace(/^www\./, "");
  return (
    h === DOMAIN ||
    h.endsWith(`.${DOMAIN}`) ||
    h === "ec.europa.eu" ||
    h.endsWith(".ec.europa.eu") ||
    h === "europa.eu" ||
    h.endsWith(".europa.eu")
  );
}

/** A published file rather than a page. */
export function isCeaobDocument(url: string): boolean {
  try {
    const u = new URL(url);
    if (!isCommissionHost(u.host)) return false;
    return /\.(pdf|docx?|xlsx?|pptx?)$/i.test(u.pathname);
  } catch {
    return false;
  }
}

/**
 * The kinds of thing CEAOB publishes, and the words the Commission uses for
 * them.
 *
 * Doubles as the item's `category`, which is why the label is the desk's word
 * and the patterns are the Commission's. A page that matches none of these is
 * not assumed to be a publication.
 */
const KINDS: { label: string; pattern: RegExp }[] = [
  { label: "Plenary meeting", pattern: /\b(plenary|meeting minutes|conclusions of the .{0,40}meeting)\b/i },
  { label: "Report", pattern: /\b(report|annual report|market monitoring)\b/i },
  { label: "Consultation", pattern: /\b(consultation|call for (evidence|feedback)|public feedback)\b/i },
  { label: "Work programme", pattern: /\b(work programme|work program|work plan)\b/i },
  { label: "Guidance", pattern: /\b(guidance|guidelines|common approach|recommendation)\b/i },
  { label: "Statement", pattern: /\b(statement|communication|press release)\b/i },
  { label: "Sub-group", pattern: /\b(sub-?group|working group|task force)\b/i },
];

export function kindOf(text: string): string {
  for (const k of KINDS) if (k.pattern.test(text)) return k.label;
  return "";
}

const FURNITURE = new Set(
  [
    "read more", "more", "next", "previous", "back", "home", "skip to main content",
    "accept all cookies", "reject", "contact", "legal notice", "privacy policy",
    "cookies", "language", "search", "download", "pdf", "english",
    "committee of european auditing oversight bodies", "expert groups",
  ].map((s) => s.toLowerCase())
);

function plausibleTitle(t: string): boolean {
  if (t.length < 12 || t.length > 300) return false;
  if (FURNITURE.has(t.toLowerCase())) return false;
  if (!/\s/.test(t)) return false;
  if (/^\(?\s*(pdf|docx?|xlsx?)\b/i.test(t)) return false;
  // A bare file size or page count, which Commission pages use as link text.
  if (/^[\d.,\s]+(kb|mb|pages?)?$/i.test(t)) return false;
  return true;
}

export function extractCeaob(html: string, pageUrl: string): ExtractResult {
  const anchors = findAnchors(html);
  if (anchors.length === 0) {
    return { ok: false, error: "no links found — the response did not parse as an HTML page" };
  }

  const items: FeedItem[] = [];
  const rejected: string[] = [];
  const seen = new Set<string>();
  let onHost = 0;

  for (const a of anchors) {
    let url: string;
    let host: string;
    try {
      const u = new URL(a.href, pageUrl);
      url = u.href.replace(/#.*$/, "");
      host = u.host;
    } catch {
      continue;
    }
    if (!isCommissionHost(host)) continue;
    onHost++;
    if (seen.has(url)) continue;

    const block = windowAround(html, a);
    const publishedAt = findDate(block, "en");
    const document = isCeaobDocument(url);

    if (!plausibleTitle(a.text)) {
      rejected.push(`${url} — link text is not a headline: "${a.text.slice(0, 60)}"`);
      continue;
    }

    // A document is self-evidently a publication. A page has to earn it: it
    // must name a CEAOB content kind AND carry a date, because an undated
    // Commission page with no recognisable kind is navigation.
    const kind = kindOf(`${a.text} ${block.replace(/<[^>]+>/g, " ")}`);
    if (!document && !(kind && publishedAt)) {
      rejected.push(
        `${url} — not a document, and ${kind ? "undated" : "no CEAOB content kind named"}`
      );
      continue;
    }

    seen.add(url);
    items.push({
      url,
      title: a.text,
      lead: "",
      publishedAt,
      category: kind || (document ? "Document" : ""),
      ...(document ? { documentUrl: url } : {}),
    });
  }

  if (onHost === 0) {
    return {
      ok: false,
      error:
        `found ${anchors.length} links but none on a Commission host — ` +
        `the CEAOB page structure has probably changed, or this is not that page`,
    };
  }

  if (items.length === 0) {
    return {
      ok: false,
      error:
        `found ${onHost} Commission links but none was a document or a dated CEAOB publication — ` +
        `the CEAOB page structure has probably changed (${rejected[0] ?? "no detail"})`,
    };
  }

  return { ok: true, items, rejected };
}

export const ceaob: Extractor = {
  domain: DOMAIN,
  name: "CEAOB (European Commission)",
  accepts: acceptsCeaobPage,
  extract: extractCeaob,
};
