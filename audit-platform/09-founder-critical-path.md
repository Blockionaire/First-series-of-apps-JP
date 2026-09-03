# 9. Founder Critical Path — what only you can do

**This is a living checklist, not a plan.** It exists because the engineering track is now
ahead of the human track, and every remaining Phase 0 dependency runs through you personally.
Update the status column as things land; the rest of the documents describe *what* to build,
this one describes *what will stop the build if nobody does it*.

> **The honest position today.** The engine, the pack, the corpus and the evaluation
> scaffolding are built and tested. **Nothing further of consequence can be proved without an
> audit SME, three design partners, and six auditors' diaries.** None of those is a
> programming task, all three have lead times measured in weeks, and two of them gate the
> Phase 0 result entirely. This is the critical path now.

## 9.1 The five things on the critical path

Ordered by lead time, longest first. Start all five this week — they run in parallel and
none of them depends on more code existing.

| # | Action | Why only you | Lead time | Blocks | Status |
|---|---|---|---|---|---|
| **1** | **Engage the audit methodology SME** on equity or advisory terms | It is a relationship and a commercial negotiation. It is also the single largest swing factor in the Phase 0 budget: 8 days at a commercial rate is €5.6–9.6k, which alone would consume the phase | 2–4 weeks | Pack sign-off, corpus realism, ground-truth labelling, gate interpretation — **most of Phase 0** | ☐ |
| **2** | **Recruit three design partners** (one small, one mid-tier, one larger or quality-conscious) | Nobody else can approach a firm on behalf of the venture | 3–6 weeks | The real corpus, the blind test raters, the M3 baseline, Phase 2 | ☐ |
| **3** | **Obtain paired real cases** — historical revenue walkthroughs *with the firm's own final working paper* | It is an ask that only a principal can make, and it is the hardest thing to obtain in the whole plan | 4–8 weeks from first contact | Variant A, M2, the entire gate. **Without this there is no Phase 0 result** | ☐ |
| **4** | **Settle the corpus data question** — anonymisation before material leaves the firm, or a one-page data-sharing agreement | Legal exposure and professional secrecy sit with you, not with the code | 1–3 weeks | Any C1 material entering the project at all | ☐ |
| **5** | **Book six auditors for the blind test**, across the three partners | Diaries, and a favour only a principal can ask | **3 weeks' notice minimum** | M1, M2, the gate verdict | ☐ |

**Item 3 is the one to worry about.** A firm will often agree in principle and then find that
releasing a working paper needs its own internal approval. Ask in the first conversation, ask
for anonymised material, and ask for *one* case before asking for eight.

## 9.2 Second tier — needed, but not yet blocking

| Action | Why only you | When | Blocks | Status |
|---|---|---|---|---|
| **SME pack review** — 12 sub-processes, coverage items, mandatory flags, libraries | Professional judgement being encoded; this is the sign-off a quality department will ask about | Once item 1 lands | Credible Phase 0 content; the pack-gap versus model-failure triage | ☐ |
| **SME realism pass on cases 01–06**, planting two surprises per case the drafter did not know about | The contamination control. Without it the synthetic corpus is Claude marking its own homework | Once item 1 lands | Any meaningful reading of dev-set results | ☐ |
| **Obtain the firm's own authoring-plus-review time** for one revenue process | A commercial question to a partner | With item 2 | **M3** — without a baseline, "45 minutes" has nothing to be 40% of | ☐ |
| **Nominate the variant-C editor** — an auditor who is *not* one of the six raters | Cross-firm coordination | Before week 6 | Variant C, M3, M4 | ☐ |
| **Write down the stop rule and sign it** before any result arrives | It is a commitment, and it is worthless if made after the numbers are in | **Now** | The integrity of the gate decision | ☐ |
| **Anthropic Console account + $25** | Payment details and account ownership | At the API gate — start of week 3 (`08 §G`) | The first live generation run, M6, variant B | ☐ |
| **Open the model-provider terms conversation** (no training, retention) | Contractual | During Phase 1 | C1/C2 material at scale, and Phase 2 | ☐ |

## 9.3 What is *not* waiting on you

So the split is unambiguous. All of this is done or continues without you:

- the methodology pack, loader and consistency validation;
- the coverage engine, deterministic triggers and mandatory-item logic;
- the grounding validator, assembly and the neutral renderer;
- all six synthetic cases and their answer keys (drafted, awaiting your SME);
- the metrics harness, edit taxonomy, blind-test mechanics and gate report;
- cost reporting per stage and per case;
- the test suite and every mock-mode run.

## 9.4 Ordering for this week

1. **Write and sign the stop rule.** Ten minutes, and it can only be done honestly today.
2. **Approach the SME.** Longest-lead relationship, largest budget effect.
3. **Approach the three firms**, and in the *first* conversation ask for one paired case and
   for their anonymisation preference. Not features. Not a demo.
4. **Ask each firm for the baseline authoring time** while you have their attention.
5. Only once a firm has said yes in principle: **circulate the data-sharing one-pager.**

Everything else can wait a week without cost. These cannot.

## 9.5 Standing warning

Synthetic-case results are **progress, not evidence**. The gate is decided by SME-reviewed
cases, real paired cases, and the blind human evaluation. Every item on this page exists
because that sentence is true — the evidence the plan depends on is held by people you have
not yet contracted.
