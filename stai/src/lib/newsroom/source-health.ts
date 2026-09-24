/**
 * Source health: one operational status per source, and why.
 *
 * DERIVED, never stored, and never acted on. Nothing here switches a source
 * off, withdraws retrieval or changes a review status — it reads what the
 * registry, the fetch log and the feed tester already record and says what a
 * person should look at. A stored status would drift the moment somebody
 * flipped a switch; this is recomputed on every page view.
 *
 * Two questions are kept apart throughout, because they have different
 * owners and different answers:
 *
 *   technical — does retrieval WORK?          working · degraded · broken · untested
 *   legal     — MAY we retrieve?              permitted · unchecked · restricted
 *
 * A feed that answers 200 with forty items is technically working and can
 * still be legally unchecked. Nothing here infers permission from a working
 * feed, a robots.txt or a successful Test source.
 *
 * Pure: no database, no clock except the `now` it is given.
 */

import type { Tier } from "./sources.ts";

export type OpStatus = "broken" | "attention" | "unreviewed" | "healthy" | "disabled";
export type Technical = "working" | "degraded" | "broken" | "untested";
export type Legal = "permitted" | "unchecked" | "restricted";
export type ReasonKind = "technical" | "legal" | "confirmation" | "quality" | "review";
export type Reason = { kind: ReasonKind; text: string };

/** One fetch attempt from newsroom_fetch_log. Skips are not attempts. */
export type Attempt = {
  outcome: string;
  at: string;
  itemsFound: number;
  httpStatus: number | null;
};

/** One Test source run, from newsroom_source_probes. */
export type ProbeLite = {
  ok: boolean;
  at: string;
  httpStatus: number | null;
  format: string;
  finalUrl: string;
  itemCount: number;
  error: string;
};

/** What the source's stored items say about its publishing rhythm. */
export type ItemStats = {
  latestPublishedAt: string | null;
  /** Dated items published in the last year, and the earliest of them. */
  datedInYear: number;
  earliestInYear: string | null;
  datedTotal: number;
  /** Items retrieved in the last 30 days, and how many of those had no date. */
  recent: number;
  recentUndated: number;
};

export type HealthInput = {
  tier: number;
  active: boolean;
  fetchAllowed: boolean;
  reviewStatus: string;
  reviewedAt: string | null;
  confirmedAt: string | null;
  termsCheckedAt: string | null;
  /** False for html_scrape with no extractor: nothing can read it. */
  supported: boolean;
  /** Minutes between fetches. */
  fetchFrequency: number;
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  lastOutcome: string;
  lastHttpStatus: number | null;
  lastError: string;
  consecutiveFailures: number;
  /** Newest first, skips excluded. */
  attempts: Attempt[];
  /** Newest first; the latest two are enough. */
  probes: ProbeLite[];
  items: ItemStats | null;
};

/**
 * Warning thresholds. UI policy, not legal fact: "Tier 1 re-checked every 90
 * days" is how often this desk wants to look, not a rule anyone imposed.
 */
export const HEALTH_THRESHOLDS = {
  /** Days after which a human confirmation counts as stale, per tier. */
  confirmDays: { 1: 90, 2: 60, 3: 60 } as Record<Tier, number>,
  /** Days after which a terms / robots check should be renewed. */
  termsDays: 365,
  /** Consecutive failed fetches that make a source broken rather than degraded. */
  brokenAfter: 3,
  /** A source is silent after this many fetch intervals without success (min 24h). */
  silentIntervals: 3,
};
export type Thresholds = typeof HEALTH_THRESHOLDS;

export type Assessment = {
  status: OpStatus;
  technical: Technical;
  legal: Legal;
  /** Most important first. Empty for a healthy or plainly disabled source. */
  reasons: Reason[];
  /** The later of an explicit confirmation and the last review decision. */
  lastConfirmedAt: string | null;
  confirmationStale: boolean;
  /**
   * Where this belongs in "Needs your attention": lower is more urgent.
   * 0 broken · 1 retrieval/legal · 2 stale confirmation · 3 degraded or
   * data quality · 4 unreviewed · 5 healthy · 6 disabled. Tier breaks ties.
   */
  group: number;
};

