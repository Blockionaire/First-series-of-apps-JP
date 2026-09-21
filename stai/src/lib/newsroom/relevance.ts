/**
 * Deciding what is worth researching — gates first, then a ranking.
 *
 * ── Why this is deterministic in phase 2 ────────────────────────────────
 * The masterplan's stage 2 eventually uses a model to score and explain. This
 * phase does not call one, for three reasons:
 *
 *   · the dry run's question is "is discovery finding the right things?", and
 *     a deterministic scorer answers it while changing one variable instead of
 *     two — if a candidate list is wrong, it is wrong because of the gates,
 *     not because of a prompt;
 *   · AI Gateway, spend accounting and prompt versioning are phase 3 in the
 *     masterplan's own table, and reaching for a model here would drag all
 *     three forward;
 *   · two weeks of labelled human verdicts are exactly the material needed to
 *     write that prompt well. Writing it first would be writing it blind.
 *
 * `scoreStory` is the seam. Phase 3 replaces its body with a model call and
 * keeps the shape: gates, a number, and a rationale a human can argue with.
 *
 * ── Gates, then rank, never a threshold ─────────────────────────────────
 * Masterplan change C2. A score threshold makes throughput a function of the
 * news cycle: filler on a quiet day, an overspend on a busy one. Gates are
 * boolean and explainable; the survivors are ranked and the top N run, where
 * N is the budget's business.
 */

import { isJurisdiction } from "./jurisdictions.ts";

export type GateResult = {
  id: string;
  label: string;
  passed: boolean;
  detail: string;
};

export type StoryFacts = {
  title: string;
  lead: string;
  jurisdictions: string[];
  tier1Count: number;
  tier2Count: number;
  tier3Count: number;
  sourceCount: number;
  firstSeenAt: string;
  /**
   * When the development FIRST broke — the oldest member's publication instant.
   *
   * Kept distinct from `latestPublishedAt` because the two answer different
   * questions and the first production run conflated them: a card headed with
   * one member's title was rejected for another member's age.
   */
  publishedAt: string | null;
  /**
   * When the story LAST moved — the newest member's publication instant.
   *
   * This is what freshness means for a living story. A regulation announced in
   * August and amended four days ago is current news, and judging it on the
   * August date rejects it as six weeks stale.
   *
   * Optional, and falls back to `publishedAt`: for a one-item story the two
   * are the same row, and a caller that knows only one date is not asserting
   * anything false by giving only that one.
   */
  latestPublishedAt?: string | null;
  /** Titles of already-published STAI articles, for the "already covered" gate. */
  publishedTitles: string[];
  /** True when a human deliberately escalated a discovery-only cluster. */
  escalated: boolean;
};

/* ── Topic signal ──────────────────────────────────────────────────────── */

/**
 * The desk's subject matter.
 *
 * Grouped so the rationale can say WHICH area a story touches rather than
 * just that it scored. A reviewer disagreeing with "audit" is a different
 * correction from one disagreeing with "AI".
 */
const TOPIC_SIGNALS: { area: string; weight: number; patterns: RegExp[] }[] = [
  {
    area: "audit & assurance",
    weight: 3,
    patterns: [/\baudit(or|ing|s)?\b/i, /\bassurance\b/i, /\bISA\s?\d+/i, /\bISQM\b/i, /\bmateriality\b/i, /\bgoing concern\b/i, /\binternal control\b/i, /\bworking paper/i],
  },
  {
    area: "accounting & reporting",
    weight: 3,
    patterns: [/\bIFRS\b/, /\bIAS\s?\d+/i, /\baccounting standard/i, /\bfinancial report/i, /\bCSRD\b/, /\bESRS\b/, /\bsustainability report/i, /\bdisclosure/i],
  },
  {
    area: "regulation",
    weight: 3,
    patterns: [/\bregulation\b/i, /\bdirective\b/i, /\benforcement\b/i, /\bsupervis(or|ion|ory)\b/i, /\bcompliance\b/i, /\bconsultation\b/i, /\bexposure draft\b/i, /\bcomes into force\b/i],
  },
  {
    area: "AI & automation",
    weight: 2,
    patterns: [/\bartificial intelligence\b/i, /\bAI\b/, /\bmachine learning\b/i, /\bLLM\b/, /\bautomation\b/i, /\bgenerative\b/i, /\balgorithm/i],
  },
  {
    area: "finance & the CFO function",
    weight: 2,
    patterns: [/\bCFO\b/, /\bfinance function\b/i, /\btreasury\b/i, /\bcontroller\b/i, /\bfinancial close\b/i],
  },
  {
    area: "firms & the profession",
    weight: 1,
    patterns: [/\bBig Four\b/i, /\bDeloitte\b/i, /\bPwC\b/i, /\bKPMG\b/i, /\bEY\b/, /\baccounting firm/i, /\bpartnership\b/i],
  },
  {
    area: "cybersecurity & data",
    weight: 1,
    patterns: [/\bcyber/i, /\bbreach\b/i, /\bNIS2\b/i, /\bDORA\b/, /\bdata protection\b/i, /\bGDPR\b/],
  },
];

