/**
 * The source registry — the allowlist the engine may read from.
 *
 * This is the boundary between "a considered list of publications" and
 * "whatever the web returned". Nothing enters the pipeline that is not
 * represented by a row here, and no row does anything until a human turns it
 * on.
 *
 * ── Why activation is manual ─────────────────────────────────────────────
 * Phase 1 ships a proposed list of ~50 sources. If seeding also activated
 * them, the registry would silently become "whatever the seed file happened to
 * contain" — which is the exact failure the registry exists to prevent. Rows
 * land with `active = 0`; the operator reads each one, checks the tier, the
 * jurisdiction and whether retrieval is permitted, and activates it
 * individually. Activation records who and when.
 */

import { isJurisdiction } from "./jurisdictions.ts";

/**
 * How much weight a source's word carries.
 *
 * The tier is not a quality ranking of the publication — Reuters is excellent
 * journalism and sits at Tier 2. It is a statement about *what kind of claim*
 * the source can settle. Only the body that issued a rule can settle what the
 * rule says.
 */
export const TIERS = [1, 2, 3] as const;
export type Tier = (typeof TIERS)[number];

export const TIER_MEANING: Record<Tier, string> = {
  1: "Authoritative — the issuing body. Factual claims rest here.",
  2: "Trusted secondary — quality journalism, research houses, firm analyses. Context and discovery.",
  3: "Discovery — signal only. Can never on its own send a story into research.",
};

export const SOURCE_TYPES = [
  "regulator",
  "standard_setter",
  "vendor",
  "firm",
  "news",
  "research",
  "professional_body",
  "community",
] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

/**
 * How items are retrieved.
 *
 * `html_scrape` exists because several standard setters publish nothing
 * machine-readable. It is the fragile one: a site redesign breaks it silently,
 * which is what the health monitoring below is for.
 */
export const INGESTION_METHODS = ["rss", "atom", "json_api", "html_scrape", "manual"] as const;
export type IngestionMethod = (typeof INGESTION_METHODS)[number];

/**
 * How long a retrieved copy is kept (masterplan §8, change C8).
 *
 * Not a storage-cost decision so much as a copyright one. Official texts are
 * public documents and the citation has to stay checkable for as long as the
 * article stands. A news article is somebody's property, and keeping its full
 * body indefinitely to support three extracted sentences is neither necessary
 * nor defensible.
 */
export const RETENTION = ["indefinite", "ninety_days", "reference_only"] as const;
export type Retention = (typeof RETENTION)[number];

export const DEFAULT_RETENTION: Record<Tier, Retention> = {
  1: "indefinite",
  2: "ninety_days",
  3: "reference_only",
};

export type Source = {
  id: number;
  name: string;
  domain: string;
  source_type: SourceType;
  authority_tier: Tier;
  /** Jurisdiction codes this source speaks for. */
  jurisdictions: string[];
  topics: string[];
  ingestion_method: IngestionMethod;
  feed_url: string;
  /** Minutes between fetches. */
  fetch_frequency: number;
  /**
   * Whether robots.txt and the site's terms permit automated retrieval.
   * Checked at registration and re-checked monthly. A source may be active
   * and not fetchable — that combination means "approved in principle,
   * blocked in practice", and the Inbox says so rather than hiding it.
   */
  fetch_allowed: boolean;
  license_notes: string;
  snapshot_retention: Retention;
  /** Nothing happens until a human sets this. */
  active: boolean;
  activated_at: string | null;
  activated_by: string | null;
  last_success_at: string | null;
  consecutive_failures: number;
  created_at: string;
};

/** The per-tier default cadence, in minutes (masterplan §5). */
export const DEFAULT_FREQUENCY: Record<Tier, number> = {
  1: 30,
  2: 60,
  3: 120,
};

export function isTier(v: number): v is Tier {
  return (TIERS as readonly number[]).includes(v);
}

export function isSourceType(v: string): v is SourceType {
  return (SOURCE_TYPES as readonly string[]).includes(v);
}

export function isIngestionMethod(v: string): v is IngestionMethod {
  return (INGESTION_METHODS as readonly string[]).includes(v);
}

export function isRetention(v: string): v is Retention {
  return (RETENTION as readonly string[]).includes(v);
}

export type SourceInput = {
  name: string;
  domain: string;
  source_type: string;
  authority_tier: number;
  jurisdictions: string[];
  topics: string[];
  ingestion_method: string;
  feed_url: string;
  fetch_frequency?: number;
  fetch_allowed?: boolean;
  license_notes?: string;
  snapshot_retention?: string;
};

export type SourceCheck =
  | { ok: true; value: Omit<Source, "id" | "active" | "activated_at" | "activated_by" | "last_success_at" | "consecutive_failures" | "created_at"> }
  | { ok: false; error: string };

/**
 * Validate a registry entry.
 *
 * Rejects rather than repairs. A source silently corrected to Tier 2 because
 * someone typed 4 is a source whose claims now carry weight nobody granted
 * them.
 */
