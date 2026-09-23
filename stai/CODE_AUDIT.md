# STAI — Code Audit

Audit date: 2026-09-23 · Audited commit: `1a996d2` (main, identical on `claude/stai-platform-build-91qd8l`) · Scope: everything under `stai/` (the platform), including `worker/`, `migrations/`, `scripts/`, `tests/`, `e2e/` and the deployment documents.

**What this is:** a findings document. No production code was changed, nothing was merged or deployed, and the only thing committed is this file. All measurements were taken locally against the real code paths: a production Node build, an in-memory SQLite database built from the real migrations, and a query-counting driver. Everything used for measurement lived in a scratch directory outside the repository. Sabotage checks changed one production file at a time, ran the tests and restored the file; `git status` was clean after each one.

**How confident each finding is:**
- **confirmed**: reproduced or measured during this audit, with the evidence quoted.
- **highly likely**: read in the code and traced end to end, but not executed.
- **needs measurement**: the mechanism is real, but its impact depends on something that could not be measured here, such as production traffic or current Cloudflare limits. `developers.cloudflare.com` is blocked from the audit sandbox.

---

## 1. Executive summary

**Overall: a well-built codebase with a small number of real problems, concentrated in three places.**

The code is not bloated, and it is not the AI-accumulated sprawl the brief warned about. The dead code amounts to roughly 100 lines. The duplication is real but local, and all of it can be fixed mechanically. There is no speculative framework. The public front-end is lean: 102 kB of shared first-load JS and at most 113 kB on any route. The riskiest boundaries are explicit and hold up under the tests: payments are frozen, discovery needs permission, no filesystem is reachable on Workers, and the SQL seam is sound. Comments are dense (about 20% of non-blank lines, and 40–50% in the newsroom modules), but they explain *why* rather than *what*, and they are mostly accurate.

The problems that matter:

1. **Database round trips per request (High, performance, confirmed).** Every public page issues **29–53 SQL queries**. 26 of them are the same 13 settings lookups made twice, once by the Header and once by the Footer. Nothing is memoised per request: there is no `React.cache()` anywhere in the code. On D1 each query is a billed network round trip. A per-request cache for settings and for the current user would bring a typical page down to about 3–6 queries.
2. **Discovery does not scale in its current shape (High, scale, counts confirmed, limit to verify).** One run makes about 10 queries per new item and 3 per open story, *every run, whether or not anything changed*. Measured: 10 sources × 20 items = **2,030–2,826 queries** in a single invocation; 50 × 20 = **10,110**. A run where nothing changed still costs up to about 1,100. That very probably exceeds D1's per-invocation query limit on the scheduled Worker.
3. **Clustering merges unrelated stories from one publisher (High, correctness, confirmed).** When a source puts the same boilerplate in every item's lead, which is realistic for EBA-style press releases, 10 unrelated publications collapse into **one story**. In a 50-source synthetic run, 1,000 items became one story. The IDF weights are computed over *open stories*, and at a cold start that is a single document, so the weights say nothing.
4. **The admin authorisation boundary is untested for signed-in non-admins (High, test quality, confirmed by sabotage).** I removed the `role !== "admin"` check from `/api/admin/settings`, so any signed-in reader could rewrite the site settings. After a rebuild, every test still passed. The 26 admin checks are all present *today*; nothing would notice if one regressed.

Beneath those: a **confirmed open redirect** after login and signup; discovery runs in the same hour **share one run record**, so a failed run can be overwritten as "succeeded"; fetch **redirects are followed without re-checking the domain**; **future-dated feed items** keep full recency for a year; the People register reads a **`users.plan` column that nothing writes** while payments are frozen; and **Next.js 15.5.20 has a patch release (15.5.26)** carrying security advisories. Most of those advisories do not apply here (no Server Actions, unoptimised images).

**There are no Critical findings.** Nothing found is exploitable by an anonymous visitor to cause data loss or privilege escalation today.

---

## 2. Architecture map

```
Browser ──► Cloudflare Worker (OpenNext)                      Cron */30 ──► worker/entry.ts scheduled()
              │  src/middleware.ts  (nonce CSP)                                 │
              │  Next 15 App Router: 41 pages, 32 route handlers                ▼
              │  src/instrumentation.ts registers the runtime driver      src/lib/newsroom/scheduled.ts
              ▼                                                                 │ (installs D1 driver from env)
        src/lib/sql.ts  ◄── ONE SQL seam: sql() from a globalThis symbol       ▼
              │                                                          newsroom/discovery.ts runDiscovery()
     ┌────────┴──────────┐                                                fetcher/probe → feed.ts | extractors/*
  Workers: sql-workers.ts  Node: sql-node.ts                               → normalise → ingest → cluster.ts
  → sql-d1.ts → D1 (DB)    → better-sqlite3 (tests, VPS target)           → relevance.ts gates/score → cap
              │
  Rate limit: ratelimit.ts ─► Workers: RateLimiterDO (SQLite Durable Object, one per bucket:key)
                           └► Node: in-memory store
```

**Sources of truth (each confirmed to have a single owner):**