/** Marketing language that signals a press release rather than a development. */
const TRIVIAL_SIGNALS = [
  /\bis (?:delighted|pleased|excited) to\b/i,
  /\baward[- ]winning\b/i,
  /\bmarket[- ]leading\b/i,
  /\bwebinar\b/i,
  /\bregister now\b/i,
  /\bsponsored\b/i,
  /\bpartner(?:s|ship) with\b/i,
  /\bnamed a leader\b/i,
  /\bappoints?\b.*\bas\b/i,
];

/** Language that marks speculation rather than a development that happened. */
const SPECULATION_SIGNALS = [
  /\brumou?r/i,
  /\bcould (?:soon|eventually)\b/i,
  /\bis said to\b/i,
  /\breportedly (?:plans|will)\b/i,
  /\bspeculat/i,
  /\bwhat (?:to expect|might)\b/i,
];

function matchedAreas(text: string): { area: string; weight: number }[] {
  return TOPIC_SIGNALS.filter((t) => t.patterns.some((re) => re.test(text))).map((t) => ({
    area: t.area,
    weight: t.weight,
  }));
}

/** Rough title similarity, for "have we already covered this". */
function titleOverlap(a: string, b: string): number {
  const norm = (s: string) =>
    new Set(
      s
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length > 3)
    );
  const A = norm(a);
  const B = norm(b);
  if (A.size === 0 || B.size === 0) return 0;
  let shared = 0;
  for (const w of A) if (B.has(w)) shared++;
  return shared / Math.min(A.size, B.size);
}

/* ── The gates ─────────────────────────────────────────────────────────── */

/**
 * Run every hard gate.
 *
 * All of them run even after one fails, because the Inbox shows the full list:
 * "it failed on trivial AND on jurisdiction" is a different correction from
 * "it failed only on trivial", and short-circuiting would hide that.
 */
