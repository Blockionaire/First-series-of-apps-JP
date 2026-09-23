-- Three indexes for access paths that were table scans (CODE_AUDIT.md, P2/P4/P5).
--
-- Additive only: no table, column or row changes, and each is IF NOT EXISTS so
-- a database that somehow already has one is not an error. On D1 a scan is not
-- just slower — every row it reads is billed — so these matter before the
-- tables are large, not after.

-- Which story holds this item? Asked when a revised document moves its story,
-- and by discovery when it attaches items. The primary key is
-- (story_id, source_item_id), which answers "the items of a story" and cannot
-- answer this. Measured at 300k rows: 3.4 ms scan → 0.003 ms seek.
CREATE INDEX IF NOT EXISTS idx_story_sources_item ON newsroom_story_sources(source_item_id);

-- Expired-session purge, which runs on every sign-in:
--   DELETE FROM sessions WHERE expires_at <= datetime('now')
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

-- Entitlement, evaluated by currentUser() on every signed-in request:
--   EXISTS (SELECT 1 FROM subscriptions sub WHERE sub.user_id = u.id AND …)
-- Empty while payments are frozen, which is exactly when an index costs nothing.
CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id);
