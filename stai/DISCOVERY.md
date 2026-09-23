# Running the discovery dry run

Phase 2 of the Intelligence Engine is built: the newsroom finds things,
recognises that several reports are one development, applies the relevance
gates and shows what it **would** have researched. It researches nothing,
writes nothing and publishes nothing.

This is the operating guide. The design lives in `INTELLIGENCE_ENGINE.md`.

---

## 1. What runs, and what does not

| Stage | Phase 2 |
|---|---|
| Fetch registered, activated, retrieval-approved sources | **yes** |
| Normalise, deduplicate, cluster into stories | **yes** |
| Relevance gates, ranking, daily cap | **yes** |
| Research, evidence packs, drafts, articles, publication | **no** |
| Any model call, any AI spend | **no** |

The gates and the ranking are **deterministic** in this phase. The masterplan
eventually scores with a model; doing that here would change two variables at
once — if a candidate list looks wrong, it should be wrong because of a gate,
not because of a prompt. Two weeks of your verdicts are also the material
needed to write that prompt well. `scoreStory()` in
`src/lib/newsroom/relevance.ts` is the seam phase 3 replaces.

---

## 2. Manual Cloudflare configuration

Two things, and **no secret to manage**.

The scheduled run calls the discovery service directly from the Worker's
`scheduled()` handler. There is no public endpoint that starts a crawl, so
there is nothing to protect with a shared token. The manual "Run discovery
now" button goes to `/api/admin/newsroom/discover`, which requires an admin
session like every other admin route.

### 2.1 Switch discovery on

`/admin/settings` → **Newsroom discovery (scheduled)**. It ships **off**.

This is the control that starts and stops the crawl, and it needs no deploy.
The trigger can be live for weeks while this is off: it fires, finds discovery
switched off, logs why and does nothing. Same rule as the source registry,
applied to the schedule.

Switching it off does **not** disable the manual run button — that is an
operator deliberately asking for one run.

### 2.2 The cron trigger

`wrangler.jsonc` now declares the schedule, so `wrangler deploy` registers it.
Confirm it afterwards under Workers & Pages → stai → Settings → **Triggers** →
Cron Triggers. The declared schedule is:

```
*/30 * * * *     every 30 minutes
```

Per-source cadence is enforced inside the run (Tier 1 every 30 minutes, Tier 2
hourly, Tier 3 every two hours), so a half-hourly trigger does **not** mean
every source is fetched every half hour. Most firings skip most sources, which
is the intent.

To pause discovery: switch **Newsroom discovery (scheduled)** off in site
settings. No deploy, effective on the next firing. Deleting the trigger works
too and is the heavier option.

### 2.3 Check the outbound request budget

A run makes at most one request per due source. With all 51 proposed sources
active that is well inside the Workers free-plan subrequest limit, but if you
later add many more, check Workers → Limits. The run also holds a Worker
invocation open for the duration of the fetches; each fetch is capped at 15
seconds.

---

## 3. Before starting the dry run

1. **Register the sources.** `/admin/editorial/sources` → "Register 51
   proposed sources (inactive)". Nothing is fetched by this.

2. **Approve retrieval, source by source.** Each row has two independent
   switches:
   - **Retrievable** — you have checked that this site's robots.txt and terms
     permit automated retrieval;
   - **Active** — you want this source.

   Both must be on before anything is fetched. They are separate because
   wanting a source must not imply being allowed to take it.

3. **Start small.** Ten to fifteen sources is enough for the first week, and
   makes a broken feed obvious. Suggested first set, all of them feeds phase 2
   can actually retrieve: European Commission, EUR-Lex, ESMA, EDPB, ENISA,
   IFRS Foundation, IFAC, AFM, FRC, ICAEW, Accountancy Age, Accountancy Daily,
   Reuters, IAS Plus.

4. **Verify the feed URLs as you go.** They are documented locations that have
   **not been fetched** — this repository has never had internet access. Press
   **Run discovery now** after activating a batch and read the health column.

5. **Set the research cap.** `/admin/settings` →
   `newsroom.research_cap_per_day`. 8 is the default and is the right number
   for a dry run: it produces a list long enough to judge.

### What the 51 proposed sources actually are

| Method | Count | Phase 2 |
|---|---|---|
| `rss` | 28 | fetched |
| `json_api` | 2 | fetched |
| `html_scrape` | 20 | **not fetched** |
| `manual` | 1 | never fetched, by design |

So **30 of 51 are retrievable today**. The twenty `html_scrape` rows — IAASB,
IESBA, EFRAG, IIA, COSO, ISO, the AI Office, CEAOB, APAS, H3C (since succeeded by H2A), NBA, SSRN, the
AAA journal and the firm insight pages — publish nothing machine-readable.
**Phase 2 does not implement scraping.** They report `skipped_unsupported` and
fetch nothing.

