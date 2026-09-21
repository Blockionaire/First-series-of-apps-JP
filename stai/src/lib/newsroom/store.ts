/**
 * Reads and writes for the newsroom tables.
 *
 * Every query lives here rather than in a page, for the same reason
 * lib/content.ts owns the article queries: the rule that a draft is never
 * public is a property of the data layer, not a convention six pages have to
 * remember. The equivalent rule here is that a state change is never a bare
 * UPDATE — it goes through `moveStory`, which validates the transition and
 * records the event.
 *
 * D1 accepts positional `?` parameters only. Named parameters are not
 * expressible, so the order of every parameter list is load-bearing.
 */

import { sql } from "../sql";
import { parseJurisdictions } from "./jurisdictions.ts";
import {
  IN_FLIGHT_STATES,
  STORY_STATES,
  STUCK_AFTER_MINUTES,
  isStoryState,
  transition,
  type Actor,
  type StoryState,
} from "./state.ts";
import {
  DEFAULT_FREQUENCY,
  sourceHealth,
  type Health,
  type IngestionMethod,
  type Retention,
  type Source,
  type SourceType,
  type Tier,
} from "./sources.ts";

// ─── Sources ──────────────────────────────────────────────────────────────

type SourceRow = Omit<Source, "jurisdictions" | "topics" | "fetch_allowed" | "active"> & {
  jurisdictions: string;
  topics: string;
  fetch_allowed: number;
  active: number;
};

function rowToSource(r: SourceRow): Source {
  return {
    ...r,
    authority_tier: r.authority_tier as Tier,
    source_type: r.source_type as SourceType,
    ingestion_method: r.ingestion_method as IngestionMethod,
    snapshot_retention: r.snapshot_retention as Retention,
    jurisdictions: parseJurisdictions(r.jurisdictions),
    topics: safeArray(r.topics),
    fetch_allowed: !!r.fetch_allowed,
    active: !!r.active,
  };
}

