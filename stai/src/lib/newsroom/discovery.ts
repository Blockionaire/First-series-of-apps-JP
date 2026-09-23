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
 * ── The query budget ────────────────────────────────────────────────────
 * The first version of this file asked the database a question per item and
 * per story — about ten round trips per new item and three per open story on
 * EVERY run — so ten sources with twenty items each took over two thousand
 * queries, and a run where nothing had changed still took about a thousand
 * (CODE_AUDIT.md, H2). Workers Paid allows 1,000 per invocation; the run is
 * held to ~9–22 anyway, because a limit is not a target and a run suddenly
 * spending fifty times its usual budget is a fault to notice.
 *
 * So a run is now three steps, and the query count no longer grows with the
 * number of items:
 *
 *   1. LOAD. Everything the run could need is read up front in a fixed number
 *      of queries: the registry, which of the fetched addresses are already
 *      held, and the open stories with their members.
 *   2. REPLAY. The run's logic executes against that snapshot in memory, in
 *      the same order and with the same rules it always had: sources in
 *      registry order, items in feed order, each fresh item clustered against
 *      the stories that exist at that moment — including ones created earlier
 *      in the same run. The decisions are the old decisions; only where they
 *      are recorded changed.
 *   3. FLUSH. Every write is expressed as a handful of set-based statements
 *      (each carries its rows as one JSON parameter, unpacked by json_each)
 *      and sent as ONE batch, which D1 and the Node driver both apply as a
 *      transaction. A run is recorded completely or not at all.
 *
 * Evaluation then reads the open stories and their members in two queries,
 * and writes back only the stories whose gate results or selection actually
 * changed. tests/discovery-budget.test.mjs holds the result to that budget at
 * realistic workloads.
 *
 * ── What one run may spend ──────────────────────────────────────────────
 * Operator-configurable in site settings, and all low on purpose:
 *
 *   · `newsroom.max_sources_per_run` — due sources fetched per run, least
 *     recently attempted first; one outbound request each;
 *   · `newsroom.max_detail_fetches_per_run` — publication pages opened behind
 *     an index, shared across the run (each extractor has its own cap too);
 *   · `newsroom.max_run_seconds` — no source or page is STARTED after this.
 *
 * Anything a limit holds back is logged `skipped_budget` and stays due, so it
 * is picked up by the next run rather than lost. Outbound requests go one at a
 * time, each with a 15-second timeout and a 4 MB body limit, and none is ever
 * retried within a run: a failure is recorded against its source and the run
 * moves on. The next scheduled run is the retry.
 *
 * ── One run at a time ───────────────────────────────────────────────────
 * The run claims a lease in `newsroom_pipeline_runs` with a single statement
 * that succeeds only if no other discovery run is `running`. A second caller
 * — the cron firing during a manual run, or the button pressed twice — gets
 * `DiscoveryBusyError` and does nothing. A run whose invocation was killed
 * never records a finish; once its lease is older than the time budget plus
 * five minutes it is marked failed ("abandoned") and stops blocking.
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
 * `newsroom_fetch_log`. Every story that is created, joined or revised gets a
 * `newsroom_pipeline_events` row saying so. A run that found nothing and a run
 * that never happened look different in the record.
 */

import { sql, type SqlParam, type Statement } from "../sql";
import { limits } from "../site-config";
import { fetchSource, shouldFetch, FAILURE_OUTCOMES, type FetchOutcome, type FetchResult } from "./fetcher.ts";
import { normaliseItem, type NormalisedItem } from "./normalise.ts";
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
import { FREE_MANUAL_PROFILE, workersPlan, type WorkersPlan } from "./plan.ts";

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

const NOW_SQL = "strftime('%Y-%m-%dT%H:%M:%fZ','now')";

/** Stories considered for clustering, as before: the most recently seen 400. */
const OPEN_CLUSTER_LIMIT = 400;
/** Stories evaluated per run, as before: the most recently seen 300. */
const EVALUATE_LIMIT = 300;

/** Another discovery run holds the lease; this one did nothing. */
export class DiscoveryBusyError extends Error {
  constructor() {
    super("another discovery run is in progress");
    this.name = "DiscoveryBusyError";
  }
}

/**
 * Claim the run, or refuse.
 *
 * Two statements, and the second is the lock: it inserts (or, within the same
 * hour's key, re-arms) a `running` row ONLY if no discovery run is running, and
 * returns the row it claimed. Nothing returned means someone else holds it.
 * D1 serialises writes, so two callers cannot both see "none running".
 */
async function claimRun(workflow: string, at: Date, leaseMs: number): Promise<number> {
  // A run whose invocation died never recorded a finish. Past its lease it is
  // recorded as failed rather than left to block every run after it.
  await sql().run(
    `UPDATE newsroom_pipeline_runs
        SET status='failed', finished_at=${NOW_SQL},
            error='abandoned: no finish was recorded within the run lease'
      WHERE workflow=? AND status='running' AND started_at < ?`,
    [workflow, new Date(Date.now() - leaseMs).toISOString()]
  );
  const claimed = await sql().all<{ id: number }>(
    `INSERT INTO newsroom_pipeline_runs (workflow, idempotency_key, status)
     SELECT ?, ?, 'running'
      WHERE NOT EXISTS (SELECT 1 FROM newsroom_pipeline_runs WHERE workflow = ? AND status = 'running')
     ON CONFLICT(idempotency_key) DO UPDATE SET
       status = 'running', started_at = ${NOW_SQL}, finished_at = NULL, error = NULL
     RETURNING id`,
    [workflow, idempotencyKey(workflow, at), workflow]
  );
  if (claimed.length === 0) throw new DiscoveryBusyError();
  return claimed[0].id;
}