| Concern | Owner | Notes |
|---|---|---|
| Schema | `migrations/*.sql` (10 files, 36 tables) → embedded by `scripts/sync-sql.mjs` into `src/lib/schema/sql.generated.ts` | Node applies them at boot; D1 through `wrangler d1 migrations` in `cf:deploy` |
| Entitlement | `currentUser()` in `src/lib/auth.ts` (subscriptions + `access_grants` + role) | `users.plan` is **not** a source of truth (see M5) |
| Site switches, copy and limits | `settings` table, read through `src/lib/site-config.ts` (13 toggles) | Defaults live in code; a missing row means the default |
| Article writes | `api/admin/article` (plus the seed SQL) | Single writer, single IndexNow caller: verified |
| Newsroom registry | `newsroom_sources`, written by `store.ts` / the registry UI / `load_proposal` / migration 0010 | Every write path inserts inactive, `fetch_allowed = 0` |
| Payments | `billing-frozen.ts` | Deliberately unreachable while payments are frozen. **Out of scope for changes.** |
| Search index | module-level in `search.ts`, re-validated on every query by a covering-index fingerprint | Correct on multi-isolate Workers |

**Build targets:** `npm run build` produces the Node standalone build (used by tests and the Docker/VPS target). `npm run cf:build` produces the Workers build: it swaps `db.ts` for a throwing stub and **overwrites `.next`**, so the Node server tests fail confusingly until `npm run build` runs again (see L13).

---

## 3. Current quality assessment

| Dimension | Grade | Basis |
|---|---|---|
| Correctness | Good, with 4 real bugs | Clustering (H3), run records (M2), feed dates (M4), plan column (M5) |
| Security | Good | Nonce CSP, httpOnly + Secure + SameSite=lax cookies (verified in the compiled bundle), bcrypt, timing equalisation, sanitised Markdown, rate limits on every public write route, all 26 admin checks present. One open redirect (M1), redirect containment (M3) |
| Performance | Weak on data access, good on the front-end | Queries per request (H1) and per discovery run (H2); JS payload is lean |
| Architecture | Good | Few concepts, clear seams, explicit decisions. Some rules re-implemented inline (domain containment ×3 + 23 inline copies, admin check ×26) |
| Tests | Broad but uneven | 723 + 36 tests, all green. Strong on newsroom logic and fixtures; weak on authorisation of signed-in non-admins, sanitisation, and lookalike-domain rules (sabotage survived 4 of 10) |
| Maintainability | Good | Small dead-code surface, readable modules; 2 files over 800 lines; docs mostly current, 2 stale mentions |
| Dependencies | Fine | 9 runtime dependencies, all used; one patch upgrade outstanding |

---

## 4. Critical issues

**None found.** Two candidates were raised to Critical and then downgraded after checking:
- *Admin bypass:* every admin route and page does check the role (all 26 read). The gap is in the tests (H4), not in the code.
- *Session cookie missing `Secure` on Workers:* `secure: process.env.NODE_ENV === "production"` looked environment-dependent, but the compiled Worker bundle contains `httpOnly:!0,sameSite:"lax",secure:!0` (41 occurrences in `handler.mjs`). It is correct.

---

## 5. High-priority issues

### H1 — 29–53 SQL queries per page, 26 of them duplicate settings reads
- **Type:** performance / efficiency · **Confidence:** confirmed (query counts); latency effect on D1 **needs measurement**
- **Files:** `src/lib/site-config.ts:78,86,122`, `src/components/chrome/Header.tsx:52`, `src/components/chrome/Footer.tsx:44`, `src/app/page.tsx:50`, `src/lib/page-guard.ts`, `src/lib/auth.ts` (`currentUser`), `src/lib/content.ts:133`
- **Evidence:** every statement was counted per request on the real production server:

  | Route | Anonymous | Signed in |
  |---|---|---|
  | `/` | 52 | 53 |
  | `/news` | 30 | – |
  | `/prompts` | 29 | 31 |
  | `/ai-act` | 29 | – |
  | `/plus` | 31 | – |
  | `/account` | – | 33 |
  | 404 | 29 | – |

  `/ai-act` breaks down as 27 × `SELECT value FROM settings WHERE key=?` plus 2 × `SELECT * FROM articles WHERE status='published'`. `enabledMap()` loops over 13 toggles with one query each, and Header and Footer both call it (26), plus `requirePage` (1). The home page calls it a third time and adds `homeCopy()` (8 more). A signed-in request runs `currentUser()` (3 `EXISTS` subqueries) once or twice. There is no `React.cache()` in the codebase; 46 route files are `force-dynamic` (34 of them pages) and none use `revalidate`.
- **Why it matters:** on D1, each query is a billed network round trip from the Worker. Header and Footer run in parallel, so latency is not 27 × serial, but rows-read cost and tail latency scale with the count.
- **Solution:** (1) one `cache()`-wrapped `allSettings()` that runs `SELECT key, value FROM settings` once per request, with `isEnabled`, `enabledMap`, `homeCopy` and `limit` reading from it; (2) wrap `currentUser()` in `cache()`; (3) give list callers of `allArticles()` a narrow projection or a `LIMIT` (see L5).
- **Benefit:** about 29–53 → about 3–6 queries per page. **Risk:** low. Settings stay per-request, so admin changes still show on the next request. **Tests:** a query-budget test that counts statements per route (the harness from this audit is small enough to add as a test), plus the existing site-settings suite.

