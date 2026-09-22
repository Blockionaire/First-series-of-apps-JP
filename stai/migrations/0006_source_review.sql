-- Phase 2.5: what a human concluded about a source, recorded separately from
-- what the engine is allowed to do with it.
--
-- ── Why this is not just another flag ───────────────────────────────────
-- `active` and `fetch_allowed` are permissions: they are what the fetcher
-- reads, and between them they decide whether a byte moves. Neither can record
-- "I looked at this and the feed is dead", because switching a source off says
-- nothing about why — a source nobody has examined and one examined and
-- rejected are both `active = 0`, and that is the difference between a list
-- you can work through and a list you have to re-check from the start.
--
-- So this column carries the CONCLUSION and never the permission. Nothing in
-- the fetch path reads it. `fetch_allowed` remains the only gate, which is the
-- property worth protecting: a reviewer marking something "retrieval approved"
-- in a dropdown must not be the act that starts retrieval, or the two-switch
-- design collapses into one.
--
-- 'unreviewed'        — nobody has looked.
-- 'feed_verified'     — the URL serves a real feed with real items.
-- 'retrieval_approved'— robots.txt and terms were read and permit fetching.
-- 'needs_fix'         — something is wrong and is worth fixing (moved feed).
-- 'do_not_use'        — examined and rejected. Distinct from 'needs_fix': one
--                       is a queue, the other is a decision.
ALTER TABLE newsroom_sources
  ADD COLUMN review_status TEXT NOT NULL DEFAULT 'unreviewed';

-- Who reached that conclusion and when. The registry's premise is that a named
-- person read each source; an unattributed status is the same as none.
ALTER TABLE newsroom_sources ADD COLUMN reviewed_by TEXT NOT NULL DEFAULT '';
ALTER TABLE newsroom_sources ADD COLUMN reviewed_at TEXT;

-- The one line that explains the status to the next person: which feed path
-- worked, what the terms said, why it was rejected.
ALTER TABLE newsroom_sources ADD COLUMN review_note TEXT NOT NULL DEFAULT '';

-- Working through a registry means filtering it by where each row has got to.
CREATE INDEX idx_newsroom_sources_review ON newsroom_sources(review_status, authority_tier);

-- ── The feed tester's record ────────────────────────────────────────────
-- Every probe, including the failures, and deliberately a table of its own
-- rather than more columns on newsroom_sources.
--
-- Finding a working feed for a source like EFRAG means trying several paths.
-- The useful artefact is the sequence — "/rss 404, /news/rss 200 but HTML,
-- /feed/news.xml 200 atom 25 items" — which a single last-result column
-- cannot hold. It is also the evidence behind a 'feed_verified' status, and
-- evidence that only exists until the next attempt is not evidence.
--
-- No content is stored. Titles are kept because recognising the right feed is
-- the point of the exercise; bodies, which would be a retention question, are
-- not.
CREATE TABLE newsroom_source_probes (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id  INTEGER NOT NULL REFERENCES newsroom_sources(id) ON DELETE CASCADE,
  -- The URL as tested, which is NOT necessarily the source's stored feed_url:
  -- the whole point is trying candidates before committing one.
  url        TEXT NOT NULL,
  final_url  TEXT NOT NULL DEFAULT '',
  actor      TEXT NOT NULL,
  ok         INTEGER NOT NULL DEFAULT 0,
  http_status INTEGER,
  content_type TEXT NOT NULL DEFAULT '',
  format     TEXT NOT NULL DEFAULT 'unknown',
  item_count INTEGER NOT NULL DEFAULT 0,
  latest_published_at TEXT,
  sample_titles TEXT NOT NULL DEFAULT '[]',
  error      TEXT NOT NULL DEFAULT '',
  duration_ms INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX idx_newsroom_probes_source ON newsroom_source_probes(source_id, created_at DESC);