/** One bad row must degrade to an empty list, never take down the page. */
function safeArray(raw: string): string[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export async function allSources(): Promise<Source[]> {
  const rows = await sql().all<SourceRow>(
    "SELECT * FROM newsroom_sources ORDER BY authority_tier ASC, name ASC"
  );
  return rows.map(rowToSource);
}

export async function sourceById(id: number): Promise<Source | null> {
  const r = await sql().first<SourceRow>("SELECT * FROM newsroom_sources WHERE id=?", [id]);
  return r ? rowToSource(r) : null;
}

export type SourceWithHealth = Source & { health: Health };

export async function sourcesWithHealth(): Promise<SourceWithHealth[]> {
  const sources = await allSources();
  const now = Date.now();
  return sources.map((s) => ({
    ...s,
    // An inactive source is not unhealthy, it is switched off. Reporting a
    // dormant seeded row as "never fetched" would bury the two genuinely
    // broken feeds under forty-eight that are simply not on yet.
    health: s.active ? sourceHealth(s, now) : { state: "ok" as const, detail: "" },
  }));
}

export type SourceCreate = {
  name: string;
  domain: string;
  source_type: string;
  authority_tier: number;
  jurisdictions: string[];
  topics: string[];
  ingestion_method: string;
  feed_url: string;
  fetch_frequency: number;
  fetch_allowed: boolean;
  license_notes: string;
  snapshot_retention: string;
};

/**
 * Register a source. Always inactive.
 *
 * There is deliberately no `active` parameter. A row becomes active through
 * `setSourceActive`, which is a separate, recorded act — see masterplan
 * decision D5. Insert and activate being one call is precisely how a seed file
 * turns into a live crawl nobody reviewed.
 */
export async function createSource(input: SourceCreate): Promise<number> {
  const info = await sql().run(
    `INSERT INTO newsroom_sources
       (name, domain, source_type, authority_tier, jurisdictions, topics,
        ingestion_method, feed_url, fetch_frequency, fetch_allowed,
        license_notes, snapshot_retention, active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
    [
      input.name,
      input.domain,
      input.source_type,
      input.authority_tier,
      JSON.stringify(input.jurisdictions),
      JSON.stringify(input.topics),
      input.ingestion_method,
      input.feed_url,
      input.fetch_frequency,
      input.fetch_allowed ? 1 : 0,
      input.license_notes,
      input.snapshot_retention,
    ]
  );
  return info.lastRowId;
}

/** Activate or deactivate one source, recording who did it and when. */
export async function setSourceActive(id: number, active: boolean, actor: string): Promise<void> {
  await sql().run(
    `UPDATE newsroom_sources
       SET active=?, activated_at=?, activated_by=?,
           updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
     WHERE id=?`,
    [
      active ? 1 : 0,
      active ? new Date().toISOString() : null,
      active ? actor : null,
      id,
    ]
  );
}

export async function setSourceFetchAllowed(id: number, allowed: boolean): Promise<void> {
  await sql().run(
    `UPDATE newsroom_sources SET fetch_allowed=?,
       updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?`,
    [allowed ? 1 : 0, id]
  );
}

export type SourceSummary = {
  total: number;
  active: number;
  byTier: Record<Tier, { total: number; active: number }>;
  needingAttention: SourceWithHealth[];
};

export async function sourceSummary(): Promise<SourceSummary> {
  const sources = await sourcesWithHealth();
  const byTier = {
    1: { total: 0, active: 0 },
    2: { total: 0, active: 0 },
    3: { total: 0, active: 0 },
  } as Record<Tier, { total: number; active: number }>;

  for (const s of sources) {
    const t = byTier[s.authority_tier];
    if (!t) continue;
    t.total++;
    if (s.active) t.active++;
  }

  return {
    total: sources.length,
    active: sources.filter((s) => s.active).length,
    byTier,
    needingAttention: sources.filter((s) => s.active && s.health.state !== "ok"),
  };
}

// ─── Stories ──────────────────────────────────────────────────────────────

export type Story = {
  id: number;
  canonical_title: string;
  topic: string;
  jurisdictions: string[];
  state: StoryState;
  state_entered_at: string;
  risk_class: string;
  relevance_score: number | null;
  relevance_reason: string;
  tier1_source_count: number;
  tier2_source_count: number;
  tier3_source_count: number;
  primary_source_count: number;
  source_count: number;
  escalated_by: string | null;
  escalated_reason: string | null;
  article_id: number | null;
  first_seen_at: string;
  last_seen_at: string;
};

type StoryRow = Omit<Story, "jurisdictions" | "state"> & { jurisdictions: string; state: string };

function rowToStory(r: StoryRow): Story {
  return {
    ...r,
    jurisdictions: parseJurisdictions(r.jurisdictions),
    // A row carrying an unrecognised state is a bug, not a new state. Showing
    // it as DISCOVERED would hide it in the busiest column on the page, so it
    // keeps its value and the UI renders it as-is.
    state: (isStoryState(r.state) ? r.state : r.state) as StoryState,
  };
}

/** How many stories sit in each state. The Inbox's headline row. */
export async function stateCounts(): Promise<Record<StoryState, number>> {
  const rows = await sql().all<{ state: string; n: number }>(
    "SELECT state, COUNT(*) n FROM newsroom_stories GROUP BY state"
  );
  const counts = Object.fromEntries(STORY_STATES.map((s) => [s, 0])) as Record<StoryState, number>;
  for (const r of rows) {
    if (isStoryState(r.state)) counts[r.state] = r.n;
  }
  return counts;
}

export async function storiesInState(state: StoryState, limit = 50): Promise<Story[]> {
  const rows = await sql().all<StoryRow>(
    "SELECT * FROM newsroom_stories WHERE state=? ORDER BY state_entered_at DESC LIMIT ?",
    [state, limit]
  );
  return rows.map(rowToStory);
}

export async function recentStories(limit = 50): Promise<Story[]> {
  const rows = await sql().all<StoryRow>(
    "SELECT * FROM newsroom_stories ORDER BY last_seen_at DESC LIMIT ?",
    [limit]
  );
  return rows.map(rowToStory);
}

export async function storyById(id: number): Promise<Story | null> {
  const r = await sql().first<StoryRow>("SELECT * FROM newsroom_stories WHERE id=?", [id]);
  return r ? rowToStory(r) : null;
}

/**
 * Stories that have been mid-flight too long.
 *
 * The failure this surfaces is a workflow that died between steps. Nothing
 * errors — the story simply stops, in a state no human is watching, and is
 * never seen again. A story whose last transition is old is the only evidence
 * that happened, so the Inbox asks for it explicitly.
 */
export async function stuckStories(now = Date.now()): Promise<Story[]> {
  const cutoff = new Date(now - STUCK_AFTER_MINUTES * 60_000).toISOString();
  const placeholders = IN_FLIGHT_STATES.map(() => "?").join(",");
  const rows = await sql().all<StoryRow>(
    `SELECT * FROM newsroom_stories
      WHERE state IN (${placeholders}) AND state_entered_at < ?
      ORDER BY state_entered_at ASC`,
    [...IN_FLIGHT_STATES, cutoff]
  );
  return rows.map(rowToStory);
}

export type MoveResult = { ok: true } | { ok: false; error: string };

/**
 * The only way a story changes state.
 *
 * Validates the transition, writes the new state and records the event in one
 * place. The event is not optional and not a separate call a caller might
 * forget: an unrecorded transition is how a story's history develops a hole,
 * and the history is the thing this platform sells.
 *
 * Returns rather than throws. A retried workflow step will often try to move a
 * story that has already moved, and that has to read as "already done" rather
 * than as a crash.
 */
export async function moveStory(input: {
  storyId: number;
  to: StoryState;
  actor: Actor;
  actorRef?: string;
  reason?: string;
  runId?: number | null;
}): Promise<MoveResult> {
  const story = await storyById(input.storyId);
  if (!story) return { ok: false, error: `No story ${input.storyId}` };

  const check = transition(story.state, input.to);
  if (!check.ok) return { ok: false, error: check.error };

  await sql().run(
    `UPDATE newsroom_stories
       SET state=?, state_entered_at=strftime('%Y-%m-%dT%H:%M:%fZ','now'),
           updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
     WHERE id=?`,
    [input.to, input.storyId]
  );

  await sql().run(
    `INSERT INTO newsroom_pipeline_events
       (story_id, run_id, from_state, to_state, actor, actor_ref, reason)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      input.storyId,
      input.runId ?? null,
      check.from,
      check.to,
      input.actor,
      input.actorRef ?? "",
      input.reason ?? "",
    ]
  );

  return { ok: true };
}

