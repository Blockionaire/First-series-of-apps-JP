-- Indexes.
--
-- Separated from the table definitions so the read patterns they serve are
-- visible in one place, and so the migration runner is exercised with more
-- than one file.

-- Briefing index and category pages.
CREATE INDEX idx_articles_pub ON articles(published_at DESC);
CREATE INDEX idx_articles_cat ON articles(category);

-- Ask STAI retrieval freshness.
--
-- This one is not an optimisation, it is the mechanism. Every retrieval query
-- first asks "has the published corpus changed?" via
--
--   SELECT COUNT(*), MAX(updated_at) FROM articles WHERE status='published'
--
-- Both columns are in this index, in this order, so SQLite and D1 answer that
-- question from the index alone and never touch a row — which is the point:
-- the previous fingerprint summed LENGTH(body_md) and therefore read every
-- article body on every question asked. tests/d1-migrations.test.mjs asserts
-- the query plan says COVERING INDEX, so this cannot silently regress into a
-- table scan.
CREATE INDEX idx_articles_fingerprint ON articles(status, updated_at);

-- Prompt library filters.
CREATE INDEX idx_prompts_cat ON prompts(category);
CREATE INDEX idx_prompts_status ON prompts(status);

-- Session lookup on every authenticated request.
CREATE INDEX idx_sessions_user ON sessions(user_id);

-- Analytics roll-ups in /admin/growth.
CREATE INDEX idx_events_created ON events(created_at);
CREATE INDEX idx_events_kind ON events(kind, created_at);

-- One STAI subscription row per Stripe subscription. Payment mutation is
-- frozen; this constraint is part of the schema those frozen writes assume.
CREATE UNIQUE INDEX idx_sub_stripe ON subscriptions(stripe_subscription)
  WHERE stripe_subscription IS NOT NULL;
