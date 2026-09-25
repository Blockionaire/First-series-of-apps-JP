-- Retire H3C, register H2A.
--
-- ── Why this is a migration and not a seed or a script ──────────────────
-- The Haut Conseil du Commissariat aux Comptes was reconstituted as the
-- Haute Autorité de l'Audit. Both the name and the DOMAIN changed, and the
-- domain is this table's UNIQUE identity for a source — so there is no edit
-- that turns one row into the other. One row retires; another begins.
--
-- `load_proposal` cannot do it: it skips domains already present and never
-- touches an existing row, which is exactly the property that stops a seed
-- file quietly overwriting decisions a person made. The registry UI can do
-- it, in two deliberate acts. This does the same two acts once, for an
-- operator who asked for them rather than for a menu.
--
-- ── What it may and may not do ──────────────────────────────────────────
-- Everything here either REMOVES capability or adds a dormant row. Nothing
-- is switched on, nothing is granted retrieval, and no page is fetched:
--
--   · H3C is switched off and its retrieval permission withdrawn. That is
--     strictly safety-increasing, so it needs no further approval.
--   · H2A is inserted `active = 0` and `fetch_allowed = 0`, exactly as
--     `load_proposal` and the Add source form insert one. Registering a
--     source has never implied permission to read it — decision D5 — and a
--     migration is not the place to start.
--
-- Turning H2A on is still a person's job, in the registry, and it still
-- records who did it.
--
-- ── It is a SUCCESSION, not a seeding ───────────────────────────────────
-- The insert below fires only where an h3c.org row exists. That is not
-- defensive coding; it is the difference between the two things a migration
-- could be doing here, and only one of them is allowed.
--
-- `tests/newsroom-admin.test.mjs` asserts that the registry starts empty —
-- "nothing is seeded behind your back". The registry's whole premise is that
-- a named person chose each source, through `load_proposal` or the Add form,
-- and a migration that quietly put a row in a fresh database would be the
-- first thing to break that. It is also unnecessary: H2A is in
-- proposed-sources.ts, so a registry loading the proposal for the first time
-- gets it that way, chosen rather than planted.
--
-- So this does one job: where H3C was registered, its successor takes its
-- place. Nowhere else.
--
-- ── Idempotent by construction ──────────────────────────────────────────
-- A registry that never loaded the proposal has no H3C row, and one where
-- the operator already added H2A by hand has the new row. Both are no-ops
-- rather than errors: the UPDATE matches nothing, and the INSERT is guarded
-- on both conditions.

-- ── 1. Retire H3C ───────────────────────────────────────────────────────
-- The same three columns `setSourceReviewStatus` writes for `do_not_use`,
-- plus the switches it clears immediately afterwards. Kept in step with that
-- function on purpose: a row retired here and a row retired in the UI should
-- be indistinguishable afterwards.
UPDATE newsroom_sources
SET review_status = 'do_not_use',
    review_note   = 'Superseded by H2A (h2a-france.org). The Haut Conseil du Commissariat aux Comptes was reconstituted as the Haute Autorité de l''Audit; the domain changed, so the successor is a separate row.',
    reviewed_by   = 'migration 0010',
    reviewed_at   = strftime('%Y-%m-%dT%H:%M:%fZ','now'),
    active        = 0,
    fetch_allowed = 0,
    updated_at    = strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE domain = 'h3c.org';

-- ── 2. Register H2A, dormant ────────────────────────────────────────────
-- Column for column what `createSource` writes, so a row created here and a
-- row created through the Add source form are the same row.
--
-- fetch_frequency 30 and snapshot_retention 'indefinite' are the Tier 1
-- defaults (DEFAULT_FREQUENCY / DEFAULT_RETENTION in sources.ts). Written
-- literally because SQL cannot read TypeScript; if those defaults change,
-- this historical row keeps the value it was registered with, which is the
-- correct behaviour for a migration.
--
-- The feed_url is the official publication hub, VERIFIED by the operator. An
-- earlier draft of this migration carried a guess — `/actualites/`, inferred
-- from the predecessor site — and it was wrong: H2A files publications and
-- news together under one combined section. The guess never reached a
-- database, which is the only reason this is a correction rather than a
-- second migration.
--
-- Still open, and not for a migration to decide: whether H2A publishes a
-- feed. Nothing in this build has ever reached the host. The extractor
-- refuses a feed body with an instruction to switch the method to `rss`, so
-- pointing Test source at a candidate feed is how that gets answered.
INSERT INTO newsroom_sources
  (name, domain, source_type, authority_tier, jurisdictions, topics,
   ingestion_method, feed_url, fetch_frequency, fetch_allowed,
   license_notes, snapshot_retention, active, review_status, review_note)
SELECT
  'H2A — Haute Autorité de l''Audit',
  'h2a-france.org',
  'regulator',
  1,
  '["FR"]',
  '["audit","oversight"]',
  'html_scrape',
  'https://h2a-france.org/publications-et-actualites/',
  30,
  0,
  '',
  'indefinite',
  0,
  'unreviewed',
  'Registered by migration 0010 as the successor to H3C. The hub address is confirmed; the item shape under it is not. Inactive and not retrievable — run Test source before switching it on.'
WHERE NOT EXISTS (SELECT 1 FROM newsroom_sources WHERE domain = 'h2a-france.org')
  -- Only where there is something to succeed. See "It is a SUCCESSION" above.
  AND EXISTS (SELECT 1 FROM newsroom_sources WHERE domain = 'h3c.org');
