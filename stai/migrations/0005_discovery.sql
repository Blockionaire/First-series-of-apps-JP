-- The Intelligence Engine, phase 2: discovery, clustering and the dry run.
--
-- Still no AI, still nothing public. What this adds is the machinery to find
-- things, recognise that eighteen reports are one development, and show a
-- human what the engine WOULD have researched — without researching it.
--
-- Additive only. Every statement is a CREATE or an ADD COLUMN with a default,
-- so applying this to a live database cannot fail on existing rows.

-- ─── Source items gain what normalisation produces ───────────────────────

-- Which market the item speaks to. Inherited from the source at ingestion
-- (a Dutch regulator's feed is NL) and refined by the clusterer, because an
-- EU-wide source can carry an item about one member state.
ALTER TABLE newsroom_source_items ADD COLUMN jurisdictions TEXT NOT NULL DEFAULT '[]';

-- Hash of the CANONICAL url. This is identity, and it is the dedup key.
--
-- It answers both "did this source re-serve the same entry", which happens on
-- every poll, and "did two registered sources syndicate one press release",
-- which happens whenever the Commission publishes something and four outlets
-- carry it. content_hash then answers a different question — did the document
-- at that address CHANGE — which is a revision, not a duplicate.
ALTER TABLE newsroom_source_items ADD COLUMN url_hash TEXT NOT NULL DEFAULT '';

-- Set once the item has been offered to the clusterer. Not the same as
-- processing_status: an item can be clustered and still be waiting on
-- something else later.
ALTER TABLE newsroom_source_items ADD COLUMN clustered_at TEXT;

CREATE INDEX idx_newsroom_items_urlhash ON newsroom_source_items(url_hash);
CREATE INDEX idx_newsroom_items_unclustered ON newsroom_source_items(clustered_at)
  WHERE clustered_at IS NULL;

-- ─── Sources gain fetch telemetry ────────────────────────────────────────

-- last_success_at already exists and answers "when did this last WORK".
-- These answer "what happened the last time we TRIED", which is the question
-- an operator actually asks when a feed looks quiet. A source whose last
-- attempt was a 404 four minutes ago and one that has simply not been due for
-- an hour look identical without them.
ALTER TABLE newsroom_sources ADD COLUMN last_attempt_at TEXT;
ALTER TABLE newsroom_sources ADD COLUMN last_outcome TEXT NOT NULL DEFAULT '';
ALTER TABLE newsroom_sources ADD COLUMN last_http_status INTEGER;
ALTER TABLE newsroom_sources ADD COLUMN last_error TEXT NOT NULL DEFAULT '';
ALTER TABLE newsroom_sources ADD COLUMN last_items_found INTEGER NOT NULL DEFAULT 0;
ALTER TABLE newsroom_sources ADD COLUMN last_items_new INTEGER NOT NULL DEFAULT 0;

-- Conditional-GET validators. Sending these back turns most fetches into a
-- 304 with no body, which is the polite way to poll someone else's server
-- every thirty minutes — and the difference between a courteous crawler and
-- one that gets blocked.
ALTER TABLE newsroom_sources ADD COLUMN etag TEXT NOT NULL DEFAULT '';
ALTER TABLE newsroom_sources ADD COLUMN last_modified_header TEXT NOT NULL DEFAULT '';

-- ─── Every fetch attempt, recorded ───────────────────────────────────────

-- One row per attempt, including the attempts that were skipped and why.
--
-- The skips matter as much as the failures. "Nothing came from the AFM today"
-- has three very different explanations — not due yet, not approved for
-- retrieval, or a 500 — and an operator cannot act on the first without being
-- able to tell it from the third.
CREATE TABLE newsroom_fetch_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id   INTEGER NOT NULL REFERENCES newsroom_sources(id),
  run_id      INTEGER REFERENCES newsroom_pipeline_runs(id),
  started_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  duration_ms INTEGER,
  -- ok | not_modified | http_error | network_error | timeout | parse_error
  -- | empty_feed | skipped_inactive | skipped_not_permitted | skipped_not_due
  -- | skipped_manual
  outcome     TEXT NOT NULL,
  http_status INTEGER,
  error       TEXT NOT NULL DEFAULT '',
  items_found INTEGER NOT NULL DEFAULT 0,
  items_new   INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_newsroom_fetchlog_source ON newsroom_fetch_log(source_id, started_at DESC);
CREATE INDEX idx_newsroom_fetchlog_run ON newsroom_fetch_log(run_id);

-- ─── Stories gain the dry run's verdict ──────────────────────────────────

-- Every gate, with its result and reason, as returned. Kept whole rather than
-- reduced to a boolean because the dry run's entire purpose is for a human to
-- disagree with a specific gate — "it rejected this as trivial and it wasn't"
-- is only actionable if the gate that fired is on the record.
ALTER TABLE newsroom_stories ADD COLUMN gate_results TEXT NOT NULL DEFAULT '[]';

-- The first gate that failed, in plain words, for the Inbox.
ALTER TABLE newsroom_stories ADD COLUMN rejected_reason TEXT NOT NULL DEFAULT '';

-- The dry run's answer: would this have gone to research?
ALTER TABLE newsroom_stories ADD COLUMN would_research INTEGER NOT NULL DEFAULT 0;
-- Where it placed on the day it was considered, and which day that was.
ALTER TABLE newsroom_stories ADD COLUMN selection_rank INTEGER;
ALTER TABLE newsroom_stories ADD COLUMN selected_on TEXT;

-- Living stories. A cluster that has been evaluated does not stop existing:
-- regulation arrives in stages, and a new report joining an old cluster is a
-- development, not a new story. These record that it happened so the Inbox
-- can surface "this moved again" rather than burying it at its original date.
ALTER TABLE newsroom_stories ADD COLUMN update_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE newsroom_stories ADD COLUMN last_source_added_at TEXT;
-- Set when the clusterer decides this cluster duplicates an earlier one.
ALTER TABLE newsroom_stories ADD COLUMN duplicate_of INTEGER REFERENCES newsroom_stories(id);

CREATE INDEX idx_newsroom_stories_selected ON newsroom_stories(selected_on, selection_rank);
CREATE INDEX idx_newsroom_stories_wouldresearch ON newsroom_stories(would_research, last_seen_at DESC);

-- ─── Human feedback on discovery ─────────────────────────────────────────

-- The dry run's actual output.
--
-- Two weeks of watching the engine pick things is worth very little on its
-- own; two weeks of a human saying "good story" or "wrong jurisdiction" next
-- to each pick is a labelled set that can tune the gates. This is distinct
-- from newsroom_editorial_decisions, which judges a DRAFT — this judges a
-- SELECTION, and the two are different questions with different labels.
--
-- Permanent by design. Rows are never deleted or overwritten: a reviewer who
-- changes their mind adds a second row, because the first judgement is also
-- data about how clear the case was.
CREATE TABLE newsroom_discovery_feedback (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  story_id   INTEGER NOT NULL REFERENCES newsroom_stories(id),
  -- good | not_relevant | duplicate | wrong_jurisdiction
  verdict    TEXT NOT NULL,
  note       TEXT NOT NULL DEFAULT '',
  reviewer   TEXT NOT NULL DEFAULT '',
  -- What the engine thought at the moment of judgement, frozen. Re-reading the
  -- story later would show its CURRENT score, and the label would then be
  -- attached to a number that was never the one being judged.
  scored     INTEGER,
  would_research INTEGER NOT NULL DEFAULT 0,
  gate_results TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX idx_newsroom_feedback_story ON newsroom_discovery_feedback(story_id, created_at DESC);
CREATE INDEX idx_newsroom_feedback_verdict ON newsroom_discovery_feedback(verdict, created_at DESC);

-- When a document at a known address changed.
--
-- Deduplication keys on the canonical URL, which is identity. But a regulator
-- that corrects an effective date republishes at the SAME address, and
-- dropping that because the URL is familiar would hide exactly the change
-- worth knowing about. A revision updates the stored row and stamps this,
-- so the story it belongs to can show that it moved.
ALTER TABLE newsroom_source_items ADD COLUMN revised_at TEXT;
