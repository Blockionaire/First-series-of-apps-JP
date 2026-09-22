/**
 * The European AI Office, on the Commission's Digital Strategy site.
 *
 * Tier 1 and unavoidable: the AI Office writes the codes of practice, the
 * guidelines on general-purpose AI, and the templates that AI Act obligations
 * are actually met with. For a desk whose hardest rule is that a regulatory
 * claim needs a primary source, there is no substitute.
 *
 * ── The scoping problem, which is worse than CEAOB's ────────────────────
 * `digital-strategy.ec.europa.eu` is the whole of DG CONNECT's policy estate:
 * broadband rollout, digital skills, media pluralism, cybersecurity funding,
 * submarine cables, the Digital Decade targets. The AI Office is one policy
 * area on it, and its page is a HUB — a description of the office with links
 * out to the updates.
 *
 * An extractor keyed on this domain that accepted any page on it, or that
 * treated every dated link on the hub as an item, would file gigabit
 * connectivity announcements as AI Act primary sources. That is not a missed
 * item; it is a wrong citation with the Commission's authority attached.
 *
 * So there are THREE conditions, and a link has to meet all three:
 *
 *   1. a Digital Strategy UPDATE address — `/en/news/…` or `/en/library/…`.
 *      Not an arbitrary path on the host, and deliberately not `/policies/…`,
 *      which is an evergreen description rather than something published on
 *      a day;
 *   2. it names an AI-Office subject, by one of the specific phrases in
 *      AI_SUBJECTS below;
 *   3. it carries a date.
 *
 * Condition 2 is the one doing the real work, and it is deliberately a list of
 * SPECIFIC phrases rather than the word "AI". "AI" alone appears in
 * connectivity, health and skills material from other units all over this
 * host; "AI Act", "AI Office", "general-purpose AI", "code of practice" do
 * not. A narrow list misses an occasional genuine item, which is visible and
 * recoverable. A loose one files other directorates' work under the AI Office,
 * which is neither.
 *
 * ── Unverified ──────────────────────────────────────────────────────────
 * Written without network access; no page on this host has been fetched by
 * this code. The path kinds are the Commission's documented Drupal structure,
 * not observation. If the hub links updates by some other shape, the refusal
 * below names the shapes it actually found.
 */

import type { FeedItem } from "../feed.ts";
import type { Extractor, ExtractResult } from "./types.ts";
import { findAnchors, findDate, pathShapes, stripComments, windowAround } from "./html.ts";

const DOMAIN = "digital-strategy.ec.europa.eu";

/** The AI Office hub, and pages beneath it. Nothing else on Digital Strategy. */
const AI_OFFICE_PATH = /\/policies\/(ai-office|european-ai-office)\b/i;

/**
 * Pages this may be pointed at.
 *
 * The hub itself and its children only. The same narrowing CEAOB needed, for
 * the same reason: the domain gets the extractor, but only one policy area on
 * it is eligible, because the host is shared with far more unrelated material.
 */
export function acceptsAiOfficePage(url: string): boolean {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  if (u.protocol !== "https:") return false;
  const host = u.host.toLowerCase().replace(/^www\./, "");
  if (host !== DOMAIN && !host.endsWith(`.${DOMAIN}`)) return false;
  return AI_OFFICE_PATH.test(u.pathname);
}

/**
 * The kinds of address Digital Strategy publishes UPDATES at.
 *
 * `label` becomes the item's category, so an editor reading the Inbox can see
 * that something is a library publication rather than a news note without
 * opening it.
 *
 * Two kinds only, and the omissions are the point. `/policies/…` and
 * `/factpages/…` are evergreen descriptions — the hub's own furniture and its
 * siblings. They never stop existing, so they would arrive on every poll,
 * dated by whatever sat nearest them in the markup. That is the same mistake
 * the COSO source made by pointing at `/guidance`, and the operator asked for
 * updates and publications, which is what these two are.
 */
const CONTENT_KINDS: { label: string; pattern: RegExp }[] = [
  { label: "News", pattern: /^(?:\/[a-z]{2}(?:-[a-z]{2})?)?\/news(?:-redirect)?\/[^/]+\/?$/i },
  { label: "Publication", pattern: /^(?:\/[a-z]{2}(?:-[a-z]{2})?)?\/library\/[^/]+\/?$/i },
];

/** Which kind of Digital Strategy address this is, or null. */
export function contentKind(pathname: string): string | null {
  const path = pathname.replace(/\/+$/, "") || "/";
  for (const k of CONTENT_KINDS) if (k.pattern.test(path)) return k.label;
  return null;
}

/**
 * Phrases that mark something as the AI Office's business.
 *
 * Every one of these is specific to the AI Act estate. The bare word "AI" is
 * deliberately absent: it appears across this host in material from units that
 * have nothing to do with the AI Office, and admitting it would turn a scoped
 * extractor into a subject-matter guess.
 */
const AI_SUBJECTS: RegExp[] = [
  /\bAI Office\b/i,
  /\bAI Act\b/i,
  /\bAI Board\b/i,
  /\bAI Pact\b/i,
  /\bGPAI\b/,
  /\bgeneral[- ]purpose AI\b/i,
  /\bcodes? of practice\b/i,
  /\bAI regulatory sandbox(es)?\b/i,
  /\bscientific panel\b/i,
  /\bhigh[- ]risk AI\b/i,
  /\bAI literacy\b/i,
  /\btrustworthy AI\b/i,
  /\bAI systems?\b/i,
  /\bAI models?\b/i,
];

