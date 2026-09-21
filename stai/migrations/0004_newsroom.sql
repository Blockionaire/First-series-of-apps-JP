-- The Intelligence Engine, phase 1: schema only.
--
-- Everything here is additive and nothing in it is read by a public page. The
-- newsroom is built BESIDE the platform, not through it (masterplan §2,
-- principle F): the manual editor at /admin/content/new keeps working whether
-- or not any of this exists, and the `articles` table remains the public
-- output, written only through the existing admin path.
--
-- The one change to an existing table is a nullable column on `articles`,
-- added now because the approved-article write path in phase 4 will carry it
-- and a column added later would leave every earlier piece untagged with no
-- way to tell "not tagged" from "tagged as nothing".
--
-- ── A note on what is NOT here ───────────────────────────────────────────
-- No podcast tables. Phase 6 adds those, and the existing `podcasts` table
-- already serves the hub. Adding empty tables now would be guessing at a
-- schema six phases before anything writes to it.

-- ─── Source registry ─────────────────────────────────────────────────────

-- The allowlist. Nothing enters the pipeline that is not represented here.
--
-- `active` defaults to 0 and there is no bulk enable anywhere in the
-- application. The seeded proposal lands dormant and the operator activates
-- each row individually, which is the difference between a considered list of
-- publications and whatever a seed file happened to contain.
CREATE TABLE newsroom_sources (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  name               TEXT NOT NULL,
  -- Bare host, no scheme, no www. Unique so the same publication cannot be
  -- registered twice at two different tiers, which would let a Tier-2 claim
  -- be laundered through a Tier-1 row.
  domain             TEXT NOT NULL UNIQUE,
  source_type        TEXT NOT NULL,      -- regulator | standard_setter | vendor | firm | news | research | professional_body | community
  authority_tier     INTEGER NOT NULL,   -- 1 authoritative | 2 trusted secondary | 3 discovery
  jurisdictions      TEXT NOT NULL,      -- JSON array of jurisdiction codes
  topics             TEXT NOT NULL DEFAULT '[]',
  ingestion_method   TEXT NOT NULL,      -- rss | atom | json_api | html_scrape | manual
  feed_url           TEXT NOT NULL DEFAULT '',
  fetch_frequency    INTEGER NOT NULL,   -- minutes
  -- Whether robots.txt and the site's terms permit automated retrieval.
  -- Separate from `active` on purpose: "approved in principle, blocked in
  -- practice" is a real state and the Inbox should show it rather than hide
  -- the source.
  fetch_allowed      INTEGER NOT NULL DEFAULT 0,
  license_notes      TEXT NOT NULL DEFAULT '',
  snapshot_retention TEXT NOT NULL DEFAULT 'ninety_days',  -- indefinite | ninety_days | reference_only
  active             INTEGER NOT NULL DEFAULT 0,
  activated_at       TEXT,
  activated_by       TEXT,
  last_success_at    TEXT,
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  created_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at         TEXT
);

-- The discovery scheduler's only query: active sources due for a fetch.
CREATE INDEX idx_newsroom_sources_due ON newsroom_sources(active, authority_tier, last_success_at);

-- ─── Ingested items ──────────────────────────────────────────────────────

-- One retrieved document. `content_hash` is what stops the same unchanged
-- page being reprocessed on every cycle — without it a 30-minute regulator
-- feed would re-enter the same twenty items 48 times a day.
CREATE TABLE newsroom_source_items (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id        INTEGER NOT NULL REFERENCES newsroom_sources(id),
  url              TEXT NOT NULL,
  canonical_url    TEXT NOT NULL DEFAULT '',
  title            TEXT NOT NULL DEFAULT '',
  -- Short extract for clustering and for the Inbox. The full body, when it is
  -- kept at all, lives in object storage under `raw_object_key` subject to the
  -- source's retention policy.
  lead             TEXT NOT NULL DEFAULT '',
  published_at     TEXT,
  retrieved_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  content_hash     TEXT NOT NULL,
  raw_object_key   TEXT,
  -- When the stored copy must be deleted. NULL means keep indefinitely, which
  -- only Tier-1 official texts get.
  purge_after      TEXT,
  language         TEXT NOT NULL DEFAULT 'en',
  processing_status TEXT NOT NULL DEFAULT 'new',
  UNIQUE (source_id, content_hash)
);