export function validateSource(input: SourceInput): SourceCheck {
  const name = input.name?.trim() ?? "";
  if (!name) return { ok: false, error: "Name is required" };

  const domain = (input.domain ?? "").trim().toLowerCase().replace(/^www\./, "");
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) {
    return { ok: false, error: `Not a domain: ${input.domain}` };
  }

  if (!isSourceType(input.source_type)) {
    return { ok: false, error: `Unknown source type: ${input.source_type}` };
  }
  if (!isTier(input.authority_tier)) {
    return { ok: false, error: `Tier must be 1, 2 or 3 — got ${input.authority_tier}` };
  }
  if (!isIngestionMethod(input.ingestion_method)) {
    return { ok: false, error: `Unknown ingestion method: ${input.ingestion_method}` };
  }

  const jurisdictions = (input.jurisdictions ?? []).map((j) => String(j).trim().toUpperCase());
  if (jurisdictions.length === 0) {
    return { ok: false, error: "A source must declare at least one jurisdiction" };
  }
  for (const j of jurisdictions) {
    if (!isJurisdiction(j)) return { ok: false, error: `Unknown jurisdiction: ${j}` };
  }

  // A feed URL is required for everything the engine fetches itself. `manual`
  // is the exception: it exists for sources an editor drops in by hand.
  const feed_url = (input.feed_url ?? "").trim();
  if (input.ingestion_method !== "manual") {
    if (!/^https:\/\//i.test(feed_url)) {
      return { ok: false, error: "Feed URL must be an https URL" };
    }
    try {
      const host = new URL(feed_url).host.toLowerCase().replace(/^www\./, "");
      // The feed has to belong to the source it is registered under, or the
      // tier means nothing: a Tier-1 row pointing at a blog would launder that
      // blog's claims as authoritative.
      if (host !== domain && !host.endsWith(`.${domain}`)) {
        return { ok: false, error: `Feed host ${host} does not belong to ${domain}` };
      }
    } catch {
      return { ok: false, error: "Feed URL could not be parsed" };
    }
  }

  const tier = input.authority_tier;
  const retention = input.snapshot_retention ?? DEFAULT_RETENTION[tier];
  if (!isRetention(retention)) {
    return { ok: false, error: `Unknown retention policy: ${retention}` };
  }

  const frequency = input.fetch_frequency ?? DEFAULT_FREQUENCY[tier];
  if (!Number.isInteger(frequency) || frequency < 15 || frequency > 10080) {
    return { ok: false, error: "Fetch frequency must be between 15 minutes and a week" };
  }

  return {
    ok: true,
    value: {
      name,
      domain,
      source_type: input.source_type,
      authority_tier: tier,
      jurisdictions,
      topics: (input.topics ?? []).map((t) => String(t).trim()).filter(Boolean),
      ingestion_method: input.ingestion_method,
      feed_url,
      fetch_frequency: frequency,
      fetch_allowed: input.fetch_allowed ?? false,
      license_notes: (input.license_notes ?? "").trim(),
      snapshot_retention: retention,
    },
  };
}

export type HealthState = "ok" | "never_fetched" | "silent" | "failing" | "blocked";

export type Health = { state: HealthState; detail: string };

/**
 * Is this source actually working?
 *
 * The failure this catches is the quiet one. A feed that returns errors shows
 * up in logs; a feed that was redesigned into an empty response returns 200
 * forever and simply stops producing items. Nothing errors, nothing alerts,
 * and a Tier-1 regulator drops out of the desk's coverage without anyone
 * noticing for a month.
 *
 * `3 × fetch_frequency` is the threshold: long enough that a quiet regulator
 * on a slow week is not flagged, short enough that a broken scraper is caught
 * within hours rather than after the story was missed.
 */
export function sourceHealth(
  s: Pick<Source, "active" | "fetch_allowed" | "fetch_frequency" | "last_success_at" | "consecutive_failures">,
  now = Date.now()
): Health {
  if (!s.fetch_allowed) {
    return { state: "blocked", detail: "retrieval not permitted — check robots.txt and terms" };
  }
  if (s.consecutive_failures > 3) {
    return { state: "failing", detail: `${s.consecutive_failures} consecutive failures` };
  }
  if (!s.last_success_at) {
    return { state: "never_fetched", detail: "no successful fetch yet" };
  }
  const last = Date.parse(s.last_success_at);
  if (!Number.isFinite(last)) {
    return { state: "never_fetched", detail: "no usable last-success timestamp" };
  }
  const silentFor = now - last;
  const limit = s.fetch_frequency * 3 * 60_000;
  if (silentFor > limit) {
    const hours = Math.floor(silentFor / 3_600_000);
    return { state: "silent", detail: `nothing retrieved for ${hours}h` };
  }
  return { state: "ok", detail: "" };
}
