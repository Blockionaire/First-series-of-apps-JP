# STAI Intelligence Engine — masterplan

**Status:** design approved. Phase 1 in build.
**Supersedes:** "STAI Intelligence Engine — System Design v1.0".
**Operator decisions of 21 September 2026 are recorded in §25 and folded into
the sections they affect.**

This is the working brief for the automated research and content pipeline. It
is written to be read by whoever — person or agent — builds each phase, so it
states the reasons, not just the shape. Where it departs from the v1.0 design
the change is marked **[C1]**…**[C15]** with the reason it was made.

---

## 1. What the engine is for

Continuously find real developments across AI and automation, audit and
assurance, accounting and financial reporting, finance and the CFO function,
regulation, accounting firms, enterprise tooling, cybersecurity and data, and
relevant academic research — and turn them into content a practitioner can act
on.

The optimisation target is **not** article count. It is:

> What does an auditor or finance professional actually need to know today, why
> does it matter, and what does it mean for their work?

Everything below follows from taking that sentence literally, including the
parts that make the system produce *less*.

---

## 2. Design principles

These are unchanged from v1.0 and are not up for renegotiation during the
build.

**A. Evidence-first.** No model goes from URL to article. The path is always
sources → extracted evidence → verification → article. Every material sentence
must be traceable to the evidence it came from.

**B. Primary-source first.** For legislation, standards, regulatory
announcements and product releases, the engine finds the original text. Reuters
is how you *discover* that the Commission published something; the Commission
is what you *cite*.

**C. Fact and interpretation stay separate.** "The regulation applies from
1 January 2027" and "this could require firms to reconsider how AI-generated
audit evidence is documented" are different kinds of statement. The second is
welcome. Presenting it as though the regulator said it is not.

**D. No silent AI publishing for high-risk content.** Regulation, accounting
standards, auditing standards and enforcement require a human approval.

**E. Everything is reproducible.** For every article: which sources, when
retrieved, which evidence pack, which prompt version, which model, which AI
reviews, which human edits, when published. For an audience of auditors this is
not overhead — it is the product's credibility.

**F. The engine never becomes load-bearing. [C7]** The existing manual CMS at
`/admin/content/new` keeps working whether or not the newsroom runs. The engine
is an additional production source, built beside the platform, never through
it.

---

## 3. What changed from v1.0

Fifteen changes. Four are structural (C1, C2, C3, C5); the rest are
corrections, sequencing, or things the original left unspecified.

| # | Change | Why |
|---|---|---|
| **C1** | Spend controls move from phase 5 to phase 1 | Phase 4 burns money. A budget that arrives in phase 5 arrives after the bill. |
| **C2** | Relevance becomes gates + a daily throughput cap, not a 0–100 threshold | A threshold produces filler on quiet days and blows the budget on busy ones. |
| **C3** | Phase 2 ends with a two-week dry run, no generation | Discovery quality is the cheapest thing to fix and the most expensive thing to get wrong. Validate it before spending a cent on writing. |
| **C4** | Clustering starts lexical, reusing the existing BM25 tokenizer | The codebase already rejected a vector DB for good reasons. Earn the dependency with a measurement. |
| **C5** | Fact-check splits claim *extraction* from claim *judgement* | Showing a model the article and the evidence together anchors it on the article. |
| **C6** | Stories are living, not one-shot | Regulation arrives in stages. The SEO work already shipped makes updates valuable; the state machine has to allow them. |
| **C7** | Publication goes through the existing admin write path | A direct D1 insert bypasses search invalidation and IndexNow. |
| **C8** | Tiered retention for source snapshots | Full copyrighted text kept forever is a legal and a storage problem. |
| **C9** | Every human review decision becomes a labelled eval example, from day one | You cannot improve prompts without a fixed set to measure against, and the data is expensive to retrofit. |
| **C10** | Explicit AI-assistance byline policy | For this audience, disclosure is an asset. |
| **C11** | Target 1–3 published items per weekday, not 5 | Matches the stated principle. The site has 11 articles and no audience yet. |
| **C12** | v1 uses Cron + Workflows only; Queues and R2 deferred | Fewer moving parts, and Queues needs a paid Workers plan. |
| **C13** | `ai.run()` refactors the existing `src/lib/ai.ts`, not a parallel stack | There is already a hardcoded `MODEL` constant and an Anthropic client in the codebase. |
| **C14** | Idempotency gets a named mechanism, not a principle | "Steps must be idempotent" is not implementable as written. |
| **C15** | Source health monitoring is a phase 2 deliverable | A feed that silently stops is the most likely long-term failure and the least visible. |

---

## 4. Architecture