async function closeRun(runId: number, status: "succeeded" | "failed", error = ""): Promise<void> {
  await sql().run(
    `UPDATE newsroom_pipeline_runs
       SET status=?, finished_at=${NOW_SQL}, error=?
     WHERE id=?`,
    [status, error, runId]
  );
}

/* ── Set-based statements ──────────────────────────────────────────────── */

/**
 * Rows travel as one JSON parameter per statement, unpacked by `json_each`.
 *
 * That is what keeps the count of statements fixed: two hundred new items are
 * one INSERT, not two hundred. D1 caps a bound value at 2 MB, so rows are cut
 * into parameters of at most 256 KB — a first ingest of a thousand items is
 * three or four statements, an ordinary run is one.
 */
const CHUNK_BYTES = 256 * 1024;

function jsonChunks(rows: unknown[]): string[] {
  const chunks: string[] = [];
  let current: string[] = [];
  let size = 2;
  for (const row of rows) {
    const text = JSON.stringify(row);
    if (current.length > 0 && size + text.length + 1 > CHUNK_BYTES) {
      chunks.push(`[${current.join(",")}]`);
      current = [];
      size = 2;
    }
    current.push(text);
    size += text.length + 1;
  }
  if (current.length > 0) chunks.push(`[${current.join(",")}]`);
  return chunks;
}

/** One statement per chunk of `rows`; the JSON is always the LAST parameter. */
function forRows(query: string, rows: unknown[], lead: SqlParam[] = []): Statement[] {
  return jsonChunks(rows).map((json) => ({ sql: query, params: [...lead, json] }));
}

/** `json_extract(value, '$.<field>')`, spelled once. */
const j = (field: string, from = "value") => `json_extract(${from}, '$.${field}')`;

/* ── The in-memory model a run replays against ─────────────────────────── */

/**
 * A story, existing or created during this run.
 *
 * New stories have no id until the flush inserts them, so the replay gives
 * them a negative stand-in (-1, -2, …) wherever `buildCandidates` and
 * `findCluster` need a number, and the flush turns that back into the real id.
 */
type ModelStory = {
  id: number;
  canonical_title: string;
  last_seen_at: string;
  duplicate_of: number | null;
};

/** A member of a story, with what clustering and the recount both need. */
type ModelMember = MemberRow & {
  urlHash: string;
  tier: number;
  source_type: string;
  jurisdictions: string;
};

const orderKey = (m: { published_at: string | null; retrieved_at: string }) => m.published_at ?? m.retrieved_at;

/** A reference the flush can resolve: an existing id, or the n-th new story. */
type StoryRef = { sid: number } | { nk: number };
const refOf = (id: number): StoryRef => (id > 0 ? { sid: id } : { nk: -id - 1 });