That matters for what the dry run can tell you: IAASB and EFRAG are primary
sources for auditing and sustainability-reporting claims, and neither is
reachable yet. Expect the dry run to under-represent standard-setting relative
to regulation, and read the candidate list with that in mind.
`PHASE_2_5_EXTRACTORS.md` proposes site-specific extractors for the six that
matter.

This is deliberate: a generic extractor would fill the Inbox with navigation
links and look like it was working. Per-site extractors are a separate piece of
work. Activate them anyway if you like — they will sit quietly and say why.

---

## 4. Reading the dry run

`/admin/editorial/dry-run`. Four views: everything, would-research,
passed-the-gates, filtered-out. **Read the filtered-out list too** — a list of
only the winners answers half the question, and you cannot disagree with a
rejection you cannot see.

Each card shows the title, the verdict and rank, why it was selected or which
gate rejected it, every gate with its reason, the sources and their tiers,
jurisdictions, first and last seen, how many times the story has moved, and
links to open each source.

### Your verdict

Four buttons, plus an optional note: **Good story**, **Not relevant**,
**Duplicate**, **Wrong jurisdiction**.

Every verdict is stored permanently in `newsroom_discovery_feedback`, together
with what the engine thought *at that moment* — its score, its gate results and
whether it would have researched the story. Frozen on purpose: re-reading the
story later would show its current score, and the label would then describe a
number that was never the one you judged.

It is append-only. Changing your mind adds a row; the first judgement is also
data, because it says how clear the case was.

**Aim for a verdict on every candidate, every working day.** The labels are
the deliverable — the rest of the dry run is scaffolding around collecting
them.

---

## 5. The two weeks

| Day | What to do |
|---|---|
| 1 | Register sources, approve 10–15, run discovery manually, fix feed URLs that do not resolve. |
| 2 | Switch **Newsroom discovery (scheduled)** on and deploy. Confirm the trigger fires (check `newsroom_pipeline_runs`). |
| 3–5 | Label every candidate daily. Widen the active set as feeds prove themselves. |
| 6–10 | Keep labelling. Watch the source-health column for feeds that went quiet. |
| 11–14 | Keep labelling. Stop adding sources so the last week measures a stable configuration. |

### What to measure at the end

The dry run exists to answer four questions:

1. **Is it finding the right things?** Of what it selected, what share did you
   mark *good*? Below roughly 60% and the gates need work before any money is
   spent on generation.
2. **Is it missing things?** Did you see developments elsewhere that never
   appeared? That is the expensive failure and the harder one to see.
3. **Is clustering working?** How many *duplicate* verdicts? A high rate means
   the lexical matcher needs the embeddings the masterplan defers (change C4) —
   and now there is the measurement to justify them.
4. **Is jurisdiction right?** How many *wrong jurisdiction*? That points at
   `inferJurisdictions()` in `src/lib/newsroom/normalise.ts`, which is a
   keyword pass and deliberately conservative.

Then hand-label two weeks of clusters for precision and recall, which is the
measurement that decides the embeddings question.

---

## 6. Source health

`/admin/editorial/sources`, health column, and the warnings block on
`/admin/editorial`.

| State | Meaning |
|---|---|
| `ok` | Fetching and producing |
| `never_fetched` | Activated but nothing has been retrieved yet — usually a wrong feed URL |
| `silent` | Nothing retrieved for 3× its cadence. **The failure worth catching**: a redesigned site returns 200 and an empty list forever, so nothing errors and a Tier-1 regulator quietly drops out of coverage |
| `failing` | More than three consecutive failures |
| `blocked` | Active, but retrieval permission is unchecked |

Each row also shows the **last attempt** — time, outcome, HTTP status, items
found, items new, and the error. That is a different question from the last
success, and it is the one actually being asked when a feed looks quiet: a
source whose last attempt was a 404 four minutes ago and one that simply has
not been due for an hour look identical without it.

A skip is never counted as a failure. A source that is not due has not failed
at anything.

**Nothing falls back to scraping when a feed fails.** A failed fetch is
reported and the run moves on. A crawler that responds to a 404 by fetching
something else is a crawler nobody approved.

---

## 7. Audit trail

Everything is queryable:

| Table | Holds |
|---|---|
| `newsroom_pipeline_runs` | One row per run, idempotency key, status, error |
| `newsroom_fetch_log` | Every fetch attempt, **including every skip and why** |
| `newsroom_pipeline_events` | Every story creation, join and revision, with the run that caused it |
| `newsroom_source_items` | Every item, with canonical URL, both hashes, jurisdictions, retrieval time |
| `newsroom_discovery_feedback` | Your verdicts, permanently |

Repeated runs inside the same hour share one run row, so a cron retry or a
manual run during a scheduled one is one run, not two.

---

## 8. If something goes wrong

**Stop everything:** switch **Newsroom discovery (scheduled)** off in site
settings. Effective on the next firing, no deploy. Deleting the cron trigger is
the heavier equivalent.

