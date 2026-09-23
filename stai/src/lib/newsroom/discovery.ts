/**
 * One discovery run, end to end.
 *
 * Fetch the sources that are due, normalise what comes back, drop what we
 * have already seen, cluster the rest into stories, run the gates, rank the
 * survivors and mark the top N as "would have gone to research".
 *
 * Nothing after that. No research, no evidence pack, no draft, no article,
 * no publication. Phase 2's entire output is a list a human looks at.
 *
 * ── Idempotency ─────────────────────────────────────────────────────────
 * Cron fires, workers retry, and an operator presses the manual button twice.
 * Three mechanisms make that safe, and they are the reason this can run every
 * thirty minutes without accumulating junk:
 *
 *   · `newsroom_pipeline_runs.idempotency_key` is unique per (workflow, hour
 *     bucket), so a duplicate run within the same bucket reuses the row;
 *   · ingestion keys on the canonical URL, so re-reading a feed that still
 *     lists the same twenty entries inserts nothing;
 *   · clustering looks the item up by canonical URL first, so an item that
 *     somehow arrives twice joins its existing story rather than forking one.
 *
 * ── Everything is auditable ─────────────────────────────────────────────
 * Every fetch attempt, including every skip and why, lands in
 * `newsroom_fetch_log`. Every story state change lands in
 * `newsroom_pipeline_events` through `moveStory`. A run that found nothing and
 * a run that never happened look different in the record.
 */

import { sql } from "../sql";
import { limit } from "../site-config";
import { fetchSource, shouldFetch, FAILURE_OUTCOMES, type FetchOutcome } from "./fetcher.ts";
import { normaliseItem } from "./normalise.ts";
import {
  buildCandidates,
  clusterTitle,
  findCluster,
  WINDOW_DAYS,
  type ClusterCandidate,
  type MemberRow,
  type StoryRow,
} from "./cluster.ts";
import { applyCap, firstFailure, gatesPassed, runGates, scoreStory, type Candidate, type GateResult } from "./relevance.ts";
import { allSources, type Story } from "./store.ts";
import type { Source } from "./sources.ts";
import { dayKey, idempotencyKey } from "./run-keys.ts";

export type SourceRunSummary = {
  sourceId: number;
  name: string;
  tier: number;
  outcome: FetchOutcome;
  httpStatus?: number;
  error: string;
  itemsFound: number;
  itemsNew: number;
};

export type DiscoveryResult = {
  runId: number;
  startedAt: string;
  sources: SourceRunSummary[];
  itemsIngested: number;
  itemsRevised: number;
  storiesCreated: number;
  storiesUpdated: number;
  evaluated: number;
  qualified: number;
  selected: number;
  cap: number;
};

// Re-exported so callers of the orchestrator have one import; they live in
// run-keys.ts, which pulls in no database and is therefore directly testable.
export { dayKey, idempotencyKey };

async function openRun(workflow: string, at = new Date()): Promise<number> {
  const key = idempotencyKey(workflow, at);
  await sql().run(
    `INSERT INTO newsroom_pipeline_runs (workflow, idempotency_key, status)
     VALUES (?, ?, 'running')
     ON CONFLICT(idempotency_key) DO NOTHING`,
    [workflow, key]
  );
  const row = await sql().first<{ id: number }>(
    "SELECT id FROM newsroom_pipeline_runs WHERE idempotency_key=?",
    [key]
  );
  return row?.id ?? 0;
}

async function closeRun(runId: number, status: "succeeded" | "failed", error = ""): Promise<void> {
  await sql().run(
    `UPDATE newsroom_pipeline_runs
       SET status=?, finished_at=strftime('%Y-%m-%dT%H:%M:%fZ','now'), error=?
     WHERE id=?`,
    [status, error, runId]
  );
}