export function runGates(facts: StoryFacts, now = Date.now()): GateResult[] {
  const text = `${facts.title} ${facts.lead}`;
  const areas = matchedAreas(text);

  const gates: GateResult[] = [];

  // 1. Tier support. The rule from decision D1 — Tier 3 discovers, it does
  //    not qualify. A human escalation satisfies the gate and says so.
  const tierSupport = facts.tier1Count + facts.tier2Count;
  gates.push({
    id: "tier_support",
    label: "Has Tier 1 or Tier 2 support",
    passed: tierSupport > 0 || facts.escalated,
    detail:
      tierSupport > 0
        ? `${facts.tier1Count} Tier 1, ${facts.tier2Count} Tier 2`
        : facts.escalated
          ? "no Tier 1/2 source — escalated by a human"
          : `discovery-only: ${facts.tier3Count} Tier 3 source${facts.tier3Count === 1 ? "" : "s"} and nothing else`,
  });

  // 2. Subject matter. Not "is it interesting" but "is it ours".
  gates.push({
    id: "on_topic",
    label: "Touches the desk's subject matter",
    passed: areas.length > 0,
    detail:
      areas.length > 0
        ? areas.map((a) => a.area).join(", ")
        : "no connection to audit, accountancy, finance or the regulation touching them",
  });

  // 3. Jurisdiction. European-first: a piece about nothing but the US market
  //    is taggable but not something this desk researches.
  const valid = facts.jurisdictions.filter(isJurisdiction);
  const inScope = valid.filter((j) => j !== "US" && j !== "APAC");
  gates.push({
    id: "jurisdiction",
    label: "Relevant to a market the desk covers",
    passed: inScope.length > 0,
    detail:
      inScope.length > 0
        ? inScope.join(", ")
        : valid.length > 0
          ? `only ${valid.join(", ")} — outside the European focus`
          : "no jurisdiction could be determined",
  });

  // 4. Not marketing.
  const trivial = TRIVIAL_SIGNALS.find((re) => re.test(text));
  gates.push({
    id: "not_trivial",
    label: "Not product marketing",
    passed: !trivial,
    detail: trivial ? `reads as promotional: ${String(trivial).slice(0, 40)}` : "",
  });

  // 5. Not speculation. A development that has not happened cannot be
  //    evidenced, and the whole pipeline downstream is built on evidence.
  const speculative = SPECULATION_SIGNALS.find((re) => re.test(text));
  gates.push({
    id: "not_speculation",
    label: "A development, not a rumour",
    passed: !speculative,
    detail: speculative ? "reads as speculation or a preview" : "",
  });

  // 6. Not already covered by a published STAI piece.
  const covered = facts.publishedTitles.find((t) => titleOverlap(facts.title, t) > 0.7);
  gates.push({
    id: "not_covered",
    label: "Not already published by STAI",
    passed: !covered,
    detail: covered ? `close to an existing piece: "${covered}"` : "",
  });

  // 7. Not stale. Republished old news with no new development.
  //
  // Judged on the story's NEWEST member, because "no new development" is the
  // whole condition: a story that moved yesterday has, by definition, a new
  // development, whatever the date of the first report in it. The detail names
  // the date it used — the Inbox showed "47 days ago" beside a headline three
  // days old and there was no way to tell which member that referred to.
  const judged = latestOf(facts);
  const published = judged ? Date.parse(judged) : NaN;
  const ageDays = Number.isFinite(published) ? (now - published) / 86_400_000 : 0;
  gates.push({
    id: "fresh",
    label: "Recent enough to matter",
    passed: ageDays <= 45,
    detail:
      ageDays > 45
        ? `last moved ${Math.round(ageDays)} days ago (${judged!.slice(0, 10)})`
        : "",
  });

  return gates;
}

/**
 * The story's newest known publication instant.
 *
 * Deliberately `??` rather than a max: if `evaluate` ever hands these over the
 * wrong way round, that is a query bug and it should surface as a wrong date in
 * the Inbox, not be silently corrected here.
 *
 * ── How much this currently moves ───────────────────────────────────────
 * Less than it looks, and worth being honest about. `SAME_DEVELOPMENT_DAYS`
 * caps how far a member may be published from its story's representative, so
 * today the two dates differ by at most three days (revisions, which can move
 * a member's publication date, are the exception) and the verdict only changes
 * in a narrow band around the 45-day line. It is kept because it is what
 * "stale" actually means, and because it decouples the judged date from the
 * clustering window: widen that window after the dry run — a likely outcome —
 * and without this the gate would quietly start rejecting live stories.
 */
function latestOf(facts: StoryFacts): string | null {
  return facts.latestPublishedAt ?? facts.publishedAt;
}

export function gatesPassed(gates: GateResult[]): boolean {
  return gates.every((g) => g.passed);
}

export function firstFailure(gates: GateResult[]): GateResult | null {
  return gates.find((g) => !g.passed) ?? null;
}

/* ── Ranking ───────────────────────────────────────────────────────────── */

export type Score = {
  score: number;
  reasons: string[];
};

/**
 * Rank a story that has passed the gates.
 *
 * Used ONLY for ordering — never compared to a threshold. The components are
 * deliberately few and legible, because a nine-way weighted sum is untunable:
 * when it is wrong nobody can say which weight was wrong.
 *
 * This is the seam phase 3 replaces with a model call. The shape stays: a
 * number, and reasons a human can argue with.
 */