CREATE INDEX idx_newsroom_items_status ON newsroom_source_items(processing_status, retrieved_at DESC);
CREATE INDEX idx_newsroom_items_source ON newsroom_source_items(source_id, retrieved_at DESC);
-- The retention sweep: everything whose copy is due for deletion.
CREATE INDEX idx_newsroom_items_purge ON newsroom_source_items(purge_after) WHERE purge_after IS NOT NULL;

-- ─── Stories ─────────────────────────────────────────────────────────────

-- Eighteen outlets writing about the same announcement is one story, not
-- eighteen. This is that story.
CREATE TABLE newsroom_stories (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  canonical_title   TEXT NOT NULL,
  topic             TEXT NOT NULL DEFAULT '',
  jurisdictions     TEXT NOT NULL DEFAULT '[]',
  -- One of the states in src/lib/newsroom/state.ts. Never a free string: every
  -- write goes through transition(), and pipeline_events records the move.
  state             TEXT NOT NULL DEFAULT 'DISCOVERED',
  state_entered_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  risk_class        TEXT NOT NULL DEFAULT 'MEDIUM',   -- LOW | MEDIUM | HIGH | CRITICAL
  relevance_score   INTEGER,
  relevance_reason  TEXT NOT NULL DEFAULT '',
  novelty_score     INTEGER,
  -- Denormalised counts, maintained on every story_sources write. The
  -- Tier-1/2 gate (masterplan D1) is checked on every attempt to enter
  -- research, so it must not require a join over every item each time.
  tier1_source_count INTEGER NOT NULL DEFAULT 0,
  tier2_source_count INTEGER NOT NULL DEFAULT 0,
  tier3_source_count INTEGER NOT NULL DEFAULT 0,
  primary_source_count INTEGER NOT NULL DEFAULT 0,
  source_count      INTEGER NOT NULL DEFAULT 0,
  -- Set when a human overrides the discovery-only gate. An override, recorded
  -- as one, with a reason — not a loophole the engine can reach.
  escalated_by      TEXT,
  escalated_reason  TEXT,
  -- The published article this story became, once it has one.
  article_id        INTEGER REFERENCES articles(id),
  first_seen_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  last_seen_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at        TEXT
);

-- The Editorial Inbox's main query, and the stuck-story check.
CREATE INDEX idx_newsroom_stories_state ON newsroom_stories(state, state_entered_at DESC);
CREATE INDEX idx_newsroom_stories_seen ON newsroom_stories(last_seen_at DESC);

CREATE TABLE newsroom_story_sources (
  story_id       INTEGER NOT NULL REFERENCES newsroom_stories(id),
  source_item_id INTEGER NOT NULL REFERENCES newsroom_source_items(id),
  -- originating | corroborating | primary_text | background
  relationship   TEXT NOT NULL DEFAULT 'corroborating',
  added_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (story_id, source_item_id)
);

-- ─── Evidence ────────────────────────────────────────────────────────────

CREATE TABLE newsroom_evidence_packs (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  story_id       INTEGER NOT NULL REFERENCES newsroom_stories(id),
  version        INTEGER NOT NULL DEFAULT 1,
  -- The structured research output, as returned. Kept whole so a later
  -- question about what the researcher actually said has an answer.
  payload_json   TEXT NOT NULL,
  model          TEXT NOT NULL DEFAULT '',
  prompt_version TEXT NOT NULL DEFAULT '',
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (story_id, version)
);