### H2 — A discovery run issues thousands of queries in one invocation
- **Type:** performance / scalability · **Confidence:** confirmed (counts); the Cloudflare per-invocation query limit **needs verification** (my recollection is 1,000 queries per invocation on the paid plan and 50 on the free plan; the docs could not be fetched from the sandbox)
- **Files:** `src/lib/newsroom/discovery.ts:232` (per-item `url_hash` lookup), `:306`/`:577` (`openClusters()` inside the per-item loop), the evaluate loop (2 SELECTs + 1 UPDATE per open story, up to 300 stories), the cap/disqualify UPDATE loops
- **Evidence:** the real `runDiscovery` was run against the migrated schema with a counting driver:

  | Run | SQL calls |
  |---|---|
  | 5 sources × 10 items, all new | 520 |
  | 10 × 20, all new (shared lead / distinct leads) | 2,030 / 2,826 |
  | 50 × 20, all new | 10,110 |
  | 10 × 20, **nothing new** (200 open stories) | 231 / 1,027 |
  | 50 × 20, nothing new | 1,111 |

  That is about 10 round trips per new item. `openClusters()` re-reads up to 400 stories and their members for *every* fresh item.
- **Why it matters:** the cron runs every 30 minutes on the Worker. Once the registry has more than a handful of active sources, or a few hundred open stories, a run can hit the platform limit partway through. The run then dies without reaching its `catch`, which leaves a `running` row (see M2).
- **Solution, keeping the logic unchanged:** read `url_hash`es for a source's batch in one `IN (...)` query; load open clusters once per run and update them in memory as items attach; evaluate with set-based reads (one query for all members of the open stories) and write the results with `batch()`; skip evaluation entirely when nothing was ingested and nothing aged out of a window.
- **Benefit:** a no-change run falls to tens of queries, and a first ingest to about 2–3 per item. **Risk:** medium, because the orchestrator is central. The existing 868-line `discovery-run` suite covers its behaviour. **Tests:** add a query-budget assertion to `discovery-run`.

### H3 — Clustering merges unrelated items that share publisher boilerplate
- **Type:** correctness · **Confidence:** confirmed with realistic synthetic data; not yet observed on live feeds, because no live feed has been ingested at scale
- **Files:** `src/lib/newsroom/cluster.ts:119–126` (`weightedOverlap`, IDF `Math.log(1 + docs / (1 + df))` computed over **open stories**), `:213`, `MATCH_THRESHOLD = 0.42` (`:134`)
- **Evidence:** 10 unrelated EBA-style publications (stress-test results, a crypto RTS, an AML peer review, ML in credit risk, …), each with the standard EBA lead sentence, clustered into **1 story** at 55–71% overlap, with the reason given as "shares EBA". 50 sources × 20 items with a shared lead gave 1,000 items → **1 story**. The same volume with distinct leads gave 200 → 200 correct stories. The earlier "EBA runaway" fix (oldest member as the representative, a 3-day same-development window) reduced the problem but did not remove it.
- **Root cause:** when there are 0–1 open stories, every term has the same IDF, so boilerplate weighs as much as the subject. The first boilerplate story then absorbs everything after it, and its document frequency never rises enough to be discounted.
- **Solution (pick one after discussion):** compute document frequency over *items* (the current batch plus recent items) rather than stories; weight titles above leads; or require a title-level match for two items from the same source. This is a judgement call about editorial behaviour, so it should be agreed before it is built.
- **Risk:** medium, because it changes which stories exist. **Tests:** add the EBA-like fixture and the shared-boilerplate batch as regression tests; the existing clustering tests must stay green.

### H4 — Admin authorisation is not tested against signed-in non-admins
- **Type:** test quality (security regression risk). **The code is correct today.** · **Confidence:** confirmed by sabotage
- **Files:** 26 inline `role !== "admin"` checks under `src/app/api/admin/**` and `src/app/admin/**`; tests in `tests/site-settings.test.mjs:244`, `newsroom-admin`, `discovery-run`, `admin-register`
- **Evidence:** changing `if (!user || user.role !== "admin")` to `if (!user)` in `src/app/api/admin/settings/route.ts`, rebuilding, and running `site-settings` and `discovery-run` gave **55/55 pass**. The 403 tests are almost all *anonymous*; only `/api/admin/access` and `/api/admin/prompt` are tested with a signed-in member. `/api/admin/podcast` and the `/admin/settings` page have no test references at all.
- **Solution:** add a `requireAdmin()` helper (a mechanical replacement for the 26 copies), plus **one table-driven test** that walks every `src/app/api/admin/**/route.ts` and `src/app/admin/**/page.tsx` with a signed-in *member* cookie and expects 403 or a redirect. Because the test enumerates the filesystem, a new admin route cannot be added without it being covered.
- **Benefit:** closes the one gap where a one-character regression means privilege escalation. **Risk:** very low.

---

## 6. Performance findings

| ID | Finding | Evidence | Confidence |
|---|---|---|---|
| H1 | 29–53 queries per page | Section 5 | confirmed |
| H2 | 520–10,110 queries per discovery run | Section 5 | confirmed |
| P1 | `allArticles()` is `SELECT *` including full Markdown bodies, used for lists that show 4–6 cards (`page.tsx`, `not-found.tsx`, `ai-act`, category, authors, feed, sitemap) | `src/lib/content.ts:133–136`; callers `slice`/`filter` in JavaScript | confirmed; cost grows with the corpus |
| P2 | `newsroom_story_sources` has only its PK `(story_id, source_item_id)`, so a lookup by `source_item_id` scans the table | at 300k rows: **3.438 ms scan vs 0.003 ms with an index (1,120×)**; on D1 every scanned row is billed | confirmed (benchmark); the current table is small |
| P3 | Events retention runs `if (Math.random() < 0.001) await pruneOldEvents()` *inside* `/api/track` | `src/app/api/track/route.ts:51`. One visitor in 1,000 waits for a `DELETE` across `events` | confirmed in code; low impact |
| P4 | Login purges expired sessions with an unindexed `DELETE … WHERE expires_at <= now` | `src/lib/auth.ts:77`; there is no `sessions(expires_at)` index | confirmed; small table |
| P5 | `currentUser()` entitlement subquery scans `subscriptions` because there is no `user_id` index | `EXPLAIN QUERY PLAN` shows `SCAN sub` twice | confirmed; **latent** (empty while billing is frozen) |