export function namesAiSubject(text: string): boolean {
  const plain = text.replace(/<[^>]+>/g, " ");
  return AI_SUBJECTS.some((re) => re.test(plain));
}

/** A published file behind an update, where one is linked. */
export function isAiOfficeDocument(url: string): boolean {
  try {
    const u = new URL(url);
    const h = u.host.toLowerCase().replace(/^www\./, "");
    const commission =
      h === DOMAIN || h.endsWith(`.${DOMAIN}`) || h === "europa.eu" || h.endsWith(".europa.eu");
    if (!commission) return false;
    return /\.(pdf|docx?|xlsx?|pptx?)$/i.test(u.pathname);
  } catch {
    return false;
  }
}

const FURNITURE = new Set(
  [
    "read more", "more", "see more", "view all", "all news", "next", "previous",
    "back", "home", "search", "skip to main content", "accept all cookies",
    "cookies", "privacy policy", "legal notice", "contact", "english",
    "shaping europe's digital future", "digital strategy", "ai office",
    "european ai office", "download", "pdf",
  ].map((s) => s.toLowerCase())
);

export function plausibleAiOfficeTitle(t: string): boolean {
  if (t.length < 12 || t.length > 300) return false;
  if (FURNITURE.has(t.toLowerCase())) return false;
  if (!/\s/.test(t)) return false;
  if (/^\(?\s*(pdf|docx?|xlsx?)\b/i.test(t)) return false;
  // A bare file size or page count, which Commission pages use as link text.
  if (/^[\d.,\s]+(kb|mb|pages?)?$/i.test(t)) return false;
  return true;
}

export function extractAiOffice(raw: string, pageUrl: string): ExtractResult {
  const html = stripComments(raw);
  const anchors = findAnchors(html);
  if (anchors.length === 0) {
    return { ok: false, error: "no links found — the response did not parse as an HTML page" };
  }

  const items: FeedItem[] = [];
  const rejected: string[] = [];
  const seen = new Set<string>();
  const onHost: string[] = [];
  let contentPages = 0;
  let aiScoped = 0;

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

    const kind = contentKind(u.pathname);
    if (!kind) continue;

    // The hub itself can never be one of its own items. Redundant while
    // CONTENT_KINDS excludes `/policies/`, and kept because it is the rule
    // that states the intent: pointing the extractor at a page must not
    // return that page.
    if (AI_OFFICE_PATH.test(u.pathname)) continue;

    contentPages += 1;

    const url = `${u.origin}${u.pathname.replace(/\/+$/, "")}`;
    if (seen.has(url)) continue;

    const block = windowAround(html, a);

    // Condition 2, and the one that keeps other directorates out. Checked
    // against the link text and its own block — not the whole page, which
    // would let one mention of the AI Act in the hub's prose qualify every
    // link on it.
    if (!namesAiSubject(`${a.text} ${block}`)) {
      rejected.push(`${url} — no AI Office subject named: "${a.text.slice(0, 60)}"`);
      continue;
    }
    aiScoped += 1;

    if (!plausibleAiOfficeTitle(a.text)) {
      rejected.push(`${url} — link text is not a headline: "${a.text.slice(0, 60)}"`);
      continue;
    }

    const publishedAt = findDate(block, "en");
    if (!publishedAt) {
      rejected.push(`${url} — no date in the entry`);
      continue;
    }

    const document = findDocument(html, a, pageUrl);

    seen.add(url);
    items.push({
      url,
      title: a.text,
      lead: "",
      publishedAt,
      category: kind,
      ...(document ? { documentUrl: document } : {}),
    });
  }

  if (onHost.length === 0) {
    return {
      ok: false,
      error:
        `found ${anchors.length} links but none on ${DOMAIN} — ` +
        `this is not the AI Office page`,
    };
  }

  if (contentPages === 0) {
    return {
      ok: false,
      error:
        `found ${onHost.length} links on ${DOMAIN} but none is a news or library address — ` +
        `the paths here are ${pathShapes(onHost)}`,
    };
  }

  if (aiScoped === 0) {
    // Distinguished from the case above on purpose. "The hub links Commission
    // content, none of it about the AI Office" is a different diagnosis from
    // "the hub links nothing recognisable", and only one of them means the
    // scoping list needs a phrase adding.
    return {
      ok: false,
      error:
        `found ${contentPages} Digital Strategy pages but none names an AI Office subject — ` +
        `either the hub has stopped linking updates, or they are worded in a way this ` +
        `extractor does not recognise (${rejected[0] ?? "no detail"})`,
    };
  }

  if (items.length === 0) {
    return {
      ok: false,
      error:
        `found ${aiScoped} AI Office pages but none carried both a headline and a date — ` +
        `the page structure has probably changed (${rejected[0] ?? "no detail"})`,
    };
  }

  return { ok: true, items, rejected };
}

/** A published file linked from the same entry, if there is one. */
function findDocument(
  html: string,
  a: ReturnType<typeof findAnchors>[number],
  pageUrl: string
): string {
  for (const near of findAnchors(windowAround(html, a, 400))) {
    try {
      const candidate = new URL(near.href, pageUrl).href;
      if (isAiOfficeDocument(candidate)) return candidate;
    } catch {
      /* an unresolvable href is not an attachment */
    }
  }
  return "";
}

export const aiOffice: Extractor = {
  domain: DOMAIN,
  name: "European AI Office (Digital Strategy)",
  accepts: acceptsAiOfficePage,
  indexUrls: [`https://${DOMAIN}/en/policies/ai-office`],
  extract: extractAiOffice,
};