-- One row per material claim. This is the asset the whole pipeline is built
-- around: an article is publishable only insofar as its claims resolve here.
CREATE TABLE newsroom_evidence_claims (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  pack_id           INTEGER NOT NULL REFERENCES newsroom_evidence_packs(id),
  story_id          INTEGER NOT NULL REFERENCES newsroom_stories(id),
  claim_type        TEXT NOT NULL,   -- FACT | DATE | NUMBER | REQUIREMENT | INTERPRETATION | IMPLICATION
  claim_text        TEXT NOT NULL,
  source_id         INTEGER REFERENCES newsroom_sources(id),
  source_url        TEXT NOT NULL DEFAULT '',
  -- Where in the source. For a 200-page regulation, "the Commission said so"
  -- is not traceable; an article number or a quoted span is.
  source_locator    TEXT NOT NULL DEFAULT '',
  support_status    TEXT NOT NULL,   -- SUPPORTED | PARTIALLY_SUPPORTED | CONFLICTING | UNSUPPORTED
  evidence_strength TEXT NOT NULL,   -- PRIMARY | SECONDARY | WEAK
  verified_at       TEXT
);

CREATE INDEX idx_newsroom_claims_story ON newsroom_evidence_claims(story_id, support_status);

-- ─── Drafts and review ───────────────────────────────────────────────────

CREATE TABLE newsroom_drafts (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  story_id         INTEGER NOT NULL REFERENCES newsroom_stories(id),
  version          INTEGER NOT NULL DEFAULT 1,
  format           TEXT NOT NULL DEFAULT 'news_update',  -- news_update | explainer | regulatory_alert | research_note
  title            TEXT NOT NULL DEFAULT '',
  dek              TEXT NOT NULL DEFAULT '',
  body_md          TEXT NOT NULL DEFAULT '',
  jurisdictions    TEXT NOT NULL DEFAULT '[]',
  model            TEXT NOT NULL DEFAULT '',
  prompt_version   TEXT NOT NULL DEFAULT '',
  evidence_pack_id INTEGER REFERENCES newsroom_evidence_packs(id),
  -- Copyright guardrail (masterplan §10): how much of the piece rests on
  -- primary sources, and how close it sits to any single source.
  primary_source_ratio REAL,
  max_source_similarity REAL,
  created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (story_id, version)
);