What was measured and is **fine**: first-load JS is 102 kB shared, 103–113 kB per route (38 client components, all small except admin tools). Canvas animations pause off-screen and when the tab is hidden, and respect `prefers-reduced-motion`. The search index re-validates with a *covering-index* aggregate (asserted by a test). The seed corpus (about 1,700 lines) is not in the Worker bundle.

---

## 7. Dead-code findings

Method: TypeScript program plus checker symbol resolution (following aliases and re-exports), then a text search of each candidate across `src/`, `worker/`, `scripts/`, `e2e/` and `tests/`, then a manual check for framework conventions and dynamic `import()`.

**Dead (no production caller and no test):** about 100 lines

| File | Symbols |
|---|---|
| `src/lib/newsroom/store.ts` | `discoveryFeedbackCount`, `feedbackForStory`, `fetchesForSource`, `recentFetches`, `recentProbes`, `recordDecision`, `storiesInState` (44 lines) |
| `src/lib/newsroom/sources.ts` | `LIVE_LABEL`, `LIVE_MEANING`, `REVIEW_LABEL`, `REVIEW_MEANING`. `SourceRegistry.tsx` hand-types its own copies (`REVIEW_OPTIONS`, `STATUS_STYLE`); see duplication |
| `src/lib/newsroom/discovery.ts` | `export const stateChangesAreNotDiscoverysJob = moveStory`. Its comment says it is "exported so the boundary is testable", but no test imports it. It exists only to keep an unused import alive |
| `src/lib/content.ts` | `ENFORCEMENT_ISO` |
| `src/lib/format.ts` | `fmtDateShort` |
| `src/lib/indexnow.ts` | `indexNowConfigured` |
| `src/lib/migrate-node.ts` | `resetSeedTracking` |
| `src/lib/newsroom/state.ts` | `isFailureState`, `RESTING_STATES` |
| `src/lib/newsroom/budget.ts` | `isPipelineStage` |
| `src/lib/billing.ts` | `hasEntitlement`, `latestSubscription`: **payment area, frozen. Leave as is.** |

**Used only by tests** (keep, or inline into the test): `fetcher.SKIP_OUTCOMES`, `jurisdictions.serialiseJurisdictions` (production calls `JSON.stringify` directly, so the tested function is not the one used), `state.mayAutoPublish`, `budget.callCostCents`.

**Checked and NOT dead** (false positives from static analysis): `ensureAdminAccount`, `registerNodeSql`, `registerWorkersSql` and `registerWorkersRateLimit` (dynamic `import()` in `instrumentation.ts`); every export of `db-unavailable.ts` (it must mirror `db.ts` for the build-time module swap); `src/lib/seed/*` (used by `scripts/generate-seed.mjs`); all 32 route handlers (reached by the UI, by monitoring, or by Stripe, which is frozen).

**Schema columns never referenced in code:** 28. Of these, 22 belong to Phase-3 tables built ahead of time (`ai_reviews`, `drafts`, `evidence_packs`, `evidence_claims`), which is intentional scaffolding. The others are `newsroom_source_items.raw_object_key` and `purge_after`, and `newsroom_stories.novelty_score`. Leave them; dropping columns on D1 is not worth the migration risk.

Also noted: 128 values are exported but used only inside their own file (over-exported, not dead), and 226 exported types are unused. Tidying those is optional (Phase D).

---

## 8. Duplication findings

| Duplication | Size | Recommendation |
|---|---|---|
| Extractors: `findDocument` ×6 (identical), `isXDocument` ×4 (differ only in `DOMAIN`), `xLead` ×4 (identical), `xCategory` ×4 (differ only in the table), `plausibleXTitle` ×5 (differ only in `FURNITURE`), host check `host !== DOMAIN && !host.endsWith(...)` pasted **23 times** | about 170–200 lines | Five **mechanical** helpers in `extractors/html.ts`: `onDomain(url, domain)`, `isDocumentOn(domain)`, `leadAfter(block, title)`, `categoryFrom(block, table)`, `plausibleTitle(t, furniture)`. **Do not** build a shared `extract()` loop. That would be the generic scraper the operator has ruled out; each site's judgement (what counts as an item, which exclusions apply) must stay in its own file. |
| Domain containment implemented 3 times (`sources.feedUrlBelongsTo`, `hydrate.sameRegisteredDomain`, `extractors/index.extractorFor`) plus the 23 inline checks above | about 40 lines | All of them currently fail closed and reject userinfo and lookalike suffixes. They differ only in whether they require https. One `belongsToDomain(url, domain, {https})` function makes the rule impossible to get subtly wrong in the next extractor. It matters more because two of the three copies are untested (T2). |
| Admin check ×26 | 26 × 3 lines | `requireAdmin()` as part of H4 |
| Review/live labels: dead in `sources.ts`, hand-typed again in `SourceRegistry.tsx` | about 30 lines | Import the `sources.ts` versions into the component |
| Jurisdiction JSON parsed inline twice in `discovery.ts` although `parseJurisdictions()` exists | about 10 lines | Use the helper |

