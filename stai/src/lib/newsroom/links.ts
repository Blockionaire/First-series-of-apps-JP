/**
 * Links from the Inbox to the documents a story was built from.
 *
 * Every item's address came from someone else's feed or page. Rendering it as
 * an `href` puts that string one click from an admin's signed-in session, so
 * only http(s) addresses become links: a `javascript:` or `data:` URL in a
 * feed would otherwise run in the back office. Ingestion already keeps to
 * http(s) — this is the second check, at the point where it matters.
 *
 * Pure: no database, no request.
 */

/** The address as a safe link target, or null when it must not be one. */
export function externalHref(url: string | null | undefined): string | null {
  const raw = (url ?? "").trim();
  if (!raw) return null;
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    return u.toString();
  } catch {
    return null;
  }
}

/** "www.eba.europa.eu" → "eba.europa.eu": what a reader recognises. */
export function hostOf(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return "";
  }
}