-- Fact-check and editorial QA outcomes. One row per review pass, so a story
-- that went round twice shows both passes rather than only the one that
-- eventually succeeded.
CREATE TABLE newsroom_ai_reviews (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  draft_id       INTEGER NOT NULL REFERENCES newsroom_drafts(id),
  story_id       INTEGER NOT NULL REFERENCES newsroom_stories(id),
  review_type    TEXT NOT NULL,   -- claim_extraction | claim_adjudication | editorial_qa | copyright
  verdict        TEXT NOT NULL,   -- PASS | FAIL
  findings_json  TEXT NOT NULL DEFAULT '[]',
  claims_total   INTEGER NOT NULL DEFAULT 0,
  claims_supported INTEGER NOT NULL DEFAULT 0,
  claims_unsupported INTEGER NOT NULL DEFAULT 0,
  model          TEXT NOT NULL DEFAULT '',
  prompt_version TEXT NOT NULL DEFAULT '',
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX idx_newsroom_reviews_draft ON newsroom_ai_reviews(draft_id, review_type);

-- Every human review decision, captured from the first one (masterplan §15,
-- change C9). After ~50 rows this is a regression set: re-run a new writer
-- prompt against the same evidence packs and diff against what the editor
-- actually published. The labels only exist if they are captured as the
-- reviews happen; they cannot be reconstructed later, which is why this table
-- ships in phase 1 rather than with the eval harness in phase 5.
CREATE TABLE newsroom_editorial_decisions (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  story_id       INTEGER NOT NULL REFERENCES newsroom_stories(id),
  draft_id       INTEGER REFERENCES newsroom_drafts(id),
  decision       TEXT NOT NULL,   -- approve | approve_with_edits | reject | request_research | escalate
  reason         TEXT NOT NULL DEFAULT '',
  -- What the human published, when they changed it. The diff against the
  -- draft is the training signal.
  edited_body_md TEXT,
  reviewer       TEXT NOT NULL DEFAULT '',
  review_seconds INTEGER,
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX idx_newsroom_decisions_story ON newsroom_editorial_decisions(story_id, created_at DESC);

-- ─── Pipeline observability ──────────────────────────────────────────────

CREATE TABLE newsroom_pipeline_runs (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  workflow      TEXT NOT NULL,   -- discovery | research | article | publication | podcast
  story_id      INTEGER REFERENCES newsroom_stories(id),
  -- Deterministic per (story, workflow, input) so a re-run of a partially
  -- failed workflow reuses the row instead of creating a second one. This is
  -- the idempotency mechanism named in masterplan §12, change C14.
  idempotency_key TEXT NOT NULL UNIQUE,
  status        TEXT NOT NULL DEFAULT 'running',  -- running | succeeded | failed
  started_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  finished_at   TEXT,
  error         TEXT,
  cost_cents    INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_newsroom_runs_status ON newsroom_pipeline_runs(status, started_at DESC);

-- Every state transition, including the ones a human makes by hand. This is
-- what turns a silently dropped story into a visible one: a stuck story is a
-- story whose last event is old, not a story that is simply absent.
CREATE TABLE newsroom_pipeline_events (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  story_id    INTEGER NOT NULL REFERENCES newsroom_stories(id),
  run_id      INTEGER REFERENCES newsroom_pipeline_runs(id),
  from_state  TEXT,
  to_state    TEXT NOT NULL,
  actor       TEXT NOT NULL DEFAULT 'engine',   -- engine | human | system
  actor_ref   TEXT NOT NULL DEFAULT '',
  reason      TEXT NOT NULL DEFAULT '',
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX idx_newsroom_events_story ON newsroom_pipeline_events(story_id, created_at DESC);

-- The spend ledger. One row per model call, so cost/story and
-- cost/published_article are measured from the first run rather than
-- estimated forever (masterplan §16). Nothing writes here in phase 1.
CREATE TABLE newsroom_ai_spend (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  story_id       INTEGER REFERENCES newsroom_stories(id),
  run_id         INTEGER REFERENCES newsroom_pipeline_runs(id),
  stage          TEXT NOT NULL,   -- relevance | research | writing | verification | editorial
  model          TEXT NOT NULL,
  input_tokens   INTEGER NOT NULL DEFAULT 0,
  cached_input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens  INTEGER NOT NULL DEFAULT 0,
  cost_cents     INTEGER NOT NULL DEFAULT 0,
  -- Denormalised so the month's total is one indexed scan rather than a
  -- date function over every row.
  period         TEXT NOT NULL,   -- YYYY-MM
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX idx_newsroom_spend_period ON newsroom_ai_spend(period, stage);
CREATE INDEX idx_newsroom_spend_story ON newsroom_ai_spend(story_id);

-- ─── The one change to an existing table ─────────────────────────────────

-- Which market a piece applies to (masterplan §19b, decision D7). A JSON array
-- because multi-value is the normal case: a piece on the EU AI Act as it lands
-- on Dutch audit firms is EU *and* NL.
--
-- Defaults to an empty array rather than a guess. No existing article is
-- retro-tagged by this migration, because guessing a jurisdiction is exactly
-- the kind of small fabrication this platform cannot afford; the eleven
-- published pieces are tagged by a human or not at all.
--
-- Nothing public reads this yet. Surfacing it to readers and adding it to the
-- manual editor is a follow-up outside phase 1.
ALTER TABLE articles ADD COLUMN jurisdictions TEXT NOT NULL DEFAULT '[]';