**Deliberately not recommended:** merging the tokenisers in `cluster.ts` and `search.ts`. They have different jobs and different stop lists, and sharing them would couple ranking to clustering.

---

## 9. Database findings

- **Missing indexes** (one additive migration, zero behaviour change): `newsroom_story_sources(source_item_id)` (P2), `sessions(expires_at)` (P4), `subscriptions(user_id)` (P5, latent).
- **Foreign keys are enforced** in both drivers. Verified.
- **Unbounded growth, M8:** `newsroom_fetch_log` gains one row per active source per run, about 2,400 rows a day at 51 sources (about 900k a year). `newsroom_pipeline_events` and `newsroom_source_items` grow without bound too. The per-source `snapshot_retention` is collected, validated, stored and displayed, **but never enforced**: there is no purge job anywhere. `events` has a 12-month prune, but it runs on the request path (P3).
- **Temp B-tree sorts** on `allArticles`, the covered-titles query and the open-stories query. Negligible at current sizes; the P1 projection work removes the article one.
- **Scale to hundreds of sources and hundreds of thousands of items:** the schema holds up with the three indexes above. What does *not* hold up is the access pattern in H2 (per-item and per-story round trips) and the absence of retention (M8). The UNIQUE `url_hash` and `content_hash` design for deduplication and revisions is sound.

---

## 10. Workers / Cloudflare findings

- **H2** is primarily a Workers problem: per-invocation query limits and wall-clock on the scheduled handler.
- **M2 (run records):** the cron fires every 30 minutes, but the idempotency key is hourly (`run-keys.ts`: `workflow + ISO hour`). See section 12.
- **Bundle:** `handler.mjs` is 6,682 KB raw / **1.54 MB gzipped**, within Workers limits. The large parts are Next server chunks (3,788 KB), `next/og` `ImageResponse` (337 KB, used by `briefing/[slug]/opengraph-image`), the Stripe SDK (216 KB, dormant, and frozen by instruction), the Anthropic SDK (161 KB, used by Ask), and marked + sanitize-html + postcss (about 190 KB, one page). No action is recommended now; cold start is not measurably a problem.
- **Durable Object rate limiter (L7):** one DO per `bucket:key`, and rows never expire. Storage grows with distinct IPs, slowly and cheaply. An alarm-based cleanup is optional.
- **Correct and worth keeping:** no filesystem fallback on Workers (`db.ts` is swapped for a throwing stub at build time); the cron path reads D1 from `env` without an HTTP hop or a shared secret; the module-level `cronEnv` is refreshed on every run; the search index cannot serve stale results across isolates.

---

## 11. Front-end findings

- Lean: 102 kB shared JS, with the heaviest public route (`/assessment`, `/news`) at 113 kB. No bundle-bloat finding.
- 38 `"use client"` modules, mostly forms and admin tools. `SourceRegistry.tsx` (929 lines) is the largest file in the repository; split it by concern (list, row editor, filters) only when it is next touched (Phase D).
- **L10:** `authors/[slug]` and `briefing/category/[category]` combine `generateStaticParams` with `dynamic = "force-dynamic"`. The build lists them as SSG (●), but nothing is prerendered (`prerender-manifest.json` has no such routes), so `generateStaticParams` does nothing there. Remove it to stop the build output misleading.

---

## 12. Security findings