```
                         INTERNET
                            │
          ┌─────────────────┼─────────────────┐
     Regulators        Tech vendors      News/research
     Standards         Firms/blogs       publications
          └──────────────┬──┴─────────────────┘
                         ↓
                ① SOURCE INGESTION          ← cron, per-tier cadence
                         ↓
                ② NORMALISE + DEDUP         ← content_hash
                         ↓
                ③ STORY CLUSTER             ← lexical first [C4]
                         ↓
                ④ RELEVANCE GATES + RANK    ← top N per day [C2]
                         ↓
                ⑤ RESEARCH AGENT
                         ↓
                ⑥ EVIDENCE PACK
                         ↓
                ⑦ ARTICLE WRITER
                         ↓
                ⑧ CLAIM EXTRACTION          ← article only [C5]
                         ↓
                ⑨ CLAIM ADJUDICATION        ← claim × evidence, pairwise
                         ↓
                ⑩ EDITORIAL QA
                         ↓
                ⑪ RISK GATE
                         ↓
                  NEEDS_REVIEW  →  human  →  APPROVED
                         ↓
                ⑫ PUBLICATION               ← via existing admin path [C7]
                         ↓
              Website  ·  Daily Brief  ·  (later) Podcast
```

Five separate workflows, not one:

```
DiscoveryWorkflow → ResearchWorkflow → ArticleWorkflow → PublicationWorkflow → PodcastWorkflow
```

Separate so a failure in one does not force a re-run of the others, and so each
can be tested in isolation.

### Infrastructure, staged [C12]

The platform today runs Next.js on Workers via OpenNext, with D1 and one
SQLite-backed Durable Object. That is the entire footprint. The engine adds
capability in this order:

| Phase | Adds | Note |
|---|---|---|
| 1 | Nothing. D1 tables only. | |
| 2 | Cron Triggers, Workflows | Verify the free-plan cron-trigger count and Workflows concurrency limits before designing around them. |
| 3 | AI Gateway | Central AI layer: logging, spend limits, fallback. |
| 5 | Queues + DLQ, **if measurement shows they are needed** | Queues requires a paid Workers plan. At ~300 items/day, Workflows plus cron is sufficient; do not add a queue for a volume that does not need one. |
| 6 | R2 | Podcast audio. Also the point at which long-term source snapshots become worth storing. |

**Ordering rule:** no component is added before there is a measurement showing
the simpler arrangement is inadequate.

---

## 5. Source registry

An admin-managed allowlist. The engine never pulls arbitrary web pages.

### Nothing is active until a human activates it

Decided 21 September 2026. Phase 1 ships a **proposed** list of 40–60 sources
as a reviewable file, and every row lands in the database with
`active = 0`. There is no bulk-enable. The operator reads a source, checks that
its tier and jurisdiction are right and that retrieving it is permitted, and
activates it individually in `/admin/editorial/sources`.

This is not ceremony. The source registry is the only thing standing between
"an allowlist of considered publications" and "whatever the seed file happened
to contain", and a seeded row that quietly became active is exactly how the
second happens. Activation is recorded with who and when.

```
source_id, name, domain, source_type, authority_tier, jurisdiction,
topics[], ingestion_method, feed_url, active, license_notes,
fetch_frequency, last_success_at, consecutive_failures,
snapshot_retention [C8], fetch_allowed [C8]
```

### Tiers

| Tier | What | Role |
|---|---|---|
| **1 — authoritative** | European Commission, IAASB, IFRS Foundation, EFRAG, AFM, FRC, ESMA, NBA, vendor release notes | Factual claims rest here. |
| **2 — trusted secondary** | Quality journalism, trade press, research houses, law-firm analyses, Big Four publications | Context and discovery. |
| **3 — discovery** | Social, forums, blogs, broad web search | Signal only. |

### What a Tier-3 source may and may not do

Stated precisely, because this is the rule most likely to be eroded by a
convenient exception:

| Stage | Tier 3 alone |
|---|---|
| Open a story cluster | **Yes.** Discovery is exactly what Tier 3 is for. |
| Attract further sources into that cluster | Yes. |
| Appear in the Editorial Inbox as a discovered story | Yes, labelled `discovery-only`. |
| Pass the relevance gate into research | **No.** |
| Reach article generation | **No.** |
| Support a factual claim in a published piece | **No.** |

A cluster whose only members are Tier 3 sits at `DISCOVERED` and is visible to
a human, who may escalate it by hand if they judge it worth chasing. It cannot
progress on its own. The gate is: **a cluster requires sufficient Tier-1 or
Tier-2 evidence before it may progress to article generation**, and for
regulatory content §8's stricter primary-source rule applies on top of that.

Escalation by a human is recorded as an editorial decision with a reason, like
every other transition — it is an override, not a loophole, and it shows up in
the audit trail as one.

### Ingestion cadence

