-- Sections, and podcast audio.
--
-- Two product changes, one migration:
--
-- 1. The desk's writing splits into News and Insights. This is a new axis, not
--    the existing `category` column — a piece can be Regulation and still be
--    either a timely item or a standing analysis, and the five categories are
--    already load-bearing on the category pages. `kind` is that second axis.
--
--    Defaulting to 'news' is deliberate: every existing piece keeps appearing
--    where it appears today, and moving one to Insights is an editorial act
--    someone performs, not something a migration guesses. The article's URL
--    does not contain the kind, so re-classifying never breaks a link.
--
-- 2. Podcast episodes gain an audio URL. Episodes are published on an external
--    host — that host provides the RSS feed Apple and Spotify consume — and
--    this column holds the link back, so the hub can offer a player instead of
--    a description of one.
--
-- Additive only: every statement is an ADD COLUMN with a default, so applying
-- this to the live database cannot fail on existing rows and cannot lose data.

ALTER TABLE articles ADD COLUMN kind TEXT NOT NULL DEFAULT 'news';

-- Serves /news and /insights, which are the same query with a different kind.
CREATE INDEX idx_articles_kind ON articles(kind, published_at DESC);

ALTER TABLE podcasts ADD COLUMN audio_url TEXT NOT NULL DEFAULT '';

-- Episodes get the same draft/published gate as articles and prompts, so a
-- half-written show note is never public. Existing episodes stay visible.
ALTER TABLE podcasts ADD COLUMN status TEXT NOT NULL DEFAULT 'published';
ALTER TABLE podcasts ADD COLUMN updated_at TEXT;