### M1 — Open redirect after login and signup
- **Confidence:** confirmed in Chromium against the production build
- **File:** `src/components/auth/AuthForm.tsx:10,30`: `const next = params.get("next") ?? "/account"` → `router.push(next)`
- **Evidence:** `/signup?next=https://attacker.example/phish`, then a successful signup, left the browser at **`https://attacker.example/phish`**. `/login` behaves the same way.
- **Why:** a convincing phishing chain ("your session expired, sign in again") that starts on the real domain. **Fix:** accept `next` only if it starts with `/` and not with `//` or `/\`; otherwise use `/account`. 3 lines. **Test:** a unit test of the validator, plus one e2e assertion.

### M3 — Fetch redirects are followed without re-checking the domain
- **Confidence:** confirmed in code (`redirect: "follow"` at `fetcher.ts:227`, `probe.ts:166`, `extractors/hydrate.ts:189`); not exploited
- Domain containment is checked on the *requested* URL only. A registered source whose URL redirects off-domain (compromised, expired, or a CDN change) has the redirected content ingested **under that source's authority tier**. On the RSS/JSON path, `res.url` is never checked. On a Node/Docker deployment, a redirect could also reach internal addresses. On Workers, only the public internet is reachable. Every source is admin-registered, so this is not open SSRF.
- **Fix:** use `redirect: "manual"` and follow at most N hops, running the same `belongsToDomain` check on each hop. Failing loudly matches the standing "no silent fallback" rule.

### Other security notes
- **L6:** session tokens are stored in plain text in `sessions`, so a database leak means live sessions. Store `sha256(token)` instead: a one-function change, but it invalidates existing sessions once. Low.
- **L8:** `clientIp` falls back to `X-Forwarded-For` when `cf-connecting-ip` is absent, so the rate-limit key can be spoofed on the Node target only. Low.
- **M6 (dependency):** see section 14.
- **Verified correct:** nonce CSP with `strict-dynamic`; `frame-ancestors 'none'`; the cookie flags (section 4); bcrypt with absent-user timing equalisation; minimum password length of 8; login limited to 10 per 10 minutes per IP; every public mutating route rate-limited; Markdown sanitised with an allowlist that has no SVG and no `javascript:`/`data:` schemes; JSON-LD escapes `<`; feed item URLs outside http(s) dropped at normalisation, so no `javascript:` links reach admin pages; no secrets in logs; payment mutation unreachable.

### M2 — Runs in the same hour share one record; a failure can be erased
- **Type:** correctness / observability · **Confidence:** confirmed
- **Files:** `src/lib/newsroom/run-keys.ts` (`idempotencyKey = workflow:YYYY-MM-DDTHH`), `discovery.ts:77–99` (`openRun` does `ON CONFLICT DO NOTHING`, then **proceeds anyway**)
- **Evidence:** runs at 10:05 and 10:35 both returned **run id 1**; there was one row in `newsroom_pipeline_runs`, and the fetch-log rows from both runs sat under that id. Because `closeRun` overwrites `status` and `error`, a failed :05 run is marked `succeeded` with an empty error by the :35 run. A run killed by a platform limit (H2) never reaches `catch` and stays `running` until the same thing happens. There is no overlap lock, so a manual "Discover now" can run at the same time as the cron.
- **Fix:** make the key per invocation (a timestamp or UUID), and turn the hourly key into a real lease: `INSERT … WHERE NOT EXISTS (running AND started_at > now − 15 min)`, and skip the run if the insert does nothing. Mark stale `running` rows as `abandoned` on the next run.

---

## 13. Test-quality findings

**Baseline:** 723 Node tests (148 s) and 36 Workers tests (122 s), all passing; about 13,000 lines of tests against about 22,700 lines of code.

**Sabotage results** (one production change at a time, then restored):

| # | Sabotage | Result |
|---|---|---|
| S1 | cluster `MATCH_THRESHOLD` 0.42 → 0.15 | caught (3 failures) |
| S2 | `sources.feedUrlBelongsTo` accepts a lookalike suffix (`evilefrag.org`) | caught (1) |
| S3 | `hydrate.sameRegisteredDomain` accepts a lookalike suffix | **survived** (194/194) |
| S4 | `extractorFor` accepts a lookalike suffix | **survived** (194/194) |
| S5 | FRC `MEDIA_KINDS` rule disabled | caught (3) |
| S7 | fetcher ignores `fetch_allowed` | caught (2) |
| S8 | normalise accepts any URL scheme | caught (1) |
| S9 | Markdown sanitiser allows `javascript:` and vulnerable tags | **survived** (723/723): no test touches `markdown.ts` |
| S10 | `/api/admin/settings` admin check removed (rebuilt) | **survived** (55/55); see H4 |

- **T1 (High):** H4.
- **T2 (Medium):** S3, S4 and S9 are security rules with no test that fails when they break. Add: lookalike-domain cases for `hydrate` and `extractorFor` (4 assertions), and a `renderMarkdown` test with `<script>`, `javascript:` links, `onerror` and SVG (5 assertions).
- **T3 (Medium):** these have no regression tests: shared-boilerplate clustering (H3), a query-count budget per page and per run (H1/H2), redirect containment (M3), future-dated feed items (M4), open redirect (M1), and same-hour runs (M2).
- **T4 (Low):** about 10 tests assert on the *source text* of production files (`readFileSync` + regex): `workers-boundary`, `payment-confirmation`, `prompt-cms`, `retrieval-freshness`, `discovery-run`, `seo`, `theme-tokens`, and the Add Source form in `newsroom-admin`. The boundary ones (no `better-sqlite3` reachable, frozen billing, no secret in the cron path) are legitimate structural guards: keep them. A few check that a function body contains a SQL string (for example `status='published'` in `allPrompts`); those break on a rename and pass when the logic moves. Replace them with behavioural tests when those areas are next touched. None should be deleted.
- **L13 (Low):** running `cf:build` leaves a Workers `.next` behind, and the Node server suites then fail with "unable to open database file" 500s rather than a clear message. A 5-line guard in the shared server helper ("`.next` is a Workers build; run `npm run build`") would save a confusing debugging session.

---

## 14. Dependency findings

Runtime dependencies (9): `next`, `react`, `react-dom`, `@anthropic-ai/sdk` (Ask/Adapt), `bcryptjs`, `better-sqlite3` (Node driver and tests only; not in the Worker), `marked` and `sanitize-html` (one page), `stripe` (frozen; keep). All are used, and none are redundant.

- **M6 (Medium, dependency):** `npm audit --omit=dev` reports `next` 15.5.20 in the range of several advisories, fixed in **15.5.26 (a patch release)**: a DoS and SSRF in Server Actions, cache confusion for requests with bodies, and transitive `postcss`, `sharp` and `nanoid` issues. **Applicability checked:** the app has **no Server Actions** (0 `"use server"`), `images.unoptimized: true` (so `sharp` is not used at runtime), and `postcss` runs only at build time. The cache-confusion advisory has not been assessed against OpenNext's cache. `sanitize-html` ≤ 2.17.6 has an SVG SMIL bypass; the allowlist permits no SVG tags, so it is not exploitable here, but take the patch.
  **Recommendation:** upgrade `next` and `eslint-config-next` to 15.5.26 and `sanitize-html` to its latest 2.x, then run the full Node and Workers suites and `cf:build`. Do not `npm audit fix --force`.
- Dev dependencies are all used. `@types/node` is `^20` while the runtime is Node 22 (cosmetic).

---

## 15. Maintainability findings

- **Size:** about 22,700 lines of code, 5,800 comment lines, and 13,000 test lines. The largest files are `SourceRegistry.tsx` (929 lines), `store.ts` (844), `proposed-sources.ts` (781, data), `discovery.ts` (724) and `apas.ts` (639). Only `SourceRegistry.tsx` and `discovery.ts` do too many things; split them only as part of H2 or when they are next touched.
- **Comments:** 20% overall and 40–53% in the newsroom and rate-limit modules. They are good-quality *why* comments. 32 lines narrate history ("an earlier version…"), which belongs in commit messages; trim them when editing those files, not as a project of its own.
- **M5 — `users.plan` is read but never written (correctness):** the People register (`src/lib/admin-datasets.ts:81–94`) filters and displays `users.plan`. The only writer is `billing-frozen.ts` (`UPDATE users SET plan=?`), which is dormant. So granted readers and admins show as "Free", and the STAI+ filter matches nobody. **Fix:** derive the column from the same `ENTITLEMENT_SQL` + `GRANT_SQL` expressions `currentUser()` uses (`CASE WHEN EXISTS … THEN 'plus' ELSE 'free' END`), and leave the frozen billing code untouched.
- **M4 — Future-dated feed items (correctness):** `parseFeedDate` (`src/lib/newsroom/feed.ts:174–183`) accepts any date up to the end of the year after next (`year > currentYear + 2` is the only upper bound) and parses numeric dates month-first through `Date.parse`. Demonstrated: a `pubDate` of 2027-10-01 passes every gate and scores 53, the same as an item 2 hours old, and holds that rank for about 13 months. `"02/01/2026"` becomes 1 February (the EU reading is 2 January). The HTML extractors' `iso()` already rejects dates more than 2 days in the future. **Fix:** apply the same `> now + 2 days` rule in `parseFeedDate`, and reject ambiguous all-numeric dates rather than guessing.
- **M8 — Retention promised but not enforced:** see section 9. Operators set `snapshot_retention` per source for licensing reasons, and the system silently ignores it. **Fix:** a purge step at the end of the discovery run (bounded, batched), which also absorbs the `events` prune (P3).
- **Docs:** mostly current. `DISCOVERY.md:120` and `PHASE_2_5_EXTRACTORS.md:220` still list H3C as a live source. `DEPLOY.md`, `Dockerfile` and `docker-compose.yml` describe a VPS/Docker target: **decision needed** on whether it is still supported. If not, retire those three files and keep the Node driver, which the tests need. If it is, M3 and L8 matter more there.

---

## 16. Things that looked suspicious but were correct

| Looked like | Actually |
|---|---|
| Session cookie `secure` depends on `NODE_ENV` | Inlined as `secure:!0` in the compiled Worker bundle (41 occurrences) |
| Module-level `_index` in `search.ts` on multi-isolate Workers | Re-validated on every query by a covering-index fingerprint; asserted by a test |
| Module-level mutable `cronEnv` in `scheduled.ts` | A fallback only, refreshed on every scheduled invocation |
| `db-unavailable.ts` exports that nothing imports | Must mirror `db.ts` for the build-time module swap |
| `src/lib/seed/*` (about 1,700 lines) unimported | Used by `scripts/generate-seed.mjs`; correctly kept out of the Worker |
| `instrumentation.ts` registrars look unused | Reached by dynamic `import()` |
| Rate limiter "fails open" on a DO error | It degrades to the in-memory store: weaker, not open |
| `dangerouslySetInnerHTML` (2 uses) | Sanitised Markdown with a strict allowlist, and JSON-LD with `<` escaped |
| No `requireAdmin` helper, so some admin route might be unprotected | All 26 checks read and present (the *tests* are the gap: H4) |
| Unused Phase-3 tables and columns | Intentional scaffolding for the planned phase; D1 column drops are not worth the risk |
| Stripe SDK in the Worker bundle | Dormant by explicit decision; payment code must stay unreachable and unchanged |
| Eight extractors with near-identical loops | Per-site judgement is the point; only the mechanical helpers should be shared (section 8) |
| Migration 0010 inserts a row | Only where H3C exists (a succession, not seeding), and it inserts dormant |

---

## 17. Performance and size baseline (for measuring any change)

| Metric | Value |
|---|---|
| Node tests | 723 pass, 148 s |
| Workers tests | 36 pass, 122 s |
| Typecheck / lint / Node build | 3 s / 6 s / 83 s |
| First-load JS | 102 kB shared; routes 103–113 kB |
| Worker `handler.mjs` | 6,682 KB raw / 1.54 MB gzipped |
| Queries per request | `/` 52 · `/news` 30 · `/prompts` 29 · `/ai-act` 29 · `/plus` 31 · 404 29 · signed-in `/` 53 · `/account` 33 |
| Queries per discovery run | 5×10 new: 520 · 10×20 new: 2,030–2,826 · 50×20 new: 10,110 · 10×20 no change: 231–1,027 · 50×20 no change: 1,111 |
| `story_sources` lookup at 300k rows | 3.438 ms scan → 0.003 ms with an index |
| Code / comments / tests | 22,731 / 5,774 / about 13,000 lines |
| Client components · pages · route handlers | 38 · 41 · 32 |
| Sabotage survival | 4 of 10 |

---

## 18. Recommended remediation plan

Every phase ends with: `npm run typecheck && npm run lint && npm run build && npm test && npm run test:workers`, then `npm run cf:build` followed by `npm run build` again, so that the Node build is what is left in `.next`.

### PHASE A — Safe cleanup and missing tests (no behaviour change except the two small fixes)

| Item | Files | Risk | Code Δ | Perf | Tests required |
|---|---|---|---|---|---|
| A1 Admin authorisation test (table-driven, member cookie, walks the filesystem) | new `tests/admin-authz.test.mjs` | none | +80 test lines | – | itself; confirm it fails with the S10 sabotage |
| A2 Sanitiser and lookalike-domain tests (S3, S4, S9) | `tests/extractors.test.mjs`, new markdown test | none | +40 | – | confirm each fails under its sabotage |
| A3 Open-redirect fix (M1) | `AuthForm.tsx` | very low | +5 | – | validator unit test + one e2e check |
| A4 Remove dead code (section 7, excluding billing) | `store.ts`, `sources.ts`, `discovery.ts`, `content.ts`, `format.ts`, `indexnow.ts`, `migrate-node.ts`, `state.ts`, `budget.ts` | very low | −100 | – | full suite |
| A5 Stale docs; inert `generateStaticParams`; `.next` build-type guard in test helpers | `DISCOVERY.md`, `PHASE_2_5_EXTRACTORS.md`, 2 pages, test helper | none | ±15 | – | full suite |
| A6 Patch upgrades: `next` / `eslint-config-next` 15.5.26, `sanitize-html` latest 2.x | `package.json`, lockfile | low | 0 | – | full Node + Workers suites + `cf:build` |

### PHASE B — Performance

| Item | Files | Risk | Code Δ | Perf | Tests required |
|---|---|---|---|---|---|
| B1 Per-request settings cache (one query) | `site-config.ts`, `settings.ts` | low | about +15 / −10 | 26–39 fewer queries per page | query-budget test per route; `site-settings` suite |
| B2 `cache()` around `currentUser()` | `auth.ts` | low | +3 | 3–6 fewer queries per signed-in page | `entitlement`, `access-grants` |
| B3 Narrow article projections and limits for list callers | `content.ts` + 6 callers | low | about +20 | fewer bytes and rows read | `seo`, `free-launch` |
| B4 Indexes: `story_sources(source_item_id)`, `sessions(expires_at)`, `subscriptions(user_id)` | new migration 0011 | very low | +6 SQL | scan → seek | `d1-migrations` (plan assertions) |
| B5 Batch discovery reads and writes (H2) | `discovery.ts` | medium | about ±150 | about 10× fewer queries per run | query budget in `discovery-run`; the whole suite unchanged |
| B6 Move the `events` prune from the request path into the cron | `track/route.ts`, `scheduled.ts` | low | ±10 | – | analytics tests |

### PHASE C — Correctness and structural fixes

| Item | Files | Risk | Code Δ | Tests required |
|---|---|---|---|---|
| C1 Clustering fix (H3). **Agree the approach first.** | `cluster.ts` | medium | about ±40 | EBA fixture + shared-boilerplate batch; existing cluster tests |
| C2 Run record per invocation + lease/overlap lock + stale `running` → `abandoned` (M2) | `run-keys.ts`, `discovery.ts` | low–medium | about +30 | same-hour and overlap tests |
| C3 Manual redirect with a per-hop domain check (M3) | `fetcher.ts`, `probe.ts`, `hydrate.ts` | low | about +40 | off-domain redirect tests for each path |
| C4 Future-date and ambiguous-date guard in `parseFeedDate` (M4) | `feed.ts` | low | +10 | future and ambiguous date cases |
| C5 Derive "plan" in the People register from entitlement (M5) | `admin-datasets.ts` | low | about +10 | `admin-register` with a granted user |
| C6 Enforce retention + bounded log purge (M8) | `discovery.ts` / `scheduled.ts`, `store.ts` | medium (deletes data: dry-run first) | about +60 | purge tests on each retention value |
| C7 `requireAdmin()` + one `belongsToDomain()` + the 5 mechanical extractor helpers | admin routes, `sources.ts`, `hydrate.ts`, `extractors/*` | low (A1 and A2 guard it) | about −200 | A1, A2 and the extractor suites must stay green |

### PHASE D — Optional

- Hash session tokens (L6; logs everyone out once).
- Alarm-based expiry for rate-limiter Durable Objects (L7).
- Decide whether the Docker/VPS target stays. If it goes, retire `DEPLOY.md`, `Dockerfile` and `docker-compose.yml`, and drop the `X-Forwarded-For` fallback (L8).
- Split `SourceRegistry.tsx`; reduce over-exported symbols; trim history-narration comments.
- Replace brittle source-text tests with behavioural ones as their areas are touched (T4).

---

## 19. Expected result

- **Requests:** about 29–53 → about 3–6 queries per page, a roughly 90% cut in D1 round trips and rows read on every public view.
- **Discovery:** a no-change run falls from up to about 1,100 queries to tens; a first ingest to about 2–3 queries per item. The cron stays inside platform limits as the registry grows toward hundreds of sources. Run history becomes truthful (one row per run, failures preserved).
- **Correctness:** unrelated publications stop merging into one story; future-dated items stop pinning the top of the Inbox; the People register shows real access levels; retention settings mean what they say.
- **Security:** the open redirect is closed; redirects cannot carry content across domains; the admin boundary, sanitiser and domain rules are protected by tests that demonstrably fail when they are broken (sabotage survival 4/10 → 0/10).
- **Code size:** about −100 lines of dead code and about −200 lines of duplication, against about +300 lines of new tests. Net production code shrinks by roughly 1.5%. This codebase does not need a large reduction; it needs its data access fixed.