| Tier | Frequency |
|---|---|
| Tier 1 / high-value | 30 min |
| Tier 2 | hourly |
| Broad discovery | 2 hours |
| Research / papers | a few times daily |

### Source health [C15]

Many standard setters have poor or no RSS; several will need
`ingestion_method: html_scrape` with a stored selector. Those break silently
when a site is redesigned, and a dead Tier-1 feed is invisible precisely
because it produces no error — it produces nothing.

Phase 2 ships a source-health panel: any active source with no successful item
in `3 × fetch_frequency`, or `consecutive_failures > 3`, is surfaced in the
Editorial Inbox as a warning. `fetch_allowed` records whether the source's
robots.txt and terms permit automated retrieval, checked at registration and
re-checked monthly.

---

## 6. Ingestion, dedup, clustering

New items land in `source_items` with `content_hash`, which prevents
reprocessing an unchanged document.

Clustering answers: eighteen outlets wrote "EU publishes new AI guidance" — is
that one story or eighteen?

### Start lexical [C4]

`src/lib/search.ts` already implements BM25 over article chunks and explicitly
rejected an external vector database, for reasons that still hold: the corpus
is small, lexical retrieval is transparent and reproducible, and nothing leaves
the box.

Apply the same judgement here. Phase 2 clusters using the existing `tokenize()`
plus cosine similarity over TF-IDF vectors of title and lead, scoped to a
rolling 7-day window, combined with canonical-URL matching and named-entity
overlap. Over a few hundred items this is milliseconds of work and no new
infrastructure.

**Then measure.** Hand-label two weeks of clusters from the dry run (C3) and
compute precision and recall. If recall is poor — the likely failure being the
same story described in genuinely different vocabulary — add embeddings at that
point, with the measurement as justification. Storing a `Float32Array` as a D1
BLOB and computing cosine in the Worker across a 7-day window is well within
budget; Vectorize is not needed at this scale.

---

## 7. Relevance: gates, then rank [C2]

v1.0 scored nine dimensions into a single number and compared it to a
threshold. Two problems: a nine-way weighted sum is untunable — when it is
wrong, nobody can say which weight was wrong — and a fixed threshold makes
throughput a function of the news cycle rather than of the budget.

Replace with two stages.

**Stage 1 — hard gates.** Boolean, cheap, explainable. A story is dropped
immediately if any fails:

- no Tier-1 or Tier-2 source in the cluster
- no plausible connection to audit, accountancy, finance or the regulation
  touching them
- already published by STAI, or materially the same as a published piece
- republished old news with no new development
- pure product marketing, rumour or speculation
- would produce only SEO filler

Saying no well is the same job as saying yes well. A good editor rejects more
than they accept, and the rejection log is a first-class part of the record.

**Stage 2 — rank the survivors, take the top N.** A single composite score with
a written rationale, used *only* for ordering:

```
Relevance: 84
Because:
- affects how audit evidence may be generated
- applies to EU regulated entities
- introduces an implementation deadline
```

The daily research budget is **a count, not a threshold**: the engine researches
the top N stories per day and nothing else. N is a configured number, initially
6–8. On a quiet day it researches the best of a thin field and the human sees
fewer, better candidates. On a heavy day it researches the best eight and the
rest wait or expire. Cost becomes predictable by construction.

The rationale text is what makes a score reviewable later. Keep it.

---

## 8. Research agent and evidence pack

The research agent's job is explicitly **not to write**. It is given the story
cluster, its initial sources and the source registry, and may retrieve further
material. Output is strictly structured:

```json
{
  "story": "...",
  "confirmed_facts": [], "dates": [], "numbers": [], "requirements": [],
  "primary_sources": [], "secondary_sources": [],
  "conflicting_information": [], "uncertainties": [],
  "potential_audit_implications": []
}
```

Each material claim becomes a row in `evidence_claims`:

```
claim_id, story_id,
claim_type      FACT | DATE | NUMBER | REQUIREMENT | INTERPRETATION | IMPLICATION
claim_text,
source_id, source_url, source_locator,
support_status  SUPPORTED | PARTIALLY_SUPPORTED | CONFLICTING | UNSUPPORTED
evidence_strength  PRIMARY | SECONDARY | WEAK
verified_at
```

`source_locator` matters more than it looks: for a 200-page regulation, "the
Commission said so" is not traceable. Store an article/paragraph reference or
an exact quoted span, so a reviewer can open the source and land on the
sentence.

### Hard rules for regulation and standards

A draft cannot reach `NEEDS_REVIEW` if `primary_source_count = 0`.

Every claim about an obligation, effective date, legal applicability, deadline,
penalty, standard or compliance requirement must resolve to a Tier-1 primary
source. No exceptions, no override flag in the UI. If the rule is ever relaxed
it is relaxed in code review, in the open.