async function logFetch(input: {
  runId: number;
  sourceId: number;
  outcome: FetchOutcome;
  httpStatus?: number;
  error: string;
  itemsFound: number;
  itemsNew: number;
  durationMs: number;
}): Promise<void> {
  await sql().run(
    `INSERT INTO newsroom_fetch_log
       (source_id, run_id, duration_ms, outcome, http_status, error, items_found, items_new)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.sourceId,
      input.runId || null,
      input.durationMs,
      input.outcome,
      input.httpStatus ?? null,
      input.error.slice(0, 500),
      input.itemsFound,
      input.itemsNew,
    ]
  );
}

/**
 * Record what happened to a source.
 *
 * `consecutive_failures` only counts real failures. A skip is not a failure —
 * a source that is not due has not failed at anything — and counting skips
 * would mark every healthy source as broken within a day.
 */
async function recordSourceAttempt(input: {
  sourceId: number;
  outcome: FetchOutcome;
  httpStatus?: number;
  error: string;
  itemsFound: number;
  itemsNew: number;
  etag?: string;
  lastModified?: string;
  attempted: boolean;
}): Promise<void> {
  if (!input.attempted) {
    // Skips are logged in newsroom_fetch_log but must not disturb the
    // source's own health record, or "not due yet" would look like an outage.
    return;
  }

  const succeeded = input.outcome === "ok" || input.outcome === "not_modified" || input.outcome === "empty_feed";
  const failed = FAILURE_OUTCOMES.includes(input.outcome);

  await sql().run(
    `UPDATE newsroom_sources SET
       last_attempt_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'),
       last_outcome = ?,
       last_http_status = ?,
       last_error = ?,
       last_items_found = ?,
       last_items_new = ?,
       etag = ?,
       last_modified_header = ?,
       last_success_at = CASE WHEN ? = 1 THEN strftime('%Y-%m-%dT%H:%M:%fZ','now') ELSE last_success_at END,
       consecutive_failures = CASE WHEN ? = 1 THEN consecutive_failures + 1 WHEN ? = 1 THEN 0 ELSE consecutive_failures END,
       updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
     WHERE id = ?`,
    [
      input.outcome,
      input.httpStatus ?? null,
      input.error.slice(0, 500),
      input.itemsFound,
      input.itemsNew,
      input.etag ?? "",
      input.lastModified ?? "",
      succeeded ? 1 : 0,
      failed ? 1 : 0,
      succeeded ? 1 : 0,
      input.sourceId,
    ]
  );
}

/* ── Ingestion ─────────────────────────────────────────────────────────── */

type IngestedItem = {
  id: number;
  sourceId: number;
  tier: number;
  url: string;
  title: string;
  lead: string;
  publishedAt: string | null;
  jurisdictions: string[];
};

/**
 * Store what one source returned, against what is already held.
 *
 * The canonical URL is identity — it answers both "did this source re-serve
 * the same entry", which happens on every poll, and "did two registered
 * sources syndicate one press release", which happens whenever the Commission
 * publishes something. One lookup settles both.
 *
 * The content hash then answers a different question: did the document at
 * that address CHANGE. That is a revision, not a duplicate, and it is treated
 * as one — see below for why a regulation desk cannot afford to drop it.
 */
async function ingest(
  source: Source,
  items: {
    url: string;
    title: string;
    lead: string;
    publishedAt: string | null;
    documentUrl?: string;
    category?: string;
  }[]
): Promise<{ fresh: IngestedItem[]; revised: number[] }> {
  const stored: IngestedItem[] = [];
  const revisions: number[] = [];

  for (const raw of items) {
    const item = await normaliseItem(raw, source);
    if (!item) continue;

    // Identity first. The canonical URL is the document; everything that
    // matters about "have we seen this" is answered here, including the case
    // where two registered sources syndicate the same press release.
    const held = await sql().first<{ id: number; content_hash: string }>(
      "SELECT id, content_hash FROM newsroom_source_items WHERE url_hash=?",
      [item.urlHash]
    );

    if (held) {
      if (held.content_hash === item.contentHash) continue;

      // Same address, different content: the entry was REVISED. For a
      // regulation desk that is not noise — a corrected effective date is
      // often the most consequential edit a regulator makes, and dropping it
      // because the URL is familiar would hide exactly the change worth
      // knowing about.
      //
      // The stored row is updated rather than duplicated, so the story keeps
      // one member per document, and `revised_at` marks that it moved.
      await sql().run(
        `UPDATE newsroom_source_items
           SET title=?, lead=?, published_at=?, content_hash=?, jurisdictions=?,
               document_url=?, category=?,
               revised_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
         WHERE id=?`,
        [
          item.title,
          item.lead,
          item.publishedAt,
          item.contentHash,
          JSON.stringify(item.jurisdictions),
          item.documentUrl,
          item.category,
          held.id,
        ]
      );
      revisions.push(held.id);
      continue;
    }

    const info = await sql().run(
      `INSERT INTO newsroom_source_items
         (source_id, url, canonical_url, title, lead, published_at, content_hash,
          url_hash, jurisdictions, document_url, category, language, processing_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'en', 'new')`,
      [
        source.id,
        item.url,
        item.url,
        item.title,
        item.lead,
        item.publishedAt,
        item.contentHash,
        item.urlHash,
        JSON.stringify(item.jurisdictions),
        item.documentUrl,
        item.category,
      ]
    );

    stored.push({
      id: info.lastRowId,
      sourceId: source.id,
      tier: source.authority_tier,
      url: item.url,
      title: item.title,
      lead: item.lead,
      publishedAt: item.publishedAt,
      jurisdictions: item.jurisdictions,
    });
  }

  return { fresh: stored, revised: revisions };
}

/* ── Clustering ────────────────────────────────────────────────────────── */

/** Stories still open to new members, with the text needed to match against. */
async function openClusters(): Promise<ClusterCandidate[]> {
  const cutoff = new Date(Date.now() - WINDOW_DAYS * 86_400_000).toISOString();
  const stories = await sql().all<StoryRow>(
    `SELECT id, canonical_title, last_seen_at FROM newsroom_stories
      WHERE last_seen_at >= ? AND duplicate_of IS NULL
      ORDER BY last_seen_at DESC LIMIT 400`,
    [cutoff]
  );
  if (stories.length === 0) return [];

  const ids = stories.map((s) => s.id);
  const placeholders = ids.map(() => "?").join(",");
  // Oldest first — buildCandidates takes the first row it sees per story as
  // that story's representative, so this ORDER BY is load-bearing.
  const members = await sql().all<MemberRow>(
    `SELECT ss.story_id, i.canonical_url, i.title, i.lead, i.published_at, i.retrieved_at
       FROM newsroom_story_sources ss
       JOIN newsroom_source_items i ON i.id = ss.source_item_id
      WHERE ss.story_id IN (${placeholders})
      ORDER BY COALESCE(i.published_at, i.retrieved_at) ASC`,
    ids
  );

  return buildCandidates(stories, members);
}

async function attachToStory(storyId: number, item: IngestedItem, relationship: string): Promise<void> {
  await sql().run(
    `INSERT INTO newsroom_story_sources (story_id, source_item_id, relationship)
     VALUES (?, ?, ?) ON CONFLICT(story_id, source_item_id) DO NOTHING`,
    [storyId, item.id, relationship]
  );
  await sql().run("UPDATE newsroom_source_items SET clustered_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?", [
    item.id,
  ]);
}

/** Recount a story's tiers and jurisdictions from its members. */
async function refreshStoryCounts(storyId: number): Promise<void> {
  const rows = await sql().all<{ tier: number; jurisdictions: string; source_type: string }>(
    `SELECT s.authority_tier AS tier, i.jurisdictions, s.source_type
       FROM newsroom_story_sources ss
       JOIN newsroom_source_items i ON i.id = ss.source_item_id
       JOIN newsroom_sources s ON s.id = i.source_id
      WHERE ss.story_id = ?`,
    [storyId]
  );

  const tier1 = rows.filter((r) => r.tier === 1).length;
  const tier2 = rows.filter((r) => r.tier === 2).length;
  const tier3 = rows.filter((r) => r.tier === 3).length;

  // A "primary source" is a Tier-1 source that issues the thing — a regulator
  // or a standard setter. A Tier-1 vendor release note is authoritative about
  // its own product and not about a rule, so it does not count here.
  const primary = rows.filter(
    (r) => r.tier === 1 && (r.source_type === "regulator" || r.source_type === "standard_setter")
  ).length;

  const jurisdictions = new Set<string>();
  for (const r of rows) {
    try {
      for (const j of JSON.parse(r.jurisdictions) as string[]) jurisdictions.add(String(j));
    } catch {
      /* a malformed row must not stop the recount */
    }
  }
  // GLOBAL is exclusive: once a specific market is named, the story is about
  // that market and mentions a global instrument.
  if (jurisdictions.size > 1) jurisdictions.delete("GLOBAL");

  await sql().run(
    `UPDATE newsroom_stories SET
       tier1_source_count=?, tier2_source_count=?, tier3_source_count=?,
       primary_source_count=?, source_count=?, jurisdictions=?,
       last_seen_at=strftime('%Y-%m-%dT%H:%M:%fZ','now'),
       updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
     WHERE id=?`,
    [
      tier1,
      tier2,
      tier3,
      primary,
      rows.length,
      JSON.stringify([...jurisdictions]),
      storyId,
    ]
  );
}

/* ── Evaluation ────────────────────────────────────────────────────────── */

/** Titles of published STAI articles, for the "already covered" gate. */
async function publishedTitles(): Promise<string[]> {
  const rows = await sql().all<{ title: string }>(
    "SELECT title FROM articles WHERE status='published' ORDER BY id DESC LIMIT 300"
  );
  return rows.map((r) => r.title);
}

type EvaluatedStory = { story: Story; gates: GateResult[]; score: number; reasons: string[] };

async function evaluate(stories: Story[], covered: string[], now: number): Promise<EvaluatedStory[]> {
  const out: EvaluatedStory[] = [];

  for (const story of stories) {
    // Both ends of the story, because they answer different questions. The
    // oldest member is when the development broke and supplies the lead the
    // gates read; the newest is when it last moved, which is what freshness
    // and recency mean for a living story. The first production run used the
    // oldest for both and rejected a four-day-old development as 47 days old.
    const earliest = await sql().first<{ published_at: string | null; lead: string }>(
      `SELECT i.published_at, i.lead
         FROM newsroom_story_sources ss
         JOIN newsroom_source_items i ON i.id = ss.source_item_id
        WHERE ss.story_id = ?
        ORDER BY COALESCE(i.published_at, i.retrieved_at) ASC LIMIT 1`,
      [story.id]
    );
    const newest = await sql().first<{ published_at: string | null }>(
      `SELECT i.published_at
         FROM newsroom_story_sources ss
         JOIN newsroom_source_items i ON i.id = ss.source_item_id
        WHERE ss.story_id = ?
        ORDER BY COALESCE(i.published_at, i.retrieved_at) DESC LIMIT 1`,
      [story.id]
    );

    const facts = {
      title: story.canonical_title,
      lead: earliest?.lead ?? "",
      jurisdictions: story.jurisdictions,
      tier1Count: story.tier1_source_count,
      tier2Count: story.tier2_source_count,
      tier3Count: story.tier3_source_count,
      sourceCount: story.source_count,
      firstSeenAt: story.first_seen_at,
      publishedAt: earliest?.published_at ?? null,
      latestPublishedAt: newest?.published_at ?? null,
      publishedTitles: covered,
      escalated: !!story.escalated_by,
    };

    const gates = runGates(facts, now);
    const { score, reasons } = scoreStory(facts, now);
    out.push({ story, gates, score, reasons });
  }

  return out;
}

/* ── The run ───────────────────────────────────────────────────────────── */

export type DiscoveryOptions = {
  /** Ignore the per-source cadence. Never ignores permission. */
  force?: boolean;
  /** Injected for tests; defaults to global fetch. */
  fetch?: typeof globalThis.fetch;
  now?: number;
};

export async function runDiscovery(options: DiscoveryOptions = {}): Promise<DiscoveryResult> {
  const now = options.now ?? Date.now();
  const at = new Date(now);
  const runId = await openRun("discovery", at);
  const startedAt = at.toISOString();

  const summaries: SourceRunSummary[] = [];
  let itemsIngested = 0;
  let itemsRevised = 0;
  let storiesCreated = 0;
  let storiesUpdated = 0;

  try {
    const sources = await allSources();

    for (const source of sources) {
      const decision = shouldFetch(source, now, options.force);

      if (!decision.due) {
        await logFetch({
          runId,
          sourceId: source.id,
          outcome: decision.outcome,
          error: decision.reason,
          itemsFound: 0,
          itemsNew: 0,
          durationMs: 0,
        });
        summaries.push({
          sourceId: source.id,
          name: source.name,
          tier: source.authority_tier,
          outcome: decision.outcome,
          error: decision.reason,
          itemsFound: 0,
          itemsNew: 0,
        });
        continue;
      }

      const result = await fetchSource(source, { fetch: options.fetch });
      const ingested =
        result.outcome === "ok"
          ? await ingest(source, result.items)
          : { fresh: [], revised: [] };
      const fresh = ingested.fresh;
      itemsIngested += fresh.length;
      itemsRevised += ingested.revised.length;

      // A revised document keeps its story; what changes is that the story
      // moved. Recording it here means the Inbox can say so rather than
      // showing an unchanged row at its original date.
      for (const itemId of ingested.revised) {
        const owner = await sql().first<{ story_id: number }>(
          "SELECT story_id FROM newsroom_story_sources WHERE source_item_id=?",
          [itemId]
        );
        if (!owner) continue;
        await sql().run(
          `UPDATE newsroom_stories
             SET update_count = update_count + 1,
                 last_source_added_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'),
                 last_seen_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
           WHERE id = ?`,
          [owner.story_id]
        );
        await sql().run(
          `INSERT INTO newsroom_pipeline_events (story_id, run_id, from_state, to_state, actor, reason)
           SELECT id, ?, state, state, 'engine', ? FROM newsroom_stories WHERE id = ?`,
          [runId || null, `source revised at ${source.name}`, owner.story_id]
        );
      }

      await recordSourceAttempt({
        sourceId: source.id,
        outcome: result.outcome,
        httpStatus: result.httpStatus,
        error: result.error,
        itemsFound: result.items.length,
        itemsNew: fresh.length,
        etag: result.etag,
        lastModified: result.lastModified,
        attempted: true,
      });

      await logFetch({
        runId,
        sourceId: source.id,
        outcome: result.outcome,
        httpStatus: result.httpStatus,
        error: result.error,
        itemsFound: result.items.length,
        itemsNew: fresh.length,
        durationMs: result.durationMs,
      });

      summaries.push({
        sourceId: source.id,
        name: source.name,
        tier: source.authority_tier,
        outcome: result.outcome,
        httpStatus: result.httpStatus,
        error: result.error,
        itemsFound: result.items.length,
        itemsNew: fresh.length,
      });

      // Cluster as we go, so an item from a later source can join a story a
      // earlier source in this same run created.
      for (const item of fresh) {
        const candidates = await openClusters();
        const match = findCluster(
          { url: item.url, title: item.title, lead: item.lead, publishedAt: item.publishedAt },
          candidates,
          now
        );

        if (match) {
          await attachToStory(match.storyId, item, item.tier === 1 ? "primary_text" : "corroborating");
          await refreshStoryCounts(match.storyId);
          await sql().run(
            `UPDATE newsroom_stories
               SET update_count = update_count + 1,
                   last_source_added_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
             WHERE id = ?`,
            [match.storyId]
          );
          await sql().run(
            `INSERT INTO newsroom_pipeline_events (story_id, run_id, from_state, to_state, actor, reason)
             SELECT id, ?, state, state, 'engine', ? FROM newsroom_stories WHERE id = ?`,
            [runId || null, `source joined: ${match.reason}`.slice(0, 400), match.storyId]
          );
          storiesUpdated++;
        } else {
          const info = await sql().run(
            `INSERT INTO newsroom_stories
               (canonical_title, topic, jurisdictions, state, risk_class)
             VALUES (?, '', ?, 'DISCOVERED', 'MEDIUM')`,
            [
              clusterTitle([{ title: item.title, tier: item.tier, seenAt: startedAt }]),
              JSON.stringify(item.jurisdictions),
            ]
          );
          await attachToStory(info.lastRowId, item, "originating");
          await refreshStoryCounts(info.lastRowId);
          await sql().run(
            `INSERT INTO newsroom_pipeline_events (story_id, run_id, from_state, to_state, actor, reason)
             VALUES (?, ?, NULL, 'DISCOVERED', 'engine', ?)`,
            [info.lastRowId, runId || null, `new story from ${source.name}`]
          );
          storiesCreated++;
        }
      }
    }

    /* ── Evaluate everything still open ───────────────────────────────── */

    const cutoff = new Date(now - WINDOW_DAYS * 86_400_000).toISOString();
    const open = await sql().all<Record<string, unknown>>(
      `SELECT * FROM newsroom_stories
        WHERE state IN ('DISCOVERED','REJECTED') AND last_seen_at >= ? AND duplicate_of IS NULL
        ORDER BY last_seen_at DESC LIMIT 300`,
      [cutoff]
    );

    const stories = open.map((r) => ({
      ...(r as unknown as Story),
      jurisdictions: (() => {
        try {
          const v = JSON.parse(String(r.jurisdictions ?? "[]"));
          return Array.isArray(v) ? v.map(String) : [];
        } catch {
          return [];
        }
      })(),
    })) as Story[];

    const covered = await publishedTitles();
    const evaluated = await evaluate(stories, covered, now);

    const qualifying: Candidate[] = [];
    for (const e of evaluated) {
      const passed = gatesPassed(e.gates);
      const failure = firstFailure(e.gates);

      await sql().run(
        `UPDATE newsroom_stories SET
           gate_results=?, rejected_reason=?, relevance_score=?, relevance_reason=?,
           updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
         WHERE id=?`,
        [
          JSON.stringify(e.gates),
          passed ? "" : `${failure?.label}: ${failure?.detail}`.slice(0, 400),
          passed ? e.score : null,
          passed ? e.reasons.join("; ").slice(0, 600) : "",
          e.story.id,
        ]
      );

      if (passed) {
        qualifying.push({ storyId: e.story.id, score: e.score, gates: e.gates, reasons: e.reasons });
      }
    }

    /* ── Apply the cap ────────────────────────────────────────────────── */

    const cap = await limit("newsroom.research_cap_per_day");
    const selections = applyCap(qualifying, cap);
    const today = dayKey(at);

    for (const s of selections) {
      await sql().run(
        `UPDATE newsroom_stories SET would_research=?, selection_rank=?, selected_on=?
         WHERE id=?`,
        [s.selected ? 1 : 0, s.rank, today, s.storyId]
      );
    }

    // Stories that failed a gate are not candidates and must not keep a stale
    // selection from a previous run, when they might have qualified.
    const disqualified = evaluated.filter((e) => !gatesPassed(e.gates)).map((e) => e.story.id);
    for (const id of disqualified) {
      await sql().run(
        "UPDATE newsroom_stories SET would_research=0, selection_rank=NULL WHERE id=?",
        [id]
      );
    }

    await closeRun(runId, "succeeded");

    return {
      runId,
      startedAt,
      sources: summaries,
      itemsIngested,
      itemsRevised,
      storiesCreated,
      storiesUpdated,
      evaluated: evaluated.length,
      qualified: qualifying.length,
      selected: selections.filter((s) => s.selected).length,
      cap,
    };
  } catch (e) {
    await closeRun(runId, "failed", e instanceof Error ? e.message : String(e));
    throw e;
  }
}