export type PipelineEvent = {
  id: number;
  story_id: number;
  from_state: string | null;
  to_state: string;
  actor: string;
  actor_ref: string;
  reason: string;
  created_at: string;
};

export async function storyHistory(storyId: number, limit = 100): Promise<PipelineEvent[]> {
  return sql().all<PipelineEvent>(
    `SELECT id, story_id, from_state, to_state, actor, actor_ref, reason, created_at
       FROM newsroom_pipeline_events WHERE story_id=? ORDER BY id DESC LIMIT ?`,
    [storyId, limit]
  );
}

// ─── Spend ────────────────────────────────────────────────────────────────

/** `YYYY-MM` for the month containing `d`, in UTC. The ledger's period key. */
export function spendPeriod(d = new Date()): string {
  return d.toISOString().slice(0, 7);
}

export async function monthSpendCents(period = spendPeriod()): Promise<number> {
  const row = await sql().first<{ total: number | null }>(
    "SELECT SUM(cost_cents) total FROM newsroom_ai_spend WHERE period=?",
    [period]
  );
  return row?.total ?? 0;
}

export async function spendByStage(period = spendPeriod()): Promise<{ stage: string; cents: number }[]> {
  return sql().all<{ stage: string; cents: number }>(
    `SELECT stage, SUM(cost_cents) cents FROM newsroom_ai_spend
      WHERE period=? GROUP BY stage ORDER BY cents DESC`,
    [period]
  );
}