### Snapshot retention [C8]

| Source tier | Retention | Reason |
|---|---|---|
| Tier 1 (official texts) | Indefinite | Public documents; the citation must stay checkable. |
| Tier 2 (journalism, analyses) | Evidence + URL + quoted spans only; full body 90 days | Copyright, and storage cost for text nobody reads twice. |
| Tier 3 | URL + title only | It was a signal, not a source. |

This also bounds what ends up in AI Gateway logs. Never send user data, client
information or audit files through this pipeline. It processes public content
only.

---

## 9. Writing

The writer receives the article type, the STAI style guide, the evidence pack
and the approved source list. **It does not receive the open internet.**

Instruction, in substance:

> Write the article solely from the supplied evidence. Do not introduce factual
> claims absent from the evidence pack. Clearly distinguish fact from STAI
> analysis. Do not exaggerate. Do not infer legal obligations. Explain the
> practical significance for audit and finance professionals.

### Structure

Underlying shape, consistent even where headings vary:

```
Headline → Standfirst → In brief (3 bullets) → What happened →
What it means → Why it matters for audit/finance → What happens next → Sources
```

### Formats

| Format | Length | Use |
|---|---|---|
| News Update | 300–500 w | A new factual development. |
| Explainer | 600–900 w | Needs context to be useful. |
| Regulatory Alert | 500–900 w | Stricter evidence and publication gates. |
| Research Note | 500–800 w | New paper or report, with the practical translation. |

Deep dives and opinion pieces are **not** automated. They are the formats where
editorial judgement is the entire value.

---

## 10. Verification [C5]

v1.0 gave the fact-checker the article and the evidence pack together and asked
it to check. That anchors: a model shown a fluent claim beside a pile of
supporting material tends to find the support.

Split it into three steps, two of which are model calls and one of which is
code:

**⑧ Extraction.** A model sees *only the article* and lists every material
claim, tagged factual or analytical. It has no evidence to be reassured by, so
it has nothing to anchor on.

**⑧b Matching.** Deterministic. Each extracted claim is matched against
`evidence_claims` by lexical overlap plus entity and number matching. This step
is code, it is testable, and it has no opinion.

**⑨ Adjudication.** A model judges *one claim against its candidate evidence at
a time*, with no view of the rest of the article:

```
supported? · source? · exact or inferred? · factual or analytical? ·
confidence? · problem?
```

Example of the outcome that matters:

```
CLAIM   "All EU audit firms must implement this by 2027."
RESULT  FAIL
WHY     The source applies to designated high-risk AI systems,
        not to audit firms generally.
ACTION  Remove or qualify.
```

Any unsupported **material** claim sets `status = FACT_CHECK_FAILED` and the
draft cannot proceed.

**Writer and verifier use different models** where cost allows — not because
the second is more likely to be right, but because the same model is more
likely to re-accept its own bias. The evidence pack, not the second model, is
the arbiter.

### Editorial QA

A separate pass, on quality rather than fact:

> Is this genuinely useful? Is the opening bloated? Is there repetition? Is this
> generic AI prose? Is the implication concrete? Is the language neutral? Does
> it sound like STAI? Is the headline accurate rather than clickbait? Does it
> add anything beyond the source?

**Hard revision cap:** `draft → factual revision → editorial revision → final`.
No further polish rounds. Iterated AI editing converges on smooth,
characterless text, which for this audience reads as exactly what it is.

### Copyright guardrail

Measure similarity between the final text and each individual source. Too close
to any one source is a fail: the engine must synthesise across evidence, not
paraphrase a paragraph. Record `primary_source_ratio` and `source_diversity` on
every draft.

---

## 11. Risk classes and publication

| Class | Examples | Publication |
|---|---|---|
| LOW | product updates, tech releases | Automatic only after the KPI gate below is met |
| MEDIUM | company news, market developments, AI research | Human review |
| HIGH | regulation, audit standards, accounting standards, enforcement | Always human approval |
| CRITICAL | anything reading as legal or compliance advice; material ambiguity | Never autonomous |

**In v1 nothing publishes automatically. Including LOW.**

### Byline and disclosure [C10]

Everything publishes under the existing `STAI Editorial` byline
(`src/lib/authors.ts`), which is already an honest collective byline with no
fabricated credentials — the right foundation.

AI-assisted pieces carry an explicit line in the article footer, beside the
existing editorial disclosure. **Final wording, set by the operator on
21 September 2026:**

> This article was produced with AI-assisted research and drafting and reviewed
> against the cited sources before publication.

It lives in one constant and is rendered from there, never retyped. It applies
to every piece that passed through the engine, whatever the human then did to
it — a draft rewritten heavily by an editor was still AI-drafted, and the
sentence stays.

