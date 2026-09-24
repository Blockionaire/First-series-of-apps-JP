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

  /* ── Fetch telemetry (phase 2) ────────────────────────────────────────
   * `last_success_at` answers "when did this last WORK". These answer "what
   * happened the last time we TRIED", which is the question an operator
   * actually asks when a feed looks quiet: a source whose last attempt was a
   * 404 four minutes ago and one that simply has not been due for an hour are
   * indistinguishable without them.
   */
  last_attempt_at: string | null;
  last_outcome: string;
  last_http_status: number | null;
  last_error: string;
  last_items_found: number;
  last_items_new: number;
  /** Conditional-GET validators, so most polls cost a bodyless 304. */
  etag: string;
  last_modified_header: string;

  /* ── Human review (phase 2.5) ─────────────────────────────────────────
   * What a person concluded, which is not what the engine may do. Nothing in
   * the fetch path reads any of these — see REVIEW_STATUSES below.
   */
  review_status: ReviewStatus;
  reviewed_by: string;
  reviewed_at: string | null;
  review_note: string;
};

/**
 * How far a human has got with a source.
 *
 * ── Advisory, and that is the design ────────────────────────────────────
 * `shouldFetch` reads `active` and `fetch_allowed` and nothing else. It is
 * deliberately blind to this field, including to `retrieval_approved`, because
 * a reviewer recording a conclusion in a dropdown must not be the act that
 * starts retrieval. Permission stays a separate, deliberate switch — if
 * choosing a status turned fetching on, the two-switch design would be one
 * switch with extra words.
 *
 * `needs_fix` and `do_not_use` are kept apart on purpose. The first is a queue
 * to work through; the second is a decision already taken. Collapsing them
 * loses the distinction between "nobody has fixed this yet" and "we looked and
 * the answer is no", and the second is the one that stops being re-litigated
 * every time somebody scans the registry.
 */
export const REVIEW_STATUSES = [
  "unreviewed",
  "feed_verified",
  "retrieval_approved",
  "needs_fix",
  "do_not_use",
] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export function isReviewStatus(v: string): v is ReviewStatus {
  return (REVIEW_STATUSES as readonly string[]).includes(v);
}

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

/**
 * What a caller may state about a source.
 *
 * Everything else on `Source` is the system's own record — activation,
 * health, fetch telemetry, conditional-GET validators — and none of it is
 * accepted from an API body. Listing the editable fields explicitly rather
 * than subtracting the others from `Source` means a new system field is
 * un-settable by default: the failure would be at the type level, not a
 * quietly writable column.
 */
export type SourceFields = Pick<
  Source,
  | "name"
  | "domain"
  | "source_type"
  | "authority_tier"
  | "jurisdictions"
  | "topics"
  | "ingestion_method"
  | "feed_url"
  | "fetch_frequency"
  | "fetch_allowed"
  | "license_notes"
  | "snapshot_retention"
>;

export type SourceCheck = { ok: true; value: SourceFields } | { ok: false; error: string };

/**
 * Does this URL belong to that registered domain?
 *
 * One implementation, used by two callers with different jobs: `validateSource`
 * enforces it when a feed URL is stored, and the feed tester enforces it before
 * making a request. Two copies of a containment check drift, and the copy that
 * drifts is never the one anybody is looking at.
 *
 * https only, host must equal the registered domain or be a subdomain of it.
 * That is what keeps the tester a feed tester: the furthest an admin can aim it
 * is a different path on a publisher already in the registry, not at a cloud
 * metadata endpoint or an internal address.
 */