// ─── Editorial decisions ──────────────────────────────────────────────────

/**
 * Record what a human decided.
 *
 * Called on every review outcome from the very first one. After roughly fifty
 * rows this is a regression set — the same evidence packs, the draft, and what
 * the editor actually published — and a prompt change becomes measurable
 * instead of a matter of opinion. The labels cannot be reconstructed later,
 * which is why this exists in phase 1 and not with the eval harness in phase 5.
 */
export async function recordDecision(input: {
  storyId: number;
  draftId?: number | null;
  decision: "approve" | "approve_with_edits" | "reject" | "request_research" | "escalate";
  reason?: string;
  editedBodyMd?: string | null;
  reviewer: string;
  reviewSeconds?: number | null;
}): Promise<void> {
  await sql().run(
    `INSERT INTO newsroom_editorial_decisions
       (story_id, draft_id, decision, reason, edited_body_md, reviewer, review_seconds)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      input.storyId,
      input.draftId ?? null,
      input.decision,
      input.reason ?? "",
      input.editedBodyMd ?? null,
      input.reviewer,
      input.reviewSeconds ?? null,
    ]
  );
}

export async function decisionCount(): Promise<number> {
  const row = await sql().first<{ n: number }>(
    "SELECT COUNT(*) n FROM newsroom_editorial_decisions"
  );
  return row?.n ?? 0;
}

/** Default cadence for a tier, re-exported so admin forms have one source. */
export { DEFAULT_FREQUENCY };

// ─── Discovery (phase 2) ──────────────────────────────────────────────────

export type FetchLogRow = {
  id: number;
  source_id: number;
  run_id: number | null;
  started_at: string;
  duration_ms: number | null;
  outcome: string;
  http_status: number | null;
  error: string;
  items_found: number;
  items_new: number;
};

/** The most recent attempt against each source, for the health panel. */
export async function recentFetches(limitRows = 60): Promise<FetchLogRow[]> {
  return sql().all<FetchLogRow>(
    "SELECT * FROM newsroom_fetch_log ORDER BY id DESC LIMIT ?",
    [limitRows]
  );
}

export async function fetchesForSource(sourceId: number, limitRows = 20): Promise<FetchLogRow[]> {
  return sql().all<FetchLogRow>(
    "SELECT * FROM newsroom_fetch_log WHERE source_id=? ORDER BY id DESC LIMIT ?",
    [sourceId, limitRows]
  );
}

export type DiscoveryRun = {
  id: number;
  workflow: string;
  idempotency_key: string;
  status: string;
  started_at: string;
  finished_at: string | null;
  error: string | null;
};

export async function recentRuns(limitRows = 12): Promise<DiscoveryRun[]> {
  return sql().all<DiscoveryRun>(
    "SELECT id, workflow, idempotency_key, status, started_at, finished_at, error FROM newsroom_pipeline_runs ORDER BY id DESC LIMIT ?",
    [limitRows]
  );
}

/** One member of a story, as the Inbox shows it. */
export type StoryMember = {
  item_id: number;
  source_id: number;
  source_name: string;
  tier: number;
  source_type: string;
  canonical_url: string;
  title: string;
  lead: string;
  published_at: string | null;
  retrieved_at: string;
  relationship: string;
};

export async function storyMembers(storyId: number): Promise<StoryMember[]> {
  return sql().all<StoryMember>(
    `SELECT i.id AS item_id, s.id AS source_id, s.name AS source_name,
            s.authority_tier AS tier, s.source_type,
            i.canonical_url, i.title, i.lead, i.published_at, i.retrieved_at,
            ss.relationship
       FROM newsroom_story_sources ss
       JOIN newsroom_source_items i ON i.id = ss.source_item_id
       JOIN newsroom_sources s ON s.id = i.source_id
      WHERE ss.story_id = ?
      ORDER BY s.authority_tier ASC, i.retrieved_at ASC`,
    [storyId]
  );
}

/** A story as the dry-run Inbox needs it: verdict, gates and provenance. */
export type Candidate = Story & {
  gate_results: string;
  rejected_reason: string;
  would_research: number;
  selection_rank: number | null;
  selected_on: string | null;
  update_count: number;
  last_source_added_at: string | null;
  duplicate_of: number | null;
  feedback_count: number;
};

type CandidateRow = Omit<Candidate, "jurisdictions" | "state"> & {
  jurisdictions: string;
  state: string;
};

function rowToCandidate(r: CandidateRow): Candidate {
  return { ...r, jurisdictions: parseJurisdictions(r.jurisdictions), state: r.state as StoryState };
}

/**
 * The dry run's output, newest first.
 *
 * Returns rejected stories alongside selected ones on purpose. A candidate
 * list showing only what passed answers half the question; the dry run exists
 * so a human can say "you were wrong to drop that", and they cannot say it
 * about something they cannot see.
 */
export async function candidates(opts: { view?: string; limit?: number } = {}): Promise<Candidate[]> {
  const n = opts.limit ?? 60;
  const where =
    opts.view === "selected"
      ? "WHERE s.would_research = 1"
      : opts.view === "qualified"
        ? "WHERE s.rejected_reason = ''"
        : opts.view === "rejected"
          ? "WHERE s.rejected_reason != ''"
          : "";

  const rows = await sql().all<CandidateRow>(
    `SELECT s.*, (SELECT COUNT(*) FROM newsroom_discovery_feedback f WHERE f.story_id = s.id) AS feedback_count
       FROM newsroom_stories s
       ${where}
       ORDER BY s.would_research DESC, s.relevance_score DESC, s.last_seen_at DESC
       LIMIT ?`,
    [n]
  );
  return rows.map(rowToCandidate);
}

export async function candidateById(id: number): Promise<Candidate | null> {
  const r = await sql().first<CandidateRow>(
    `SELECT s.*, (SELECT COUNT(*) FROM newsroom_discovery_feedback f WHERE f.story_id = s.id) AS feedback_count
       FROM newsroom_stories s WHERE s.id = ?`,
    [id]
  );
  return r ? rowToCandidate(r) : null;
}

/** Gate results, parsed, degrading to an empty list rather than throwing. */
export function parseGates(raw: string): { id: string; label: string; passed: boolean; detail: string }[] {
  try {
    const v = JSON.parse(raw || "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

// ─── Discovery feedback: the dry run's labelled output ────────────────────

export const FEEDBACK_VERDICTS = ["good", "not_relevant", "duplicate", "wrong_jurisdiction"] as const;
export type FeedbackVerdict = (typeof FEEDBACK_VERDICTS)[number];

export function isFeedbackVerdict(v: string): v is FeedbackVerdict {
  return (FEEDBACK_VERDICTS as readonly string[]).includes(v);
}

export type Feedback = {
  id: number;
  story_id: number;
  verdict: string;
  note: string;
  reviewer: string;
  scored: number | null;
  would_research: number;
  created_at: string;
};

/**
 * Record a human's verdict on a selection.
 *
 * Append-only, and the engine's own view is frozen into the row. Re-reading
 * the story later would show its CURRENT score, and the label would then be
 * attached to a number that was never the one being judged — which would make
 * the whole set useless for tuning, quietly.
 */
export async function recordDiscoveryFeedback(input: {
  storyId: number;
  verdict: FeedbackVerdict;
  note?: string;
  reviewer: string;
}): Promise<void> {
  const story = await candidateById(input.storyId);
  await sql().run(
    `INSERT INTO newsroom_discovery_feedback
       (story_id, verdict, note, reviewer, scored, would_research, gate_results)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      input.storyId,
      input.verdict,
      (input.note ?? "").slice(0, 2000),
      input.reviewer,
      story?.relevance_score ?? null,
      story?.would_research ?? 0,
      story?.gate_results ?? "[]",
    ]
  );
}