For an audience trained in professional scepticism about sources, stating this
plainly is worth more than hiding it, and it is consistent with the
transparency direction of the regulation this desk writes about. A reader who
later discovers an undisclosed AI pipeline would be right to discount
everything else on the site.

---

## 12. State, and stories that keep moving [C6]

D1 is the editorial source of truth. A Workflow is never parked waiting for a
human — Cloudflare supports that, but a review can take a week and a workflow
instance should not. Instead:

```
ResearchWorkflow completes → D1 status = NEEDS_REVIEW → workflow ends
                           → human clicks Approve
                           → PublicationWorkflow starts
```

### Status machine

```
DISCOVERED
  ├→ REJECTED
  └→ QUEUED_FOR_RESEARCH → RESEARCHING → EVIDENCE_READY → DRAFTING
     → FACT_CHECKING → EDITORIAL_QA → NEEDS_REVIEW → APPROVED
     → PUBLISHING → PUBLISHED → LIVE
```

Failure states: `RESEARCH_FAILED`, `INSUFFICIENT_EVIDENCE`,
`FACT_CHECK_FAILED`, `EDITORIAL_FAILED`, `PUBLISH_FAILED`. Every transition is
logged with actor, timestamp and reason.

### Living stories [C6]

v1.0 ended at `PUBLISHED`, but regulation does not arrive in one piece — draft,
consultation, final text, effective date, first enforcement. A cluster that has
produced an article stays `LIVE`: new source items matching it raise
`UPDATE_PROPOSED`, which enters the review queue as an amendment to the existing
article rather than as a new one.

This matters more now than it would have a week ago. The SEO work just shipped
makes `dateModified` real, moves the sitemap's `lastmod` on every edit, and
pings IndexNow when a published piece changes. A well-maintained standing piece
on an evolving regulation is now a genuinely better asset than three thin
pieces about its stages — the infrastructure rewards the update.

Corrections are never silent. `article_versions` stores `article_id, version,
body_md, created_at, created_by, reason, model, prompt_version,
evidence_version`, and a corrected article states it:

> Updated 22 September 2026: clarified the effective date.

### Idempotency [C14]

Steps get re-run. The mechanism, not just the principle: every workflow step
writes under a deterministic key — `story_id + step_name + input_hash` — with
`INSERT … ON CONFLICT DO NOTHING`, and reads back the existing row when the
insert is a no-op. D1 accepts positional `?` parameters only, which the rest of
this codebase already assumes.

---

## 13. Publishing into the live site [C7]

The newsroom's `PublicationWorkflow` **must not write the `articles` table
directly.** The existing write path does three things beyond the insert:

1. stamps `updated_at` via `NOW_MS`, which is what moves the Ask STAI corpus
   fingerprint — without it, isolates keep serving a stale retrieval index;
2. calls `invalidateSearchIndex()`;
3. pings IndexNow for published pieces, and skips drafts.

A direct insert silently skips all three. Publication therefore goes through
the same server-side logic as `POST /api/admin/article`, refactored into a
shared function both callers use. `tests/retrieval-freshness.test.mjs` already
asserts that every article write path stamps `updated_at`; extend it to cover
the newsroom path when phase 4 lands.

The newsroom tables are additive. The existing `articles` table remains the
public output, and the current manual flow keeps working untouched:

```
newsroom data → approved article → existing articles table → existing website
```

---

## 14. The AI layer [C13]

All model calls go through one internal function:

```ts
ai.run(task, input)   // task: classification | research_synthesis |
                      //       article_writer | claim_extractor |
                      //       claim_adjudicator | editor | podcast_script
```

This is a **refactor of `src/lib/ai.ts`**, not a parallel stack. That module
currently exports a single `MODEL = "claude-sonnet-5"` constant and constructs
an Anthropic client directly — exactly the coupling this seam removes. Ask STAI
and prompt adaptation move onto the same seam, so there is one place where
model choice, spend accounting and logging happen.

Suggested initial mapping:

| Task | Model class | Reason |
|---|---|---|
| Relevance classification | small, fast | High volume, simple judgement |
| Research synthesis | strong reasoning | Long context, conflict detection |
| Article writing | strong writing | The reader-facing artefact |
| Claim extraction / adjudication | different family from the writer | Bias independence |
| Podcast rewrite | fast writing | Register change, no new facts |

Route through AI Gateway for centralised logging, analytics, fallback, rate
limits and spend limits.

### Prompt versioning

```
prompts/relevance/v1.ts  research/v1.ts  writer/v1.ts
        extractor/v1.ts  adjudicator/v1.ts  editor/v1.ts  podcast/v1.ts
```

Every output records `prompt_version` and `model`. Without this, "v1.4 feels
better" is unfalsifiable.

---

## 15. Evaluation [C9]

