/**
 * Which market a piece applies to.
 *
 * A reader in Amsterdam and a reader in London open the same article and need
 * to know, in the first second, whether it is about them. That is the whole
 * job of this tag, and it is why it is a small closed set rather than free
 * text: a tag that reads "EU/NL" on one piece and "Netherlands (EU)" on the
 * next is not a filter, it is decoration.
 *
 * ── Multi-value is the normal case ───────────────────────────────────────
 * A piece on the EU AI Act as it lands on Dutch audit firms is EU *and* NL.
 * Forcing one value there would be a small lie in the most scannable part of
 * the page, so articles carry a list.
 *
 * ── European-first, country-aware ────────────────────────────────────────
 * The desk writes about Europe. US and APAC exist in the set so that a piece
 * genuinely touching them can say so honestly rather than being mislabelled
 * GLOBAL, not because they are in editorial scope.
 */

export type JurisdictionGroup = "supranational" | "europe" | "elsewhere";

export type Jurisdiction = {
  code: string;
  label: string;
  group: JurisdictionGroup;
  /** In the desk's editorial focus. False means "taggable, not targeted". */
  inScope: boolean;
};

/**
 * Genuinely jurisdiction-independent material: IAASB and IFRS pronouncements,
 * vendor product releases, research with no legal locus.
 *
 * Exclusive by rule — see `validateJurisdictions`. If a piece is global AND
 * about the Dutch market, it is not global; it is an EU/NL piece that mentions
 * a global standard.
 */
export const GLOBAL = "GLOBAL";

export const JURISDICTIONS: Jurisdiction[] = [
  { code: GLOBAL, label: "Global", group: "supranational", inScope: true },
  { code: "EU", label: "European Union", group: "supranational", inScope: true },
  { code: "EEA", label: "EEA", group: "supranational", inScope: true },

  { code: "NL", label: "Netherlands", group: "europe", inScope: true },
  { code: "BE", label: "Belgium", group: "europe", inScope: true },
  { code: "DE", label: "Germany", group: "europe", inScope: true },
  { code: "FR", label: "France", group: "europe", inScope: true },
  // First-class, not an afterthought: its own regulator, its own standards
  // route, and a large share of the audience.
  { code: "UK", label: "United Kingdom", group: "europe", inScope: true },
  { code: "IE", label: "Ireland", group: "europe", inScope: true },
  { code: "LU", label: "Luxembourg", group: "europe", inScope: true },
  { code: "ES", label: "Spain", group: "europe", inScope: true },
  { code: "IT", label: "Italy", group: "europe", inScope: true },
  { code: "CH", label: "Switzerland", group: "europe", inScope: true },
  { code: "AT", label: "Austria", group: "europe", inScope: true },
  { code: "PL", label: "Poland", group: "europe", inScope: true },
  { code: "PT", label: "Portugal", group: "europe", inScope: true },
  // One tag rather than five: the Nordic audit market is usually written
  // about as a bloc, and five separate codes that always appear together
  // would be five filters nobody uses.
  { code: "NORDICS", label: "Nordics", group: "europe", inScope: true },

  { code: "US", label: "United States", group: "elsewhere", inScope: false },
  { code: "APAC", label: "Asia-Pacific", group: "elsewhere", inScope: false },
];

const BY_CODE = new Map(JURISDICTIONS.map((j) => [j.code, j]));

export function isJurisdiction(code: string): boolean {
  return BY_CODE.has(code);
}

export function jurisdictionLabel(code: string): string {
  return BY_CODE.get(code)?.label ?? code;
}

/** The codes an editor picks from, in display order. */
export const JURISDICTION_CODES: string[] = JURISDICTIONS.map((j) => j.code);

export type JurisdictionCheck = { ok: true; codes: string[] } | { ok: false; error: string };

/**
 * Validate and normalise a set of tags.
 *
 * Rejects rather than repairs, for the same reason the article write path
 * rejects an unknown `kind`: a silently corrected tag is a wrong tag nobody
 * was told about. The one exception is ordering and duplication, which carry
 * no meaning and are normalised.
 *
 * `GLOBAL` being exclusive is enforced here rather than left to editorial
 * discipline, because it is the rule that decays first: it is always tempting
 * to add GLOBAL to "make sure it is seen", which is exactly what makes the
 * filter useless.
 */
export function validateJurisdictions(input: unknown): JurisdictionCheck {
  const raw = Array.isArray(input)
    ? input
    : typeof input === "string"
      ? input.split(",")
      : [];

  const codes: string[] = [];
  for (const item of raw) {
    const code = String(item).trim().toUpperCase();
    if (!code) continue;
    if (!isJurisdiction(code)) return { ok: false, error: `Unknown jurisdiction: ${code}` };
    if (!codes.includes(code)) codes.push(code);
  }

  if (codes.length === 0) return { ok: false, error: "At least one jurisdiction is required" };
  if (codes.includes(GLOBAL) && codes.length > 1) {
    return {
      ok: false,
      error: "GLOBAL cannot be combined with a specific jurisdiction — a piece is one or the other",
    };
  }

  // Display order follows the registry, so two articles tagged the same way
  // always render the same way.
  codes.sort((a, b) => JURISDICTION_CODES.indexOf(a) - JURISDICTION_CODES.indexOf(b));
  return { ok: true, codes };
}

/** Storage form: a JSON array, matching how `articles.tags` is already stored. */
export function serialiseJurisdictions(codes: string[]): string {
  return JSON.stringify(codes);
}

/**
 * Read the storage form back, tolerating anything.
 *
 * Mirrors `jsonArray` in lib/content.ts: one malformed row must degrade to an
 * untagged article, never take down the page rendering it.
 */
export function parseJurisdictions(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(String).filter(isJurisdiction);
  } catch {
    return [];
  }
}
