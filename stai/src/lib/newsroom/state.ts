/**
 * The pipeline state machine.
 *
 * Every story in the newsroom is in exactly one of these states, and the set
 * of moves out of each one is enumerated here rather than implied by whichever
 * workflow happens to run next.
 *
 * ── Why this is a module and not a string column convention ──────────────
 * A pipeline assembled from free-form status strings fails in a specific,
 * miserable way: one workflow writes "needs_review", another checks for
 * "NEEDS_REVIEW", and a story sits in the queue forever without anything
 * erroring. Nobody notices until someone asks why a story from three weeks ago
 * never appeared. Every transition in this system goes through `canTransition`
 * and every write records the move, so a stuck story is visible as a story
 * whose last event is old — not as an absence.
 *
 * ── The audit trail is the point ─────────────────────────────────────────
 * Principle E of the masterplan says everything must be reproducible. For an
 * audience of auditors that is the platform's credibility, and it is bought
 * here: `pipeline_events` records actor, from-state, to-state, reason and
 * timestamp for every move, including the ones a human makes by hand.
 */

export const STORY_STATES = [
  "DISCOVERED",
  "REJECTED",
  "QUEUED_FOR_RESEARCH",
  "RESEARCHING",
  "EVIDENCE_READY",
  "DRAFTING",
  "FACT_CHECKING",
  "EDITORIAL_QA",
  "NEEDS_REVIEW",
  "APPROVED",
  "PUBLISHING",
  "PUBLISHED",
  // A published story stays reachable: regulation arrives in stages, and a new
  // development on an existing piece is an amendment, not a second article.
  "LIVE",
  "UPDATE_PROPOSED",
  // Failures. Each names the stage that failed, because "FAILED" alone tells
  // an operator nothing about whether to retry, re-research or drop.
  "RESEARCH_FAILED",
  "INSUFFICIENT_EVIDENCE",
  "FACT_CHECK_FAILED",
  "EDITORIAL_FAILED",
  "PUBLISH_FAILED",
] as const;

export type StoryState = (typeof STORY_STATES)[number];

export function isStoryState(v: string): v is StoryState {
  return (STORY_STATES as readonly string[]).includes(v);
}

/**
 * The legal moves.
 *
 * Read this as the whole lifecycle. Anything absent is impossible, which
 * includes the moves worth stating explicitly: there is no edge from
 * DISCOVERED to DRAFTING (nothing may be written without evidence), none from
 * NEEDS_REVIEW to PUBLISHED (approval is a separate, recorded act), and none
 * out of REJECTED except a deliberate human reopen.
 */
const TRANSITIONS: Record<StoryState, readonly StoryState[]> = {
  DISCOVERED: ["REJECTED", "QUEUED_FOR_RESEARCH"],
  // Reopening a rejected story is a human act. The engine never reverses its
  // own rejection, because a filter that argues with itself has no filter.
  REJECTED: ["QUEUED_FOR_RESEARCH"],
  QUEUED_FOR_RESEARCH: ["RESEARCHING", "REJECTED"],
  RESEARCHING: ["EVIDENCE_READY", "RESEARCH_FAILED", "INSUFFICIENT_EVIDENCE"],
  EVIDENCE_READY: ["DRAFTING", "REJECTED"],
  DRAFTING: ["FACT_CHECKING", "EDITORIAL_FAILED"],
  FACT_CHECKING: ["EDITORIAL_QA", "FACT_CHECK_FAILED"],
  EDITORIAL_QA: ["NEEDS_REVIEW", "EDITORIAL_FAILED"],
  // The human gate. Three ways out, and one of them is back to research.
  NEEDS_REVIEW: ["APPROVED", "REJECTED", "QUEUED_FOR_RESEARCH"],
  APPROVED: ["PUBLISHING", "NEEDS_REVIEW"],
  PUBLISHING: ["PUBLISHED", "PUBLISH_FAILED"],
  PUBLISHED: ["LIVE"],
  LIVE: ["UPDATE_PROPOSED"],
  // An amendment goes through the same review as an original.
  UPDATE_PROPOSED: ["NEEDS_REVIEW", "LIVE"],

  // Failures are recoverable by a human, and only by a human. An automatic
  // retry out of FACT_CHECK_FAILED would be the engine overruling its own
  // verifier, which is the one thing it must never do.
  RESEARCH_FAILED: ["QUEUED_FOR_RESEARCH", "REJECTED"],
  INSUFFICIENT_EVIDENCE: ["QUEUED_FOR_RESEARCH", "REJECTED"],
  FACT_CHECK_FAILED: ["QUEUED_FOR_RESEARCH", "REJECTED"],
  EDITORIAL_FAILED: ["DRAFTING", "QUEUED_FOR_RESEARCH", "REJECTED"],
  PUBLISH_FAILED: ["APPROVED", "REJECTED"],
};

export function nextStates(from: StoryState): readonly StoryState[] {
  return TRANSITIONS[from];
}