The missing piece in v1.0. §37 measured production; nothing captured the data
needed to *improve* the thing.

**From the first human review onward**, every decision is a labelled example:
the evidence pack, the generated draft, the decision (approve / approve-with-
edits / reject), the edited text where edited, and the reason. Stored in
`editorial_decisions`.

After roughly fifty reviews there is a regression set. A prompt change is then
testable: re-run `writer-v1.4` against the same fifty evidence packs, diff
against `v1.3` output and against what the human actually published, and see
whether it moved toward or away from the edited version.

This costs almost nothing to build in phase 4 and cannot be reconstructed
later — the labels only exist if they are captured as the reviews happen.

---

## 16. Cost

The engine is a **fixed monthly operating cost on a platform with no revenue
and payments frozen.** It needs an explicit ceiling that is a business
decision, not a technical one.

Estimate, per weekday, at the volumes above (~300 items ingested, ~80 clusters,
8 researched, 5 drafted), using current Anthropic list prices per million
tokens — Opus 5 $5/$25, Sonnet 5 $2/$10, Haiku 4.5 $1/$5:

| Stage | Calls | Rough cost/day |
|---|---|---|
| Relevance classification | 80 | $0.28 |
| Research synthesis | 8 | $1.12 |
| Article writing | 5 | $0.94 |
| Claim extraction + adjudication | 5 | $0.45 |
| Editorial QA | 5 | $0.30 |
| **Total** | | **≈ $3.10** |

≈ **$65–70 per month** for the newsroom at 22 working days. Two levers reduce
it materially and should be in from the start: **prompt caching** on the stable
prefixes — the style guide, the source registry, the evidence pack shared by
writer, extractor and editor — at roughly 0.1× on cache reads; and the **batch
API** at 50% for anything not latency-sensitive, which includes research-paper
triage and any overnight re-scoring, though not same-day news.

**The podcast is the expensive part.** A daily 8–12 minute episode is roughly
9,000 characters of TTS, ~200,000 characters a month, which lands in the upper
tiers of commercial TTS pricing and can **double or triple the total bill** on
its own. That is a second reason it comes last: it is the component whose value
per euro is least proven.

### The ceiling

**€75 per month, hard.** Set by the operator, 21 September 2026.

At the estimate above the newsroom lands near €65, so €75 is a working ceiling
with roughly 15% of headroom — not a comfortable one. Two consequences follow
and both are deliberate:

- The research cap (§7) is the throttle. If spend is tracking ahead of the
  month, the engine researches fewer stories per day. It does not skip
  verification, shorten evidence packs or downgrade the writer model, because
  those trade quality for volume and volume is the thing we are willing to
  lose.
- Prompt caching and batch submission are not optimisations to add later. At
  this ceiling they are the difference between 6–8 researched stories a day and
  4.

The podcast is **outside** this ceiling and gets its own budget line when
phase 6 starts, because mixing them would let TTS costs silently eat the
newsroom's research capacity.

### Controls, in phase 1 [C1]

