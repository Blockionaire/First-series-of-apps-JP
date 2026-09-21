/**
 * The two dates a crawler cares about, derived in one place.
 *
 * `published_at` is a calendar date (`YYYY-MM-DD`) an editor chooses.
 * `updated_at` is a millisecond ISO timestamp the write path stamps, and it
 * already exists — it is load-bearing for the Ask STAI corpus fingerprint.
 * Until now nothing read it for SEO, so `dateModified` was a copy of
 * `datePublished` and the sitemap's `lastmod` never moved.
 *
 * That is the failure this fixes: for a regulation desk, recency is the
 * signal. An article revised the day an obligation changes is the one that
 * should be recrawled and cited, and a `lastmod` frozen at publication tells
 * every crawler the opposite.
 *
 * ── Why modified can never precede published ─────────────────────────────
 * A published_at is an editorial choice and can be backdated, or set in the
 * future for a scheduled piece; updated_at is machine time. Comparing them
 * and taking the later is what stops a backdated edit rendering
 * `dateModified` earlier than `datePublished`, which is invalid in
 * schema.org terms and which Google reports as a structured-data error.
 */

/** An article's fields this module needs — kept structural so tests can pass literals. */
export type Dated = { published_at: string; updated_at?: string | null };

/** `YYYY-MM-DD` → the ISO instant at the start of that day, UTC. */
function dayStart(day: string): string {
  return `${day}T00:00:00.000Z`;
}

/**
 * The published instant, as a full ISO 8601 string.
 *
 * A bare `YYYY-MM-DD` is accepted by Google but carries no timezone, so it is
 * interpreted at the crawler's discretion. Pinning it to midnight UTC makes
 * the value unambiguous without inventing a publication time.
 */
export function publishedIso(a: Dated): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(a.published_at) ? dayStart(a.published_at) : a.published_at;
}

/**
 * The modified instant: `updated_at` when it is real and not older than
 * publication, otherwise publication itself.
 */
export function modifiedIso(a: Dated): string {
  const published = publishedIso(a);
  const raw = (a.updated_at ?? "").trim();
  if (!raw) return published;
  const t = Date.parse(raw);
  if (!Number.isFinite(t)) return published;
  const updated = new Date(t).toISOString();
  return updated > published ? updated : published;
}

/** What the sitemap's `lastmod` should carry for this article. */
export function lastModified(a: Dated): string {
  return modifiedIso(a);
}
