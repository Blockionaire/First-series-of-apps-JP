/**
 * The extractor allowlist.
 *
 * ── An allowlist, not a dispatcher ──────────────────────────────────────
 * `extractorFor` returns null for every domain not listed below, and a source
 * whose domain is not listed keeps reporting `skipped_unsupported` exactly as
 * it did before any of this existed. That is the property worth protecting:
 * registering a source can never, by itself, cause a page to be scraped. It
 * takes a file in this directory, written against one publisher's conventions,
 * and a line here.
 *
 * The list is expected to stay short. Every entry is a maintenance commitment
 * — someone's site will change and the extractor will break — which is why the
 * criterion for adding one is that the publisher is a Tier-1 primary source
 * the desk cannot otherwise reach, not that their page looked parseable.
 */

import { aiOffice } from "./ai-office.ts";
import { anthropic } from "./anthropic.ts";
import { apas } from "./apas.ts";
import { ceaob } from "./ceaob.ts";
import { coso } from "./coso.ts";
import { enisa } from "./enisa.ts";
import { frc } from "./frc.ts";
import { h2a } from "./h2a.ts";
import type { Extractor } from "./types.ts";

export type { Extractor, ExtractResult } from "./types.ts";

/** Every publisher with a hand-written extractor. */
export const EXTRACTORS: readonly Extractor[] = [
  apas,
  anthropic,
  ceaob,
  enisa,
  aiOffice,
  coso,
  frc,
  h2a,
];

/**
 * The extractor for a registered domain, or null.
 *
 * Matches the domain exactly or as a parent of a subdomain, the same rule the
 * registry uses for feed URLs, so `www.apasbafa.bund.de` resolves and
 * `apasbafa.bund.de.example.com` does not.
 */
export function extractorFor(domain: string): Extractor | null {
  const want = domain.trim().toLowerCase().replace(/^www\./, "");
  if (!want) return null;
  return (
    EXTRACTORS.find((e) => want === e.domain || want.endsWith(`.${e.domain}`)) ?? null
  );
}