const DAY = 86_400_000;
const days = (ms: number) => Math.floor(ms / DAY);
const ageMs = (iso: string | null, now: number) => {
  const t = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(t) ? now - t : null;
};

/** Outcomes whose `itemsFound` says how many items the page listed. */
const COUNTED = new Set(["ok", "empty_feed"]);

/** "HTTP 403", "Off-domain redirect", "Timeout" — the failure in a few words. */
export function failureLabel(outcome: string, httpStatus: number | null, error: string): string {
  switch (outcome) {
    case "http_error":
      return httpStatus ? `HTTP ${httpStatus}` : "HTTP error";
    case "off_domain_redirect":
      return "Off-domain redirect";
    case "timeout":
      return "Timeout";
    case "too_large":
      return "Response too large";
    case "parse_error":
      return error ? `Parse error: ${error.slice(0, 80)}` : "Parse error";
    case "network_error":
      return error ? `Network error: ${error.slice(0, 80)}` : "Network error";
    default:
      return error ? error.slice(0, 80) : outcome.replace(/_/g, " ");
  }
}

const median = (xs: number[]) => {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/** Technical health of a source that is on and permitted, i.e. actually fetched. */
function operatingTechnical(i: HealthInput, now: number, t: Thresholds): { technical: Technical; reasons: Reason[] } {
  const reasons: Reason[] = [];
  const tech = (text: string) => reasons.push({ kind: "technical", text });

  if (!i.supported) {
    tech("No extractor built for this publisher — nothing can be retrieved");
    return { technical: "broken", reasons };
  }

  const failure = failureLabel(i.lastOutcome, i.lastHttpStatus, i.lastError);
  if (i.consecutiveFailures >= t.brokenAfter) {
    tech(`${i.consecutiveFailures} consecutive fetch failures — ${failure}`);
    return { technical: "broken", reasons };
  }

  // Zero items where there used to be some. `not_modified` is excluded: a 304
  // lists nothing because nothing changed, which is the healthy case.
  const counted = i.attempts.filter((a) => COUNTED.has(a.outcome));
  const lastThree = counted.slice(0, 3);
  const earlier = counted.slice(3);
  if (lastThree.length === 3 && lastThree.every((a) => a.itemsFound === 0)) {
    const before = Math.max(0, ...earlier.map((a) => a.itemsFound));
    if (before > 0) {
      tech(`Returned 0 items on the last 3 fetches (previously up to ${before})`);
      return { technical: "broken", reasons };
    }
    tech("Returned 0 items on the last 3 fetches");
  }

  let degraded = reasons.length > 0;
  if (i.consecutiveFailures > 0) {
    tech(`${i.consecutiveFailures} recent fetch failure${i.consecutiveFailures === 1 ? "" : "s"} — ${failure}`);
    degraded = true;
  }

  const silentAfter = Math.max(DAY, t.silentIntervals * i.fetchFrequency * 60_000);
  const sinceSuccess = ageMs(i.lastSuccessAt, now);
  if (sinceSuccess === null) {
    if (!i.lastAttemptAt) tech("Waiting for its first fetch");
    else if (i.consecutiveFailures === 0) tech("Never fetched successfully");
    degraded = true;
  } else if (sinceSuccess > silentAfter) {
    tech(`Last success ${relativeAge(i.lastSuccessAt, now)}`);
    degraded = true;
  }

  // Data quality: only with a baseline to compare against. A regulator that
  // publishes twice a quarter is not flagged for being quiet.
  const quality = qualitySignals(i, now);
  if (quality.length > 0) {
    reasons.push(...quality);
    degraded = true;
  }

  return { technical: degraded ? "degraded" : "working", reasons };
}

function qualitySignals(i: HealthInput, now: number): Reason[] {
  const out: Reason[] = [];
  const q = (text: string) => out.push({ kind: "quality", text });

  // Items listed collapsing: historically ~30, now 0–2 (but not all zero,
  // which is the broken case above).
  const counted = i.attempts.filter((a) => COUNTED.has(a.outcome));
  const recent = counted.slice(0, 3);
  const older = counted.slice(3);
  if (recent.length === 3 && older.length >= 3) {
    const typical = median(older.map((a) => a.itemsFound));
    const allLow = recent.every((a) => a.itemsFound <= 2);
    const allZero = recent.every((a) => a.itemsFound === 0);
    if (typical >= 10 && allLow && !allZero) {
      q(`Items per fetch dropped from ~${Math.round(typical)} to 0–2`);
    }
  }

  const s = i.items;
  if (s) {
    // Newest item unexpectedly old for THIS source's rhythm.
    const latestAge = ageMs(s.latestPublishedAt, now);
    const span = s.earliestInYear && s.latestPublishedAt ? Date.parse(s.latestPublishedAt) - Date.parse(s.earliestInYear) : NaN;
    if (latestAge !== null && s.datedInYear >= 5 && Number.isFinite(span) && span > 0) {
      const gap = span / (s.datedInYear - 1);
      if (latestAge > Math.max(3 * gap, 14 * DAY)) {
        q(`Newest item ${relativeAge(s.latestPublishedAt, now)} — usually every ~${Math.max(1, Math.round(gap / DAY))} days`);
      }
    }
    // Suddenly no dates: recent items all undated where earlier ones had them.
    if (s.recent >= 3 && s.recentUndated === s.recent && s.datedTotal > 0) {
      q("Recent items carry no publication date (earlier ones did)");
    }
  }
  return out;
}

/** What the latest Test source runs say, for a source not being fetched. */
function probeSignals(i: HealthInput): { technical: Technical; reasons: Reason[] } {
  const reasons: Reason[] = [];
  if (!i.supported) reasons.push({ kind: "technical", text: "No extractor built for this publisher" });
  const [latest, previous] = i.probes;
  let technical: Technical = "untested";
  if (latest) {
    technical = latest.ok ? "working" : "broken";
    if (!latest.ok) {
      const what = latest.error || (latest.httpStatus ? `HTTP ${latest.httpStatus}` : "no usable items");
      reasons.push({ kind: "technical", text: `Last Test source failed: ${what.slice(0, 90)}` });
    }
  }
  if (!i.supported && technical === "untested") technical = "broken";
  return { technical, reasons: [...reasons, ...probeChanges(latest, previous)] };
}

/** Redirect target or format changed between the last two tests. */
function probeChanges(latest?: ProbeLite, previous?: ProbeLite): Reason[] {
  if (!latest || !previous || !latest.ok || !previous.ok) return [];
  const out: Reason[] = [];
  if (latest.format !== previous.format) {
    out.push({ kind: "quality", text: `Format changed between tests: ${previous.format} → ${latest.format}` });
  }
  if (latest.finalUrl && previous.finalUrl && latest.finalUrl !== previous.finalUrl) {
    out.push({ kind: "quality", text: "Redirect target changed between tests" });
  }
  return out;
}

export function assessSource(i: HealthInput, now = Date.now(), t: Thresholds = HEALTH_THRESHOLDS): Assessment {
  const tier = (i.tier === 1 || i.tier === 2 || i.tier === 3 ? i.tier : 3) as Tier;
  const legal: Legal = i.reviewStatus === "do_not_use" ? "restricted" : i.fetchAllowed ? "permitted" : "unchecked";

  const lastConfirmedAt = latestOf(i.confirmedAt, i.reviewedAt);
  const confirmAge = ageMs(lastConfirmedAt, now);
  const confirmationStale = confirmAge !== null && confirmAge > t.confirmDays[tier] * DAY;

  const base = { legal, lastConfirmedAt, confirmationStale };

  if (i.reviewStatus === "do_not_use") {
    return { ...base, status: "disabled", technical: "untested", reasons: [{ kind: "review", text: "Marked do not use" }], group: 6 };
  }

  const operating = i.active && i.fetchAllowed;
  const tech = operating ? operatingTechnical(i, now, t) : probeSignals(i);
  if (operating) tech.reasons.push(...probeChanges(i.probes[0], i.probes[1]));

  if (i.reviewStatus === "unreviewed") {
    if (operating && tech.technical === "broken") {
      return { ...base, status: "broken", technical: "broken", reasons: [...tech.reasons, { kind: "review", text: "Never reviewed" }], group: 0 };
    }
    const reasons: Reason[] = [...tech.reasons, { kind: "review", text: operating ? "On and retrieving, but never reviewed" : "Not yet reviewed" }];
    return { ...base, status: "unreviewed", technical: tech.technical, reasons, group: 4 };
  }

  const reasons: Reason[] = [...tech.reasons];
  if (i.reviewStatus === "needs_fix") reasons.unshift({ kind: "review", text: "Marked needs fix" });

  // Retrieval / legal. Only ever raised as something to look at — never
  // resolved here, and never inferred from a working feed.
  if (i.active && !i.fetchAllowed) {
    reasons.unshift({ kind: "legal", text: "On, but retrieval permission unchecked — nothing is fetched" });
  } else if (!i.active && !i.fetchAllowed && (i.reviewStatus === "feed_verified" || i.reviewStatus === "retrieval_approved")) {
    reasons.unshift({ kind: "legal", text: "Feed verified, retrieval permission unchecked" });
  }
  if (i.fetchAllowed) {
    const termsAge = ageMs(i.termsCheckedAt, now);
    if (termsAge !== null && termsAge > t.termsDays * DAY) {
      reasons.push({ kind: "legal", text: `Terms last checked ${relativeAge(i.termsCheckedAt, now)}` });
    }
  }

  if (operating) {
    if (tech.technical === "broken") return { ...base, status: "broken", technical: "broken", reasons, group: 0 };
    if (confirmationStale) {
      reasons.push({ kind: "confirmation", text: `Human confirmation ${relativeAge(lastConfirmedAt, now)}` });
    }
    if (reasons.length === 0) return { ...base, status: "healthy", technical: tech.technical, reasons, group: 5 };
    return { ...base, status: "attention", technical: tech.technical, reasons, group: groupFor(reasons) };
  }

  // Not being fetched. Switched off after review is a decision, not a problem,
  // unless something is still waiting on a person.
  const waiting = reasons.some((r) => r.kind === "legal" || r.kind === "review");
  if (waiting) return { ...base, status: "attention", technical: tech.technical, reasons, group: groupFor(reasons) };
  return {
    ...base,
    status: "disabled",
    technical: tech.technical,
    reasons: [{ kind: "review", text: i.active ? "Retrieval not permitted" : "Switched off" }, ...reasons],
    group: 6,
  };
}

function groupFor(reasons: Reason[]): number {
  if (reasons.some((r) => r.kind === "legal")) return 1;
  if (reasons.some((r) => r.kind === "confirmation")) return 2;
  return 3;
}

function latestOf(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return Date.parse(a) >= Date.parse(b) ? a : b;
}

/** "today", "yesterday", "12 days ago", "4 months ago", "2 years ago". */
export function relativeAge(iso: string | null, now = Date.now()): string {
  const ms = ageMs(iso, now);
  if (ms === null) return "never";
  if (ms < 0) return "today";
  const d = days(ms);
  if (d === 0) return "today";
  if (d === 1) return "yesterday";
  if (d < 45) return `${d} days ago`;
  const months = Math.round(d / 30.4);
  if (months < 18) return `${months} months ago`;
  return `${Math.round(d / 365)} years ago`;
}

/** Display order: broken, attention, unreviewed, healthy, disabled. */
export const STATUS_ORDER: Record<OpStatus, number> = {
  broken: 0,
  attention: 1,
  unreviewed: 2,
  healthy: 3,
  disabled: 4,
};

/** The default table order: status, then Tier 1 before 2 before 3, then name. */
export function compareByStatus(
  a: { status: OpStatus; tier: number; name: string },
  b: { status: OpStatus; tier: number; name: string }
): number {
  return STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.tier - b.tier || a.name.localeCompare(b.name);
}

/** "Needs your attention": most urgent group first, Tier 1 first within it. */
export function attentionQueue<T extends { group: number; tier: number; name: string }>(rows: T[], limit = 10): T[] {
  return rows
    .filter((r) => r.group <= 4)
    .sort((a, b) => a.group - b.group || a.tier - b.tier || a.name.localeCompare(b.name))
    .slice(0, limit);
}
