-- Source health: the two human dates the registry could not record.
--
-- Everything else the Source Health dashboard shows already exists — the
-- fetch telemetry on newsroom_sources, every attempt in newsroom_fetch_log,
-- every Test source in newsroom_source_probes. What did not exist:
--
--   · When a person last CONFIRMED a source's configuration is still right.
--     `reviewed_at` moves only when the review status changes, so a source
--     re-checked every quarter and found unchanged looked unexamined since the
--     day it was first reviewed.
--
--   · When the terms, robots.txt and reuse conditions were last CHECKED.
--     Ticking Retrievable recorded neither who nor when. Permission and the
--     evidence for it are different facts; this records the second.
--
-- Additive and nullable. Every existing source starts with NULL in all four,
-- which reads as "not recorded" — nothing is marked confirmed or checked by
-- this migration, and no permission, activation or review status changes.

ALTER TABLE newsroom_sources ADD COLUMN confirmed_at TEXT;
ALTER TABLE newsroom_sources ADD COLUMN confirmed_by TEXT NOT NULL DEFAULT '';
ALTER TABLE newsroom_sources ADD COLUMN terms_checked_at TEXT;
ALTER TABLE newsroom_sources ADD COLUMN terms_checked_by TEXT NOT NULL DEFAULT '';

-- The dashboard's per-source item statistics (newest date, dated and undated
-- counts) read from this index alone, without touching the item rows.
CREATE INDEX IF NOT EXISTS idx_newsroom_items_source_published
  ON newsroom_source_items(source_id, published_at, retrieved_at);