export function canTransition(from: StoryState, to: StoryState): boolean {
  return TRANSITIONS[from].includes(to);
}

/** States a story can sit in indefinitely without anything being wrong. */
export const RESTING_STATES: readonly StoryState[] = [
  "DISCOVERED",
  "REJECTED",
  "NEEDS_REVIEW",
  "LIVE",
  "UPDATE_PROPOSED",
];

/** States that mean a stage failed and a human has to decide what happens. */
export const FAILURE_STATES: readonly StoryState[] = [
  "RESEARCH_FAILED",
  "INSUFFICIENT_EVIDENCE",
  "FACT_CHECK_FAILED",
  "EDITORIAL_FAILED",
  "PUBLISH_FAILED",
];

export function isFailureState(s: StoryState): boolean {
  return FAILURE_STATES.includes(s);
}

/**
 * States where work is in flight.
 *
 * Anything here for longer than a workflow should take is stuck, and the
 * Editorial Inbox surfaces it as such. This is the only way a silently dropped
 * story becomes visible.
 */
export const IN_FLIGHT_STATES: readonly StoryState[] = [
  "QUEUED_FOR_RESEARCH",
  "RESEARCHING",
  "EVIDENCE_READY",
  "DRAFTING",
  "FACT_CHECKING",
  "EDITORIAL_QA",
  "APPROVED",
  "PUBLISHING",
];

/** How long a story may sit in flight before the Inbox calls it stuck. */
export const STUCK_AFTER_MINUTES = 90;

/** Who caused a transition. Recorded on every event; never inferred later. */
export const ACTORS = ["engine", "human", "system"] as const;
export type Actor = (typeof ACTORS)[number];

export type TransitionResult =
  | { ok: true; from: StoryState; to: StoryState }
  | { ok: false; error: string };

/**
 * The one place a state change is decided.
 *
 * Returns rather than throws: a rejected transition is a normal outcome of a
 * retried workflow step, not an exception. A step that re-runs after a partial
 * failure will often try to move a story that has already moved, and that must
 * read as "already done", not as a crash.
 */
export function transition(from: string, to: string): TransitionResult {
  if (!isStoryState(from)) return { ok: false, error: `Unknown current state: ${from}` };
  if (!isStoryState(to)) return { ok: false, error: `Unknown target state: ${to}` };
  if (from === to) return { ok: false, error: `Already in ${to}` };
  if (!canTransition(from, to)) {
    return { ok: false, error: `Cannot move from ${from} to ${to}` };
  }
  return { ok: true, from, to };
}

/**
 * The gate named in masterplan §5 (decision D1).
 *
 * A Tier-3 source may open a cluster and put it in front of a human. It may
 * not, on its own, send a story into research — and therefore never into
 * article generation. Social media noticing something is a reason to look, not
 * a reason to publish.
 *
 * A human may escalate a discovery-only cluster by hand. That is an override,
 * recorded as one, with a reason. It is not a loophole the engine can use.
 */
export function mayEnterResearch(counts: {
  tier1: number;
  tier2: number;
}): { ok: true } | { ok: false; reason: string } {
  if (counts.tier1 + counts.tier2 > 0) return { ok: true };
  return {
    ok: false,
    reason: "discovery-only: no Tier 1 or Tier 2 source in this cluster",
  };
}

/**
 * The stricter rule for regulation and standards (masterplan §8).
 *
 * Deliberately has no override parameter. If this ever needs relaxing, it gets
 * relaxed in code review where someone has to justify it — not behind a
 * checkbox in an admin screen at eleven at night.
 */
export function mayReachReview(input: {
  riskClass: RiskClass;
  primarySourceCount: number;
}): { ok: true } | { ok: false; reason: string } {
  if (REGULATORY_RISK.includes(input.riskClass) && input.primarySourceCount === 0) {
    return {
      ok: false,
      reason: `${input.riskClass} content requires at least one primary source`,
    };
  }
  return { ok: true };
}

export const RISK_CLASSES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export type RiskClass = (typeof RISK_CLASSES)[number];

export function isRiskClass(v: string): v is RiskClass {
  return (RISK_CLASSES as readonly string[]).includes(v);
}

/** Classes where the primary-source rule bites. */
const REGULATORY_RISK: readonly RiskClass[] = ["HIGH", "CRITICAL"];

/**
 * Whether a risk class may ever publish without a human.
 *
 * In v1 this returns false for everything — nothing publishes automatically,
 * including LOW — and the KPI gate in masterplan §22 is what would change it.
 * The switch is here, off, rather than absent, so that turning it on later is
 * an edit to one obvious line instead of a new concept threaded through the
 * publication workflow.
 */
export const AUTOPUBLISH_ENABLED = false;

export function mayAutoPublish(risk: RiskClass): boolean {
  if (!AUTOPUBLISH_ENABLED) return false;
  // Even with the switch on, these two never publish unattended.
  return risk === "LOW";
}