/** Tier, primary-source and jurisdiction counts, exactly as the recount always computed them. */
function recount(members: ModelMember[]) {
  const tier1 = members.filter((r) => r.tier === 1).length;
  const tier2 = members.filter((r) => r.tier === 2).length;
  const tier3 = members.filter((r) => r.tier === 3).length;
  // A "primary source" is a Tier-1 source that issues the thing — a regulator
  // or a standard setter. A Tier-1 vendor release note is authoritative about
  // its own product and not about a rule, so it does not count here.
  const primary = members.filter(
    (r) => r.tier === 1 && (r.source_type === "regulator" || r.source_type === "standard_setter")
  ).length;

  const jurisdictions = new Set<string>();
  for (const r of members) {
    try {
      for (const x of JSON.parse(r.jurisdictions) as string[]) jurisdictions.add(String(x));
    } catch {
      /* a malformed row must not stop the recount */
    }
  }
  // GLOBAL is exclusive: once a specific market is named, the story is about
  // that market and mentions a global instrument.
  if (jurisdictions.size > 1) jurisdictions.delete("GLOBAL");

  return {
    t1: tier1,
    t2: tier2,
    t3: tier3,
    primary,
    n: members.length,
    jurisdictions: JSON.stringify([...jurisdictions]),
  };
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

/**
 * Gates and score for each open story.
 *
 * Both ends of the story, because they answer different questions. The oldest
 * member is when the development broke and supplies the lead the gates read;
 * the newest is when it last moved, which is what freshness and recency mean
 * for a living story. The first production run used the oldest for both and
 * rejected a four-day-old development as 47 days old.
 *
 * Every member of every open story arrives in ONE query; the two ends are
 * picked here rather than asked for per story.
 */
async function evaluate(stories: Story[], covered: string[], now: number): Promise<EvaluatedStory[]> {
  if (stories.length === 0) return [];

  const rows = await sql().all<{
    story_id: number;
    published_at: string | null;
    lead: string;
    retrieved_at: string;
  }>(
    `SELECT ss.story_id, i.published_at, i.lead, i.retrieved_at
       FROM newsroom_story_sources ss
       JOIN newsroom_source_items i ON i.id = ss.source_item_id
      WHERE ss.story_id IN (SELECT value FROM json_each(?))
      ORDER BY ss.story_id, ss.source_item_id`,
    [JSON.stringify(stories.map((s) => s.id))]
  );

  const ends = new Map<number, { earliest: (typeof rows)[number]; newest: (typeof rows)[number] }>();
  for (const r of rows) {
    const e = ends.get(r.story_id);
    if (!e) {
      ends.set(r.story_id, { earliest: r, newest: r });
      continue;
    }
    if (orderKey(r) < orderKey(e.earliest)) e.earliest = r;
    if (orderKey(r) > orderKey(e.newest)) e.newest = r;
  }

  return stories.map((story) => {
    const e = ends.get(story.id);
    const facts = {
      title: story.canonical_title,
      lead: e?.earliest.lead ?? "",
      jurisdictions: story.jurisdictions,
      tier1Count: story.tier1_source_count,
      tier2Count: story.tier2_source_count,
      tier3Count: story.tier3_source_count,
      sourceCount: story.source_count,
      firstSeenAt: story.first_seen_at,
      publishedAt: e?.earliest.published_at ?? null,
      latestPublishedAt: e?.newest.published_at ?? null,
      publishedTitles: covered,
      escalated: !!story.escalated_by,
    };
    const gates = runGates(facts, now);
    const { score, reasons } = scoreStory(facts, now);
    return { story, gates, score, reasons };
  });
}

/* ── The run ───────────────────────────────────────────────────────────── */

export type DiscoveryOptions = {
  /** Ignore the per-source cadence. Never ignores permission. */
  force?: boolean;
  /** Injected for tests; defaults to global fetch. */
  fetch?: typeof globalThis.fetch;
  now?: number;
  /** Injected for tests; overrides `newsroom.max_run_seconds`. */
  runBudgetMs?: number;
  /** Injected for tests; defaults to the deployment's plan (see plan.ts). */
  plan?: WorkersPlan;
};

/**
 * Items read from one source in one run — a fixed ceiling, not a setting.
 *
 * Real feeds list 10–100 entries. A "feed" listing thousands is an archive or
 * a misconfiguration, and taking all of it would turn one source into most of
 * the run's CPU and write volume. Feeds list newest first; the rest is simply
 * not read this run.
 */
const MAX_ITEMS_PER_SOURCE = 200;

/** Lease = time budget + this. A started source can overrun the budget by one timeout. */
const LEASE_MARGIN_MS = 5 * 60_000;

type Fetched = { source: Source; result: FetchResult; items: NormalisedItem[] } | { source: Source; skip: { outcome: FetchOutcome; reason: string } };

export async function runDiscovery(options: DiscoveryOptions = {}): Promise<DiscoveryResult> {
  const now = options.now ?? Date.now();
  const at = new Date(now);

  // Every limit the run needs, in one settings read.
  const lim = await limits([
    "newsroom.research_cap_per_day",
    "newsroom.max_sources_per_run",
    "newsroom.max_detail_fetches_per_run",
    "newsroom.max_run_seconds",
  ] as const);
  // On Workers Free a (manual) run is clamped to a profile that fits Free's
  // 50-query and 50-subrequest ceilings; on Paid and on Node the settings rule.
  const plan = options.plan ?? workersPlan();
  const free = plan === "free";
  const runBudgetMs =
    options.runBudgetMs ??
    Math.min(lim["newsroom.max_run_seconds"], free ? FREE_MANUAL_PROFILE.maxRunSeconds : Infinity) * 1000;
  const deadline = Date.now() + runBudgetMs;

  const runId = await claimRun("discovery", at, runBudgetMs + LEASE_MARGIN_MS);
  const startedAt = at.toISOString();

  const summaries: SourceRunSummary[] = [];
  let itemsIngested = 0;
  let itemsRevised = 0;
  let storiesCreated = 0;
  let storiesUpdated = 0;

  try {
    /* ── 1. Load ─────────────────────────────────────────────────────── */

    const sources = await allSources();

    // Which due sources this run takes. Under the limit that is all of them;
    // over it, the least recently attempted first, so a limit rotates through
    // the registry instead of starving whatever sorts last.
    const decisions = sources.map((source) => ({ source, decision: shouldFetch(source, now, options.force) }));
    const due = decisions.filter((d) => d.decision.due).map((d) => d.source);
    const maxSources = Math.min(lim["newsroom.max_sources_per_run"], free ? FREE_MANUAL_PROFILE.maxSources : Infinity);
    const chosen = new Set(
      (due.length <= maxSources
        ? due
        : [...due].sort((a, b) => ((a.last_attempt_at ?? "") < (b.last_attempt_at ?? "") ? -1 : (a.last_attempt_at ?? "") > (b.last_attempt_at ?? "") ? 1 : 0)).slice(0, maxSources)
      ).map((s) => s.id)
    );
    let detailBudget = Math.min(
      lim["newsroom.max_detail_fetches_per_run"],
      free ? FREE_MANUAL_PROFILE.maxDetailFetches : Infinity
    );
    const profile = free ? " (Workers Free profile)" : "";

    // Network first, database later: every due source is fetched (in registry
    // order, one at a time, as before) and normalised before anything is
    // looked up, so the lookups can be asked once for the whole run.
    const fetched: Fetched[] = [];
    for (const { source, decision } of decisions) {
      if (!decision.due) {
        fetched.push({ source, skip: { outcome: decision.outcome, reason: decision.reason } });
        continue;
      }
      if (!chosen.has(source.id)) {
        fetched.push({
          source,
          skip: { outcome: "skipped_budget", reason: `run limit of ${maxSources} sources${profile} reached — still due, taken next run` },
        });
        continue;
      }
      if (Date.now() >= deadline) {
        fetched.push({
          source,
          skip: { outcome: "skipped_budget", reason: `run time budget of ${Math.round(runBudgetMs / 1000)}s${profile} reached — still due, taken next run` },
        });
        continue;
      }
      const result = await fetchSource(source, { fetch: options.fetch, detailBudget, deadline });
      detailBudget = Math.max(0, detailBudget - (result.detailFetches ?? 0));
      const items: NormalisedItem[] = [];
      if (result.outcome === "ok") {
        for (const raw of result.items.slice(0, MAX_ITEMS_PER_SOURCE)) {
          const item = await normaliseItem(raw, source);
          if (item) items.push(item);
        }
      }
      fetched.push({ source, result, items });
    }

    // Which of these addresses are already held — and, for each, the story it
    // belongs to, which a revision needs. One query for the whole run.
    const hashes = [...new Set(fetched.flatMap((f) => ("items" in f ? f.items.map((i) => i.urlHash) : [])))];
    const heldRows = hashes.length
      ? await sql().all<{ id: number; url_hash: string; content_hash: string; story_id: number | null }>(
          `SELECT i.id, i.url_hash, i.content_hash,
                  (SELECT ss.story_id FROM newsroom_story_sources ss WHERE ss.source_item_id = i.id LIMIT 1) AS story_id
             FROM newsroom_source_items i
            WHERE i.url_hash IN (SELECT value FROM json_each(?))
            ORDER BY i.id`,
          [JSON.stringify(hashes)]
        )
      : [];

    // The run's ledger of addresses: what is held, what this run added, and
    // the content each currently carries. It is what the per-item lookup used
    // to ask the database, kept up to date as the replay writes.
    type LedgerEntry =
      | { kind: "held"; id: number; contentHash: string; storyId: number | null }
      | { kind: "new"; contentHash: string; storyId: number | null };
    const ledger = new Map<string, LedgerEntry>();
    for (const r of heldRows) {
      // Duplicate hashes predate the index; the first row is the one a
      // `first()` lookup always returned.
      if (!ledger.has(r.url_hash)) {
        ledger.set(r.url_hash, { kind: "held", id: r.id, contentHash: r.content_hash, storyId: r.story_id });
      }
    }

    // Will anything be fresh or revised? If not, clustering has nothing to do
    // and its two queries are skipped entirely.
    const needsClusters = fetched.some(
      (f) => "items" in f && f.items.some((i) => ledger.get(i.urlHash)?.contentHash !== i.contentHash)
    );

    const stories = new Map<number, ModelStory>();
    const members: ModelMember[] = [];
    if (needsClusters) {
      // The open stories (as the per-item lookup always chose them), plus the
      // owner of any held item that may be revised: a revision moves its story
      // to the front, where later items in this run can join it.
      const owners = [...new Set(heldRows.map((r) => r.story_id).filter((x): x is number => x !== null))];
      const cutoff = new Date(Date.now() - WINDOW_DAYS * 86_400_000).toISOString();
      const storyRows = await sql().all<ModelStory>(
        `SELECT id, canonical_title, last_seen_at, duplicate_of FROM newsroom_stories
          WHERE id IN (SELECT id FROM newsroom_stories
                        WHERE last_seen_at >= ? AND duplicate_of IS NULL
                        ORDER BY last_seen_at DESC LIMIT ${OPEN_CLUSTER_LIMIT})
             OR id IN (SELECT value FROM json_each(?))`,
        [cutoff, JSON.stringify(owners)]
      );
      for (const s of storyRows) stories.set(s.id, s);

      if (storyRows.length) {
        // Oldest first — buildCandidates takes the first row it sees per story
        // as that story's representative, so this ORDER BY is load-bearing.
        const memberRows = await sql().all<ModelMember & { url_hash: string }>(
          `SELECT ss.story_id, i.canonical_url, i.title, i.lead, i.published_at, i.retrieved_at,
                  i.url_hash, i.jurisdictions, s.authority_tier AS tier, s.source_type
             FROM newsroom_story_sources ss
             JOIN newsroom_source_items i ON i.id = ss.source_item_id
             JOIN newsroom_sources s ON s.id = i.source_id
            WHERE ss.story_id IN (SELECT value FROM json_each(?))
            ORDER BY COALESCE(i.published_at, i.retrieved_at) ASC`,
          [JSON.stringify(storyRows.map((s) => s.id))]
        );
        for (const m of memberRows) members.push({ ...m, urlHash: m.url_hash });
      }
    }

    /* ── 2. Replay ───────────────────────────────────────────────────── */

    // Timestamps the replay assigns: strictly increasing, so the order in
    // which things happened in this run survives into sorting, as it did when
    // every write took its own `now`.
    let clock = Date.now();
    const tick = () => new Date((clock = Math.max(clock + 1, Date.now()))).toISOString();

    /** Insert keeping members oldest first; equal keys keep arrival order. */
    const placeMember = (m: ModelMember) => {
      const key = orderKey(m);
      let lo = 0;
      let hi = members.length;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (orderKey(members[mid]) <= key) lo = mid + 1;
        else hi = mid;
      }
      members.splice(lo, 0, m);
    };

    /** What the per-item cluster lookup would have read at this moment. */
    const openCandidates = (): ClusterCandidate[] => {
      const cutoff = new Date(Date.now() - WINDOW_DAYS * 86_400_000).toISOString();
      const open = [...stories.values()]
        .filter((s) => s.duplicate_of === null && s.last_seen_at >= cutoff)
        .sort((a, b) => (a.last_seen_at === b.last_seen_at ? 0 : a.last_seen_at < b.last_seen_at ? 1 : -1))
        .slice(0, OPEN_CLUSTER_LIMIT);
      if (open.length === 0) return [];
      const ids = new Set(open.map((s) => s.id));
      const rows: StoryRow[] = open.map((s) => ({ id: s.id, canonical_title: s.canonical_title, last_seen_at: s.last_seen_at }));
      return buildCandidates(rows, members.filter((m) => ids.has(m.story_id)));
    };

    // What the flush will write.
    const newItems: Record<string, unknown>[] = [];
    const newItemIndex = new Map<string, Record<string, unknown>>();
    const revisedHeld = new Map<number, Record<string, unknown>>();
    const newStories: { title: string; counts: ReturnType<typeof recount>; updates: number }[] = [];
    const touched = new Map<number, { bumps: number; counts: ReturnType<typeof recount> | null }>();
    const links: { story: StoryRef; urlHash: string; rel: string }[] = [];
    const events: ({ created: boolean; reason: string } & StoryRef)[] = [];
    const fetchLog: Record<string, unknown>[] = [];
    const attempts: Record<string, unknown>[] = [];

    /** A story moved: `bumps` = sources added or revised; `counts` when members changed. */
    const touch = (id: number, counts: ReturnType<typeof recount> | null) => {
      const s = stories.get(id);
      if (s) s.last_seen_at = tick();
      if (id < 0) {
        const ns = newStories[-id - 1];
        ns.updates += 1;
        if (counts) ns.counts = counts;
        return;
      }
      const t = touched.get(id) ?? { bumps: 0, counts: null };
      t.bumps += 1;
      if (counts) t.counts = counts;
      touched.set(id, t);
    };

    for (const f of fetched) {
      const source = f.source;

      if ("skip" in f) {
        fetchLog.push({
          sourceId: source.id,
          durationMs: 0,
          outcome: f.skip.outcome,
          httpStatus: null,
          error: f.skip.reason.slice(0, 500),
          itemsFound: 0,
          itemsNew: 0,
        });
        summaries.push({
          sourceId: source.id,
          name: source.name,
          tier: source.authority_tier,
          outcome: f.skip.outcome,
          error: f.skip.reason,
          itemsFound: 0,
          itemsNew: 0,
        });
        continue;
      }

      const { result } = f;

      // ── Ingest ──
      // The canonical URL is identity: it answers both "did this source
      // re-serve the same entry", which happens on every poll, and "did two
      // registered sources syndicate one press release", which happens
      // whenever the Commission publishes something.
      //
      // The content hash then answers a different question: did the document
      // at that address CHANGE. That is a revision, not a duplicate — a
      // corrected effective date is often the most consequential edit a
      // regulator makes, and dropping it because the URL is familiar would
      // hide exactly the change worth knowing about.
      type Fresh = { urlHash: string; url: string; title: string; lead: string; publishedAt: string | null; jurisdictions: string[]; retrievedAt: string };
      const fresh: Fresh[] = [];
      const revisedOwners: (number | null)[] = [];

      for (const item of f.items) {
        const held = ledger.get(item.urlHash);
        const fields = {
          title: item.title,
          lead: item.lead,
          publishedAt: item.publishedAt,
          contentHash: item.contentHash,
          jurisdictions: JSON.stringify(item.jurisdictions),
          documentUrl: item.documentUrl,
          category: item.category,
        };

        if (held) {
          if (held.contentHash === item.contentHash) continue;
          // Revised. The stored row is updated rather than duplicated, so the
          // story keeps one member per document, and `revised_at` marks it.
          held.contentHash = item.contentHash;
          if (held.kind === "held") {
            revisedHeld.set(held.id, { id: held.id, ...fields });
          } else {
            Object.assign(newItemIndex.get(item.urlHash)!, fields, { revised: true });
          }
          // Its story now reads the revised text, as a re-read would have.
          for (let i = 0; i < members.length; i++) {
            if (members[i].urlHash !== item.urlHash) continue;
            const [m] = members.splice(i, 1);
            placeMember({ ...m, title: item.title, lead: item.lead, published_at: item.publishedAt, jurisdictions: fields.jurisdictions });
            break;
          }
          revisedOwners.push(held.storyId);
          continue;
        }

        const retrievedAt = tick();
        const row = { sourceId: source.id, url: item.url, urlHash: item.urlHash, retrievedAt, revised: false, ...fields };
        newItems.push(row);
        newItemIndex.set(item.urlHash, row);
        ledger.set(item.urlHash, { kind: "new", contentHash: item.contentHash, storyId: null });
        fresh.push({
          urlHash: item.urlHash,
          url: item.url,
          title: item.title,
          lead: item.lead,
          publishedAt: item.publishedAt,
          jurisdictions: item.jurisdictions,
          retrievedAt,
        });
      }

      itemsIngested += fresh.length;
      itemsRevised += revisedOwners.length;

      // A revised document keeps its story; what changes is that the story
      // moved. Recording it means the Inbox can say so rather than showing an
      // unchanged row at its original date.
      for (const owner of revisedOwners) {
        if (owner === null) continue;
        touch(owner, null);
        events.push({ ...refOf(owner), created: false, reason: `source revised at ${source.name}` });
      }

      // ── Record the attempt ──
      // `consecutive_failures` only counts real failures; a skip is not one.
      const succeeded = result.outcome === "ok" || result.outcome === "not_modified" || result.outcome === "empty_feed";
      attempts.push({
        id: source.id,
        outcome: result.outcome,
        httpStatus: result.httpStatus ?? null,
        error: result.error.slice(0, 500),
        found: result.items.length,
        fresh: fresh.length,
        etag: result.etag ?? "",
        lastModified: result.lastModified ?? "",
        ok: succeeded ? 1 : 0,
        failed: FAILURE_OUTCOMES.includes(result.outcome) ? 1 : 0,
      });
      fetchLog.push({
        sourceId: source.id,
        durationMs: result.durationMs,
        outcome: result.outcome,
        httpStatus: result.httpStatus ?? null,
        error: result.error.slice(0, 500),
        itemsFound: result.items.length,
        itemsNew: fresh.length,
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

      // ── Cluster as we go ──
      // So an item from a later source can join a story an earlier source in
      // this same run created.
      for (const item of fresh) {
        const match = findCluster(
          { url: item.url, title: item.title, lead: item.lead, publishedAt: item.publishedAt },
          openCandidates(),
          now
        );

        // The item's current text: a later entry in this same feed may already
        // have revised it, and a stored row is what the recount reads.
        const stored = newItemIndex.get(item.urlHash)!;
        const member: ModelMember = {
          story_id: 0,
          canonical_url: item.url,
          title: String(stored.title),
          lead: String(stored.lead),
          published_at: (stored.publishedAt as string | null) ?? null,
          retrieved_at: item.retrievedAt,
          urlHash: item.urlHash,
          tier: source.authority_tier,
          source_type: source.source_type,
          jurisdictions: String(stored.jurisdictions),
        };

        let storyId: number;
        if (match) {
          storyId = match.storyId;
          placeMember({ ...member, story_id: storyId });
          links.push({ story: refOf(storyId), urlHash: item.urlHash, rel: source.authority_tier === 1 ? "primary_text" : "corroborating" });
          touch(storyId, recount(members.filter((m) => m.story_id === storyId)));
          events.push({ ...refOf(storyId), created: false, reason: `source joined: ${match.reason}`.slice(0, 400) });
          storiesUpdated++;
        } else {
          storyId = -(newStories.length + 1);
          const title = clusterTitle([{ title: item.title, tier: source.authority_tier, seenAt: startedAt }]);
          stories.set(storyId, { id: storyId, canonical_title: title, last_seen_at: tick(), duplicate_of: null });
          placeMember({ ...member, story_id: storyId });
          newStories.push({ title, counts: recount(members.filter((m) => m.story_id === storyId)), updates: 0 });
          links.push({ story: refOf(storyId), urlHash: item.urlHash, rel: "originating" });
          events.push({ ...refOf(storyId), created: true, reason: `new story from ${source.name}` });
          storiesCreated++;
        }
        const entry = ledger.get(item.urlHash);
        if (entry) entry.storyId = storyId;
      }
    }

    /* ── 3. Flush ────────────────────────────────────────────────────── */

    // New stories get consecutive ids from the INSERT below, so within the
    // same transaction the k-th new story is MAX(id) - (count - 1) + k. That
    // is how later statements in the batch reach a story the replay could only
    // number, without reading anything back mid-transaction.
    const lastNew = newStories.length - 1;
    if (!Number.isSafeInteger(lastNew)) throw new Error("story count out of range");
    const storyIdFrom = (alias: string) =>
      `COALESCE(${j("sid", `${alias}.value`)}, (SELECT MAX(id) FROM newsroom_stories) - ${lastNew} + ${j("nk", `${alias}.value`)})`;

    const statements: Statement[] = [
      ...forRows(
        `INSERT INTO newsroom_source_items
           (source_id, url, canonical_url, title, lead, published_at, content_hash, url_hash, jurisdictions,
            document_url, category, language, processing_status, retrieved_at, clustered_at, revised_at)
         SELECT ${j("sourceId")}, ${j("url")}, ${j("url")}, ${j("title")}, ${j("lead")}, ${j("publishedAt")},
                ${j("contentHash")}, ${j("urlHash")}, ${j("jurisdictions")}, ${j("documentUrl")}, ${j("category")},
                'en', 'new', ${j("retrievedAt")}, ${NOW_SQL},
                CASE WHEN ${j("revised")} THEN ${NOW_SQL} END
           FROM json_each(?) ORDER BY key`,
        newItems
      ),
      ...forRows(
        `UPDATE newsroom_source_items
            SET title = r.title, lead = r.lead, published_at = r.published_at, content_hash = r.content_hash,
                jurisdictions = r.jurisdictions, document_url = r.document_url, category = r.category,
                revised_at = ${NOW_SQL}
           FROM (SELECT ${j("id")} AS id, ${j("title")} AS title, ${j("lead")} AS lead,
                        ${j("publishedAt")} AS published_at, ${j("contentHash")} AS content_hash,
                        ${j("jurisdictions")} AS jurisdictions, ${j("documentUrl")} AS document_url,
                        ${j("category")} AS category
                   FROM json_each(?)) AS r
          WHERE newsroom_source_items.id = r.id`,
        [...revisedHeld.values()]
      ),
      ...forRows(
        `INSERT INTO newsroom_stories
           (canonical_title, topic, jurisdictions, state, risk_class,
            tier1_source_count, tier2_source_count, tier3_source_count, primary_source_count, source_count,
            update_count, last_source_added_at, last_seen_at, updated_at)
         SELECT ${j("title")}, '', ${j("counts.jurisdictions")}, 'DISCOVERED', 'MEDIUM',
                ${j("counts.t1")}, ${j("counts.t2")}, ${j("counts.t3")}, ${j("counts.primary")}, ${j("counts.n")},
                ${j("updates")}, CASE WHEN ${j("updates")} > 0 THEN ${NOW_SQL} END, ${NOW_SQL}, ${NOW_SQL}
           FROM json_each(?) ORDER BY key`,
        newStories
      ),
      ...forRows(
        `INSERT INTO newsroom_story_sources (story_id, source_item_id, relationship)
         SELECT ${storyIdFrom("l")}, i.id, ${j("rel", "l.value")}
           FROM json_each(?) AS l
           JOIN newsroom_source_items i ON i.url_hash = ${j("urlHash", "l.value")}
          WHERE true
          ORDER BY l.key
         ON CONFLICT(story_id, source_item_id) DO NOTHING`,
        links.map((l) => ({ ...l.story, urlHash: l.urlHash, rel: l.rel }))
      ),
      ...forRows(
        `UPDATE newsroom_stories SET
           update_count = newsroom_stories.update_count + t.bumps,
           last_source_added_at = ${NOW_SQL},
           last_seen_at = ${NOW_SQL},
           tier1_source_count = COALESCE(t.t1, newsroom_stories.tier1_source_count),
           tier2_source_count = COALESCE(t.t2, newsroom_stories.tier2_source_count),
           tier3_source_count = COALESCE(t.t3, newsroom_stories.tier3_source_count),
           primary_source_count = COALESCE(t.primary_count, newsroom_stories.primary_source_count),
           source_count = COALESCE(t.n, newsroom_stories.source_count),
           jurisdictions = COALESCE(t.jurisdictions, newsroom_stories.jurisdictions),
           updated_at = CASE WHEN t.n IS NULL THEN newsroom_stories.updated_at ELSE ${NOW_SQL} END
         FROM (SELECT ${j("id")} AS id, ${j("bumps")} AS bumps, ${j("counts.t1")} AS t1, ${j("counts.t2")} AS t2,
                      ${j("counts.t3")} AS t3, ${j("counts.primary")} AS primary_count, ${j("counts.n")} AS n,
                      ${j("counts.jurisdictions")} AS jurisdictions
                 FROM json_each(?)) AS t
        WHERE newsroom_stories.id = t.id`,
        [...touched.entries()].map(([id, t]) => ({ id, bumps: t.bumps, counts: t.counts }))
      ),
      ...forRows(
        `INSERT INTO newsroom_pipeline_events (story_id, run_id, from_state, to_state, actor, reason)
         SELECT st.id, ?,
                CASE WHEN ${j("created", "e.value")} THEN NULL ELSE st.state END,
                CASE WHEN ${j("created", "e.value")} THEN 'DISCOVERED' ELSE st.state END,
                'engine', ${j("reason", "e.value")}
           FROM json_each(?) AS e
           JOIN newsroom_stories st ON st.id = ${storyIdFrom("e")}
          ORDER BY e.key`,
        events,
        [runId || null]
      ),
      ...forRows(
        `INSERT INTO newsroom_fetch_log
           (source_id, run_id, duration_ms, outcome, http_status, error, items_found, items_new)
         SELECT ${j("sourceId")}, ?, ${j("durationMs")}, ${j("outcome")}, ${j("httpStatus")}, ${j("error")},
                ${j("itemsFound")}, ${j("itemsNew")}
           FROM json_each(?) ORDER BY key`,
        fetchLog,
        [runId || null]
      ),
      ...forRows(
        `UPDATE newsroom_sources SET
           last_attempt_at = ${NOW_SQL},
           last_outcome = a.outcome,
           last_http_status = a.http_status,
           last_error = a.error,
           last_items_found = a.found,
           last_items_new = a.fresh,
           etag = a.etag,
           last_modified_header = a.last_modified,
           last_success_at = CASE WHEN a.ok = 1 THEN ${NOW_SQL} ELSE newsroom_sources.last_success_at END,
           consecutive_failures = CASE WHEN a.failed = 1 THEN newsroom_sources.consecutive_failures + 1
                                       WHEN a.ok = 1 THEN 0 ELSE newsroom_sources.consecutive_failures END,
           updated_at = ${NOW_SQL}
         FROM (SELECT ${j("id")} AS id, ${j("outcome")} AS outcome, ${j("httpStatus")} AS http_status,
                      ${j("error")} AS error, ${j("found")} AS found, ${j("fresh")} AS fresh, ${j("etag")} AS etag,
                      ${j("lastModified")} AS last_modified, ${j("ok")} AS ok, ${j("failed")} AS failed
                 FROM json_each(?)) AS a
        WHERE newsroom_sources.id = a.id`,
        attempts
      ),
    ];
    await sql().batch(statements);

    /* ── Evaluate everything still open ───────────────────────────────── */

    const cutoff = new Date(now - WINDOW_DAYS * 86_400_000).toISOString();
    const open = await sql().all<Record<string, unknown>>(
      `SELECT * FROM newsroom_stories
        WHERE state IN ('DISCOVERED','REJECTED') AND last_seen_at >= ? AND duplicate_of IS NULL
        ORDER BY last_seen_at DESC LIMIT ${EVALUATE_LIMIT}`,
      [cutoff]
    );
    const stored = new Map(open.map((r) => [Number(r.id), r]));

    const openStories = open.map((r) => ({
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

    const covered = open.length ? await publishedTitles() : [];
    const evaluated = await evaluate(openStories, covered, now);

    // Only stories whose verdict changed are written. The gates depend on the
    // clock as well as on the story, so every open story is still EVALUATED
    // every run — but most runs change nothing, and rewriting three hundred
    // identical rows was most of what a quiet run cost.
    const qualifying: Candidate[] = [];
    const verdicts: Record<string, unknown>[] = [];
    for (const e of evaluated) {
      const passed = gatesPassed(e.gates);
      const failure = firstFailure(e.gates);
      const next = {
        id: e.story.id,
        gates: JSON.stringify(e.gates),
        rejected: passed ? "" : `${failure?.label}: ${failure?.detail}`.slice(0, 400),
        score: passed ? e.score : null,
        reason: passed ? e.reasons.join("; ").slice(0, 600) : "",
      };
      const before = stored.get(e.story.id)!;
      if (
        before.gate_results !== next.gates ||
        before.rejected_reason !== next.rejected ||
        (before.relevance_score ?? null) !== next.score ||
        before.relevance_reason !== next.reason
      ) {
        verdicts.push(next);
      }
      if (passed) {
        qualifying.push({ storyId: e.story.id, score: e.score, gates: e.gates, reasons: e.reasons });
      }
    }

    /* ── Apply the cap ────────────────────────────────────────────────── */

    const cap = lim["newsroom.research_cap_per_day"];
    const selections = applyCap(qualifying, cap);
    const today = dayKey(at);

    // Qualifiers carry today's selection; stories that failed a gate are not
    // candidates and must not keep a stale selection from a previous run, when
    // they might have qualified. Written only where the value changes.
    const desired = new Map<number, { wr: number; rank: number | null; on: unknown }>();
    for (const s of selections) desired.set(s.storyId, { wr: s.selected ? 1 : 0, rank: s.rank, on: today });
    for (const e of evaluated) {
      if (gatesPassed(e.gates)) continue;
      desired.set(e.story.id, { wr: 0, rank: null, on: stored.get(e.story.id)!.selected_on ?? null });
    }
    const selectionRows: Record<string, unknown>[] = [];
    for (const [id, d] of desired) {
      const before = stored.get(id)!;
      if (before.would_research !== d.wr || (before.selection_rank ?? null) !== d.rank || (before.selected_on ?? null) !== d.on) {
        selectionRows.push({ id, ...d });
      }
    }

    await sql().batch([
      ...forRows(
        `UPDATE newsroom_stories SET
           gate_results = v.gates, rejected_reason = v.rejected, relevance_score = v.score,
           relevance_reason = v.reason, updated_at = ${NOW_SQL}
         FROM (SELECT ${j("id")} AS id, ${j("gates")} AS gates, ${j("rejected")} AS rejected,
                      ${j("score")} AS score, ${j("reason")} AS reason
                 FROM json_each(?)) AS v
        WHERE newsroom_stories.id = v.id`,
        verdicts
      ),
      ...forRows(
        `UPDATE newsroom_stories SET
           would_research = s.wr, selection_rank = s.rank, selected_on = s.selected_on
         FROM (SELECT ${j("id")} AS id, ${j("wr")} AS wr, ${j("rank")} AS rank, ${j("on")} AS selected_on
                 FROM json_each(?)) AS s
        WHERE newsroom_stories.id = s.id`,
        selectionRows
      ),
    ]);

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