export async function feedbackForStory(storyId: number): Promise<Feedback[]> {
  return sql().all<Feedback>(
    "SELECT * FROM newsroom_discovery_feedback WHERE story_id=? ORDER BY id DESC",
    [storyId]
  );
}

export type FeedbackTally = { verdict: string; n: number };

export async function feedbackTally(): Promise<FeedbackTally[]> {
  return sql().all<FeedbackTally>(
    "SELECT verdict, COUNT(*) n FROM newsroom_discovery_feedback GROUP BY verdict ORDER BY n DESC"
  );
}

export async function discoveryFeedbackCount(): Promise<number> {
  const row = await sql().first<{ n: number }>("SELECT COUNT(*) n FROM newsroom_discovery_feedback");
  return row?.n ?? 0;
}

/** Counts for the dry-run header. */
export async function discoverySummary(): Promise<{
  items: number;
  stories: number;
  qualified: number;
  selected: number;
  rejected: number;
  lastRunAt: string | null;
}> {
  const one = async (q: string) => (await sql().first<{ n: number }>(q))?.n ?? 0;
  const last = await sql().first<{ started_at: string }>(
    "SELECT started_at FROM newsroom_pipeline_runs WHERE workflow='discovery' ORDER BY id DESC LIMIT 1"
  );
  return {
    items: await one("SELECT COUNT(*) n FROM newsroom_source_items"),
    stories: await one("SELECT COUNT(*) n FROM newsroom_stories"),
    qualified: await one("SELECT COUNT(*) n FROM newsroom_stories WHERE rejected_reason = ''"),
    selected: await one("SELECT COUNT(*) n FROM newsroom_stories WHERE would_research = 1"),
    rejected: await one("SELECT COUNT(*) n FROM newsroom_stories WHERE rejected_reason != ''"),
    lastRunAt: last?.started_at ?? null,
  };
}