- hard daily and monthly spend ceiling, enforced at AI Gateway
- max stories researched per cycle (this is C2's cap — the same number)
- max research retrievals per story
- max model calls and max tokens per stage
- no retry loop without a bounded attempt count
- **when the ceiling is hit, throughput degrades rather than the pipeline
  failing**: research fewer stories, do not half-produce them

Every stage records its token usage and cost against the story, so
`cost/story` and `cost/published_article` are measured from the first run
rather than estimated forever.

---

## 17. Editorial Inbox

The main admin addition. New top-level section beside Dashboard, Articles,
Prompts, Growth.

```
DISCOVERED  142    REJECTED  119    RESEARCHING  7
DRAFTED       5    NEEDS REVIEW  4    PUBLISHED  3    FAILED  1
```

Plus the source-health warnings from §5 and the pipeline-failure count.

### Story review screen

One screen that makes a responsible review possible in about two minutes:

```
EU Commission publishes …

Relevance 91 · Risk HIGH · Source quality Strong
Primary sources 2 · Sources 7

── ARTICLE ─────────────────────────────
[preview]

── WHY STAI SELECTED THIS ──────────────
[rationale from §7]

── SOURCES ─────────────────────────────
✓ European Commission (primary)   ✓ Official regulation (primary)
• Reuters                          • law-firm analysis

── FACT CHECK ──────────────────────────
27 factual claims · 27 supported · 0 partial · 0 unsupported
[each claim expandable to its source locator]

── AI ANALYSIS ─────────────────────────
3 analytical statements, labelled

[Reject] [Edit] [Request new research] [Approve & Publish]
```

The claim list must expand to the `source_locator`, so a reviewer can check the
one claim they doubt without opening seven tabs. That single affordance is what
makes the two-minute review honest rather than nominal.

---

## 18. Podcast — after publication only

The podcast engine does **no research**. Its only inputs are published STAI
articles and their approved evidence. This is what prevents a second
hallucination layer forming on top of the first.

```
select top published stories → rank → outline → conversational script
→ verify script claims against the approved articles → audio → R2
→ episode record → RSS
```

Script verification is the same pattern as §10: extract claims from the script,
match to the article, reject anything new. Register may change freely —

> Article: "The Commission published the guidance on Monday."
> Podcast: "Let's start in Brussels. On Monday, the Commission published new
> guidance that's worth paying attention to."

— same information, different medium.

### Cadence

**Two episodes per week, not daily.** Decided 21 September 2026.

This roughly quarters the TTS bill against a daily show and, more importantly,
changes what an episode is: two episodes a week can each cover the week's
genuinely significant developments, where a daily show has to fill Tuesdays.
The engine already optimises for "what must a practitioner know" rather than
volume; the podcast should not be the one component that contradicts that.

Phase 6 does not begin until the article engine is running to the §22
standard. Revisit daily only if listener completion justifies it.

First version 8–12 minutes. Not 30, simply because a model can generate 30.

Audio in R2 under `podcasts/YYYY/MM/DD/stai-daily-YYYY-MM-DD.mp3` with a
sibling `metadata.json`. The existing `podcasts` table already carries
`audio_url`, `status` and `updated_at`, and the hub already handles an episode
whose audio is not yet linked.

---

## 19. Volume [C11]

v1.0's illustration was five articles every morning. That is 150 a month, into
a site with eleven published pieces and an audience that does not exist yet.

**Validation target: 1–3 published items per weekday.** The Editorial Inbox
surfaces 5–8 researched candidates; the human picks. A desk that publishes two
things a day that practitioners actually read is a publication. One that
publishes five things a day that nobody reads is a content farm with better
provenance tracking.

**This is a configured value, not a design limit.** It lives in site settings
as `newsroom.publish_target_min` / `newsroom.publish_target_max` and
`newsroom.research_cap_per_day`, alongside the existing operator-controlled
limits. Nothing in the schema, the state machine or the workflows assumes a
particular number; raising the target is a settings change, not a code change.

**Expected path:** 1–3/day through validation, reviewed after the phase-2 dry
run and the first weeks of live review, then 3–5/day if the quality KPIs in §22
hold and reader metrics — completion, saves, returns — justify it. The research
cap and the spend ceiling move together: raising the publish target without
raising the budget just means more rejected drafts, which costs the same as
publishing them.

---

## 19b. Jurisdiction

Decided 21 September 2026. **Every article carries one or more jurisdiction
tags**, so a reader can see at a glance which market a piece applies to.

Multi-value is the normal case, not the exception. A piece on the EU AI Act as
it lands on Dutch audit firms is `EU` **and** `NL`; an IAASB standard is
`GLOBAL`; a UK-only FRC consultation is `UK`. Tagging one of those with a
single value would be a small lie in the most scannable part of the page.

### The set

**European-first, country-aware.** The taxonomy covers what the desk actually
writes about now, with room to extend:

| Group | Codes |
|---|---|
| Supranational | `GLOBAL`, `EU`, `EEA` |
| Countries in scope | `NL`, `BE`, `DE`, `FR`, `UK`, `IE`, `LU`, `ES`, `IT`, `NORDICS`, `CH`, `PL`, `AT`, `PT` |
| Out of scope for now | `US`, `APAC` — defined so a piece that genuinely touches them can be tagged honestly, but not part of the editorial focus |

Rules:

- `GLOBAL` is for genuinely jurisdiction-independent material (IAASB, IFRS,
  vendor releases) and is **exclusive**: combining it with a country tag means
  the piece is not global.
- `EU` does **not** imply its member states. Tag `EU` alone for the instrument
  itself; add `NL` when the piece says something specific about the Dutch
  implementation, supervisor or market.
- `UK` is first-class, not an afterthought. It has its own regulator, its own
  standards route and a large share of the audience.
- Unknown or unvalidated codes are rejected at the write path, the same way
  article kinds are.

### Language

**All content is in English, for now.** The audience spans European markets and
English is the working language of audit standards, EU instruments in practice
and the firms' own methodology. A Dutch edition is a later decision, and the
language switcher in the header already lists Dutch as "soon" rather than
pretending it exists.

Jurisdiction tagging is precisely what makes a single-language, multi-market
desk workable: the reader filters by relevance to their market rather than by
the language the piece happens to be written in.

### Scope note for the build

Phase 1 delivers the taxonomy module and the schema — the newsroom tables and a
nullable `jurisdictions` column on `articles`. **Surfacing the tag to readers,
and adding the field to the manual article editor, is deliberately not part of
phase 1**, which is schema, registry, state machine and admin shell. It is a
small follow-up on the live site and is tracked separately.

---

## 20. Database additions

```
sources                source_items          story_clusters      story_sources
evidence_packs         evidence_claims
article_drafts         article_versions      ai_reviews
editorial_decisions    [C9]
pipeline_runs          pipeline_events
podcast_episodes       podcast_versions      [phase 6]
```

All additive. The existing `articles` table stays the public output and is
written only through the shared path in §13.

---

## 21. Measurement

From day one:

**Pipeline** — stories discovered, rejected, researched, drafted;
`cost/story`; `cost/published_article`; duplicate rate; source distribution;
primary-source coverage.

**Quality** — % of drafts approved unchanged; % approved after edits; %
rejected; unsupported claims caught by the fact-checker; corrections after
publication; average review time.

**Reader** — views, completion, saves, shares. The existing first-party
analytics already excludes `/admin`, so newsroom activity does not pollute
these.

---

## 22. Gate before any autonomous publishing

Do not even discuss autopublish before **100–200 human-reviewed pieces** have
passed through the system. Then require, on a recent sample:

- zero material unsupported claims
- 100% of regulatory claims traceable to primary evidence
- >90% of drafts needing only minor or no factual edits
- very low duplicate rate
- very low post-publication correction rate
- stable `cost/article`

Only then may selected LOW-risk categories publish automatically. **Regulatory
and high-risk content stays human-approved permanently.** That is not a v1
limitation to be lifted later; it is the editorial position.

---

## 23. Build phases

| Phase | Scope | Exit criterion |
|---|---|---|
| **1 — Foundation** | Database schema, source registry, state machine, Editorial Inbox shell, **spend-control scaffolding [C1]**. No AI. | Schema migrated; a story can be moved through every state by hand; budget config exists and is read. |
| **2 — Discovery** | Connectors, ingestion, normalisation, dedup, lexical clustering [C4], relevance gates + rank [C2], source health [C15]. No generation. | **Two-week dry run [C3]**: the Inbox lists what it *would* have researched, daily, with rationales. Hand-label the clusters, measure precision/recall, tune the gates. No LLM spend beyond classification. |
| **3 — Evidence** | Research workflow, primary-source retrieval, evidence packs, claim model, audit trail, AI Gateway with live spend limits. No writing. | Evidence packs for a week of stories that a human judges sufficient to write from. |
| **4 — Articles** | Writer → extraction → adjudication → editorial QA → review screen, `editorial_decisions` capture [C9], publication through the shared write path [C7]. Manual publication only. | 20 consecutive drafts with zero unsupported material claims reaching review. |
| **5 — Hardening** | Retries, DLQ and Queues *if measured as needed* [C12], monitoring, tests, prompt versioning, eval harness against the captured set, cost analytics. | Eval set of ≥50; a prompt change can be measured against it. |
| **6 — Podcast** | Approved stories → brief → script → verification → audio → R2 → RSS. | Five episodes whose scripts introduce zero facts absent from the source articles. |

Phase 2's dry run is the most valuable checkpoint in this plan. It is the only
place where the hardest question — *is it finding the right things?* — gets
answered before any money is spent on turning the wrong things into articles.

---

## 25. Decisions taken

All recorded 21 September 2026. Each is folded into the section it governs;
this is the index.

| # | Decision | Section |
|---|---|---|
| **D1** | Tier 3 may open a cluster and surface it for a human, but a story may not progress to article generation without sufficient Tier-1/2 evidence. Human escalation is an audited override. | §5 |
| **D2** | Publish target 1–3/weekday **during validation**, as configured settings, not a design limit. Reviewed after the dry run; expected path to 3–5/day if the §22 KPIs hold. | §19 |
| **D3** | Newsroom hard monthly budget **€75**. The research cap is the throttle; quality is never the thing traded away. Podcast budgeted separately. | §16 |
| **D4** | Podcast: yes, **after** the article engine, **2 episodes/week** initially. | §18 |
| **D5** | Source registry: a proposed 40–60 source list ships in phase 1, every row `active = 0`, activated individually by the operator. No bulk enable. | §5 |
| **D6** | Disclosure sentence fixed: *"This article was produced with AI-assisted research and drafting and reviewed against the cited sources before publication."* | §11 |
| **D7** | Every article carries one or more jurisdiction tags. European-first, country-aware, `GLOBAL` exclusive, `EU` does not imply member states. All content in English for now. | §19b |

### Still open

- **Phase 5 Queues.** Decided by measurement in phase 5, not in advance.
- **Embeddings for clustering.** Decided by the phase-2 dry-run measurement.
- **Reader-facing jurisdiction display** on existing articles: a small
  follow-up on the live site, outside phase 1.