export function scoreStory(facts: StoryFacts, now = Date.now()): Score {
  const text = `${facts.title} ${facts.lead}`;
  const reasons: string[] = [];
  let score = 0;

  // Subject matter, weighted by how central the area is to the desk.
  const areas = matchedAreas(text);
  const topic = Math.min(30, areas.reduce((n, a) => n + a.weight * 4, 0));
  if (topic > 0) {
    score += topic;
    reasons.push(`covers ${areas.map((a) => a.area).join(", ")}`);
  }

  // Source authority. A primary source settles what a rule says; coverage
  // does not, however much of it there is.
  if (facts.tier1Count > 0) {
    score += Math.min(25, 15 + facts.tier1Count * 5);
    reasons.push(
      `${facts.tier1Count} primary source${facts.tier1Count === 1 ? "" : "s"} — the issuing body, not coverage of it`
    );
  } else if (facts.tier2Count > 0) {
    score += 8;
    reasons.push("secondary sources only — the primary text would have to be found");
  }

  // Corroboration. Several independent outlets covering one development is
  // evidence that it matters, with sharply diminishing returns.
  if (facts.sourceCount > 1) {
    const corroboration = Math.min(15, Math.round(Math.log2(facts.sourceCount) * 7));
    score += corroboration;
    reasons.push(`reported by ${facts.sourceCount} registered sources`);
  }

  // Recency. Not a cliff: a three-day-old regulatory development is still
  // worth writing about, it is just behind today's.
  // The newest development, for the same reason the freshness gate uses it:
  // a story that moved today is today's news however long it has been running.
  const newest = latestOf(facts);
  const published = newest ? Date.parse(newest) : Date.parse(facts.firstSeenAt);
  const ageDays = Number.isFinite(published) ? Math.max(0, (now - published) / 86_400_000) : 7;
  const recency = Math.max(0, Math.round(15 - ageDays * 2));
  score += recency;
  if (ageDays < 2) reasons.push("published within the last 48 hours");

  // Obligation. A deadline or an effective date is the single strongest
  // signal that a practitioner has to do something, which is the whole
  // editorial test in masterplan §1.
  if (/\beffective (?:from|date|for)\b|\bapplies from\b|\bdeadline\b|\bcomes into force\b|\bby \d{1,2} \w+ \d{4}\b|\bperiods beginning\b/i.test(text)) {
    score += 15;
    reasons.push("introduces a date or obligation a practitioner has to act on");
  }

  // European relevance, explicitly, since the desk is European-first.
  const european = facts.jurisdictions.filter((j) => j !== "US" && j !== "APAC" && j !== "GLOBAL");
  if (european.length > 0) {
    score += 10;
    reasons.push(`applies to ${european.join(", ")}`);
  }

  return { score: Math.max(0, Math.min(100, Math.round(score))), reasons };
}

/* ── The daily cap ─────────────────────────────────────────────────────── */

export type Candidate = {
  storyId: number;
  score: number;
  gates: GateResult[];
  reasons: string[];
};

export type Selection = {
  storyId: number;
  rank: number;
  selected: boolean;
  reason: string;
};

/**
 * Apply the cap.
 *
 * Every qualifying story is ranked; the top `cap` would go to research and the
 * rest would not. Both halves are returned, because the Inbox has to show the
 * near-misses — "it ranked ninth of thirty and the cap was eight" is the most
 * useful thing a reviewer can see about a story that was not picked.
 */
export function applyCap(candidates: Candidate[], cap: number): Selection[] {
  const ranked = [...candidates].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    // Stable and deterministic on ties: the same input must always produce
    // the same selection, or a re-run of a cron job changes the answer.
    return a.storyId - b.storyId;
  });

  return ranked.map((c, i) => ({
    storyId: c.storyId,
    rank: i + 1,
    selected: i < cap,
    reason:
      i < cap
        ? `ranked ${i + 1} of ${ranked.length}, within today's cap of ${cap}`
        : `ranked ${i + 1} of ${ranked.length}, outside today's cap of ${cap}`,
  }));
}
