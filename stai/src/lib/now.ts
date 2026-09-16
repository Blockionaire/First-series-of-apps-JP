/**
 * The timestamp expression used for every `updated_at` write.
 *
 * Millisecond resolution, and load-bearing for articles: the Ask STAI
 * retrieval index detects a changed corpus by comparing COUNT(*) and
 * MAX(updated_at) over published articles. At `datetime('now')`'s one-second
 * resolution, two saves inside the same second would leave the fingerprint
 * unchanged and an isolate would keep serving a stale index.
 *
 * Kept in one place so an admin route cannot accidentally stamp a coarser
 * timestamp than the fingerprint relies on. tests/retrieval-freshness.test.mjs
 * asserts every article write path uses it.
 */
export const NOW_MS = "strftime('%Y-%m-%dT%H:%M:%fZ','now')";