**A run failed:** its row in `newsroom_pipeline_runs` has `status = 'failed'`
and the error. The Inbox shows the count of recent failed runs.

**Too much noise:** lower `newsroom.research_cap_per_day`, or deactivate the
noisiest source. Both take effect on the next run.

**A publisher objects:** switch that source's **Retrievable** off. It stops
being contacted immediately, and the row stays with its history intact.

## 9. Workers plan and capacity

The newsroom is designed for **Cloudflare Workers Paid** (1,000 D1 queries and
10,000 subrequests per invocation, and far more CPU). STAI currently runs on
**Workers Free** (50 queries, 50 subrequests, ~10 ms CPU) and will upgrade
before discovery or the Intelligence Engine runs at meaningful scale. The code
is not redesigned around Free; instead the deployment declares its plan and
the risky features stay closed until it says Paid.

### The plan switch

`STAI_WORKERS_PLAN` in `wrangler.jsonc` — `"free"` today. Unset counts as
free. What it changes (`src/lib/newsroom/plan.ts`):

| | On `free` | On `paid` |
|---|---|---|
| Scheduled discovery | **Does not start**, even if switched on; logs why | Runs when switched on |
| Manual "Run discovery now" | Clamped to **3 sources, 10 detail pages, 30 s** per click | Governed by the settings below |
| Everything else | Unchanged | Unchanged |

On Free a manual run of up to three sources stays well inside 50 queries and
50 subrequests. Its CPU cannot be guaranteed under 10 ms; if the platform stops
it, nothing is half-written (a run writes everything in one transaction) and
its lease is released after the time budget plus five minutes. A stopped run
shows as failed in the Inbox; it does not damage anything.

### Do not enable before upgrading to Workers Paid

- **Newsroom discovery (scheduled)** — the switch. The code refuses it on Free
  anyway; do not rely on that alone.
- **Registry-wide coverage** — activating many sources in the expectation that
  they will all be read. On Free only manual runs happen, three sources at a
  time.
- **Phase 3 / the Intelligence Engine** — research, evidence packs, drafting.
  Not started, and not to be started on Free.
- Raising the discovery limits below — pointless on Free (the profile clamps
  them) and misleading about what will happen after the upgrade.

### Upgrading, in this order

1. Upgrade the Cloudflare account to Workers Paid.
2. Set `"STAI_WORKERS_PLAN": "paid"` in `wrangler.jsonc`, commit, deploy.
3. Check `/api/health`, then run discovery manually once with a few sources.
4. Only then switch **Newsroom discovery (scheduled)** on in site settings.

### What one run may spend, on any plan

Discovery never spends the platform's allowance just because it exists; a run
that suddenly needs far more reads as a fault rather than as load.

**D1 queries:** 9–21 per run (+2 in the scheduled handler), whatever the
registry size. `tests/discovery-budget.test.mjs` fails if that grows.

**Operator limits** (site settings; each has a HARD maximum the form cannot
exceed, on Paid too; held-back sources log `skipped_budget` and stay due):

| Setting | Default | Hard max | What it bounds |
|---|---|---|---|
| `newsroom.max_sources_per_run` | 60 | 200 | Sources fetched per run, least recently attempted first. One request each. |
| `newsroom.max_detail_fetches_per_run` | 60 | 300 | Publication pages opened behind indexes, across the run. Each extractor also has its own cap (APAS: 30). |
| `newsroom.max_run_seconds` | 300 | 840 | Nothing new starts after this; a run overruns it by at most one 15-second timeout. Under the 15-minute cron limit. |

**Fixed in code:** 200 items read per source per run; one outbound request at
a time; 15-second timeout and 4 MB body limit per request; **no retries within
a run** (the next run is the retry); one run at a time (a second caller gets
"another discovery run is in progress", HTTP 409 from the button); a run that
dies releases its lease after the time budget plus five minutes and is
recorded as failed ("abandoned").

**Measured on Paid settings** (real `runDiscovery`, migrated schema, RSS
sources with 20 items; CPU is JavaScript only — D1 work happens outside the
Worker):

| Active sources | D1 queries | Outbound requests | CPU, steady state | CPU, first run |
|---|---|---|---|---|
| 15 | 13–19 | 15 (+ ≤60 detail pages) | 60–85 ms | ~0.4 s (300 new items) |
| 50 | 13–20 | 50 (+ ≤60) | 170–190 ms | ~1.7 s (1,000 new items) |
| 100 | 19–21 | 60 per run, 40 deferred (+ ≤60) | 210–260 ms | ~1.9 s (1,200 new items) |

At 100 sources the default of 60 sources per run is what binds: a tier-1 source
due every 30 minutes may wait one extra run. Raise the setting if that matters;
the query count does not change with it.

Discovery ships **off**. Nothing above runs until **Newsroom discovery
(scheduled)** is switched on in site settings — after the upgrade.