/**
 * Change a source's feed URL.
 *
 * Exists because feed URLs move, and the first one to be caught was the AFM's
 * — found by an operator clicking the link the registry now shows. Without
 * this, every such correction is a code change and a deploy, which is absurd
 * overhead for replacing one string and guarantees broken feeds sit unfixed.
 *
 * ── Editing the URL revokes retrieval permission ─────────────────────────
 * Deliberate, and the reason is the whole premise of the two-switch gate:
 * permission was granted for a SPECIFIC address, after a human checked that
 * address's robots.txt and terms. A new address has not been checked. Keeping
 * the tick would silently convert "I approved fetching this" into "I approved
 * fetching whatever this row points at next".
 *
 * `active` is left alone. Wanting a source is a judgement about the
 * publication, which a corrected URL does not change.
 */
export async function updateSourceFeedUrl(input: {
  id: number;
  feedUrl: string;
  actor: string;
}): Promise<void> {
  await sql().run(
    `UPDATE newsroom_sources SET
       feed_url = ?,
       fetch_allowed = 0,
       etag = '',
       last_modified_header = '',
       last_outcome = '',
       last_error = '',
       last_http_status = NULL,
       consecutive_failures = 0,
       updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
     WHERE id = ?`,
    [input.feedUrl, input.id]
  );

  // The conditional-GET validators and the health record belong to the OLD
  // address. Carried over, an ETag from the previous URL would make the first
  // fetch of the new one answer 304 and look healthy while returning nothing.
  await sql().run(
    `INSERT INTO newsroom_fetch_log (source_id, outcome, error, items_found, items_new)
     VALUES (?, 'skipped_not_due', ?, 0, 0)`,
    [input.id, `feed URL changed by ${input.actor} — retrieval permission reset`]
  );
}