export function feedUrlBelongsTo(url: string, domain: string): boolean {
  if (!/^https:\/\//i.test(url)) return false;
  const want = domain.trim().toLowerCase().replace(/^www\./, "");
  if (!want) return false;
  try {
    const host = new URL(url).host.toLowerCase().replace(/^www\./, "");
    return host === want || host.endsWith(`.${want}`);
  } catch {
    return false;
  }
}

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
    // The feed has to belong to the source it is registered under, or the tier
    // means nothing: a Tier-1 row pointing at a blog would launder that blog's
    // claims as authoritative. The same rule contains the feed tester, which is
    // why it lives in one function rather than two copies.
    if (!feedUrlBelongsTo(feed_url, domain)) {
      let host = "";
      try {
        host = new URL(feed_url).host.toLowerCase().replace(/^www\./, "");
      } catch {
        return { ok: false, error: "Feed URL could not be parsed" };
      }
      return { ok: false, error: `Feed host ${host} does not belong to ${domain}` };
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

/* ── Is this source actually live? ───────────────────────────────────────
 * `sourceHealth` answers "is retrieval working". This answers the question an
 * operator scanning fifty rows is really asking: is this one doing its job,
 * does it need me, or is it simply off?
 *
 * Derived, never stored. A stored flag would drift the moment somebody
 * flipped a switch, and the whole value here is that one glance is TRUE.
 */

export const LIVE_STATES = ["live", "waiting", "broken", "dormant", "excluded"] as const;
export type LiveState = (typeof LIVE_STATES)[number];

/**
 * What one row is really doing.
 *
 * ── Why the dot reports reality, not intent ─────────────────────────────
 * `review_status` is advisory and deliberately cannot start a fetch, so it is
 * NOT part of this. A source that is on, permitted and retrieving is live
 * whether or not anyone ticked a dropdown — and showing it as anything else
 * would hide the fact that something was switched on without being reviewed,
 * which is exactly the situation worth seeing.
 *
 * The one exception is `do_not_use`, which already withdraws both permissions
 * when it is set; it appears here so a rejected row reads as a decision rather
 * than as an ordinary dormant one.
 *
 * ── Order matters ───────────────────────────────────────────────────────
 * Dormant is checked before health, because a source that is switched off is
 * not broken — it is off. Reporting "never fetched" for forty-eight dormant
 * rows would bury the two that genuinely need attention, which is the bug
 * `sourcesWithHealth` already guards against for the health column.
 */
export function liveState(s: {
  active: boolean;
  fetch_allowed: boolean;
  review_status?: string;
  /** False when the method cannot be retrieved at all — html_scrape with no extractor. */
  supported?: boolean;
  health: HealthState;
}): LiveState {
  if (s.review_status === "do_not_use") return "excluded";
  if (!s.active || !s.fetch_allowed) return "dormant";

  // On and permitted, but the engine has no way to read it. This never
  // resolves on its own, so it is broken rather than waiting.
  if (s.supported === false) return "broken";

  if (s.health === "failing" || s.health === "blocked") return "broken";
  if (s.health === "never_fetched" || s.health === "silent") return "waiting";
  return "live";
}

/* ── Editing an existing source ──────────────────────────────────────────── */

/** The fields "Edit details" may change. Not domain, feed URL or method. */
export type SourceDetails = {
  name: string;
  source_type: string;
  authority_tier: number;
  jurisdictions: string[];
  fetch_frequency: number;
  snapshot_retention: string;
  license_notes: string;
};

/**
 * What an edit changed, in words for the source's log: "tier 2 → 1;
 * jurisdictions EU → EU, NL". Empty when nothing changed.
 *
 * Jurisdictions compare as sets, so re-ordering them is not a change.
 */
export function describeSourceChanges(before: SourceDetails, after: SourceDetails): string {
  const out: string[] = [];
  if (before.name !== after.name) out.push(`name "${before.name}" → "${after.name}"`);
  if (before.source_type !== after.source_type) out.push(`type ${before.source_type} → ${after.source_type}`);
  if (before.authority_tier !== after.authority_tier) out.push(`tier ${before.authority_tier} → ${after.authority_tier}`);
  const a = [...before.jurisdictions].sort().join(", ");
  const b = [...after.jurisdictions].sort().join(", ");
  if (a !== b) out.push(`jurisdictions ${a || "none"} → ${b || "none"}`);
  if (before.fetch_frequency !== after.fetch_frequency) {
    out.push(`fetch every ${before.fetch_frequency} → ${after.fetch_frequency} min`);
  }
  if (before.snapshot_retention !== after.snapshot_retention) {
    out.push(`retention ${before.snapshot_retention} → ${after.snapshot_retention}`);
  }
  if (before.license_notes !== after.license_notes) out.push("licence notes edited");
  return out.join("; ");
}
