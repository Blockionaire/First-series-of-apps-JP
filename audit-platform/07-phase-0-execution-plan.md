# 7. Phase 0 — Execution Plan

**Objective, and the only one.** Reach a credible empirical answer to:

> Is the Revenue Audit Intelligence Engine good enough that experienced auditors would
> prefer reviewing its output over authoring the working paper themselves?

Everything below is judged against that sentence. Anything that neither helps answer it nor
protects the validity of the answer is listed in §7.16 as forbidden.

**Shape of the deliverable:** a headless TypeScript package, a CLI, an evaluation corpus, a
metrics harness, and a blind preference test run with real auditors. No web application, no
database, no authentication, no cloud.

**Duration:** 7 weeks. **Founder:** 30–38 days. **SME:** 6–12 days. **Cash:** €1.5–5.8k with
the SME on equity, €9–13k if the SME bills (see §7.13 — this is a correction to the estimate
in `00 §0.8`).

---

## 7.1 What must exist technically

### Repository layout

```
audit-engine/
├── packages/
│   ├── domain/          # zod schemas, enums, types. No dependencies on anything else.
│   ├── methodology/     # revenue pack (YAML), risk + control libraries, loader + validator
│   ├── engine/          # the ten functions, stage prompts, LlmClient, grounding validator
│   └── evals/           # corpus loader, metrics, runners, report renderer
├── apps/
│   └── cli/             # `engine run`, `engine eval`, `engine render`
├── corpus/
│   ├── synthetic/       # committed to the repo
│   └── real/            # GITIGNORED. Never committed. See §7.5
└── out/                 # GITIGNORED run artefacts
```

### Runtime and dependencies

| Concern | Choice | Note |
|---|---|---|
| Runtime | Node 22, TypeScript, pnpm workspaces | |
| Schemas | Zod, with `zodOutputFormat` for structured outputs | One definition serves types, validation and the model's output schema |
| Model | `@anthropic-ai/sdk`, first-party API | Phase 0 processes synthetic and anonymised data only — see the classification table in §7.2 |
| CLI | `tsx` + `commander` | No build step during development |
| Tests | `vitest` | Unit tests on the validator and pack loader; the eval harness is the integration test |
| Rendering | A single HTML template + `docx` | For the blind test only — see §7.7 |
| Storage | The filesystem | No database in Phase 0 |
| CI | GitHub Actions running typecheck, unit tests and the smoke suite on a fixture cache | Not deployment — there is nothing to deploy |

**Not present:** database, ORM, migrations, HTTP server, auth, queue, object storage,
embeddings, vector search, Docker, Terraform, observability stack.

### The engine API — exactly the surface to preserve

```ts
// packages/engine/src/index.ts — the only public surface. Every interface consumes this.
export interface RevenueAuditEngine {
  ingest(input: RawInput): Promise<IngestedSource>;                       // parse, segment, id
  extractFacts(src: IngestedSource, ctx: EngineContext): Promise<ProcessFact[]>;
  evaluateCoverage(facts: ProcessFact[], ctx: EngineContext): Promise<CoverageAssessment>;
  identifyMissingFacts(cov: CoverageAssessment, ctx: EngineContext): Promise<MissingFact[]>;
  generateNarrative(facts: ProcessFact[], ctx: EngineContext): Promise<NarrativeBlock[]>;
  generateFlow(facts: ProcessFact[], ctx: EngineContext): Promise<FlowStep[]>;
  identifyRisks(facts: ProcessFact[], ctx: EngineContext): Promise<Risk[]>;
  identifyControls(facts: ProcessFact[], risks: Risk[], ctx: EngineContext): Promise<Control[]>;
  identifyGaps(risks: Risk[], controls: Control[], ctx: EngineContext): Promise<ControlGap[]>;
  validateGrounding(objects: Groundable[], src: IngestedSource): GroundingReport;  // pure, no model
  assembleOutputs(parts: EnginePartials, ctx: EngineContext): WorkingPaper;        // pure, no model
}
```

Two rules that keep this honest:

1. **`validateGrounding` and `assembleOutputs` never call a model.** They are deterministic
   application logic, unit-tested, and they are the components a security or quality reviewer
   will read first.
2. **`EngineContext` carries everything environmental** — the loaded pack, the client profile,
   the `LlmClient`, a run id, and a cost/latency accumulator. No stage reaches for a global,
   an environment variable, or the filesystem. That is what makes the same engine callable
   from a CLI now and from a web request, a questionnaire or a live cockpit later.

### Run manifest

Every run writes `out/<caseId>/<runId>/run.json` recording, per stage: model id, prompt
version, prompt hash, input hash, token usage, cache-read tokens, cost, latency, and the
schema version. This is what makes results reproducible and what turns "the risks got worse"
into a diffable fact.

---

## 7.2 Data classification — the trigger for everything security-related

Per your refinement: requirements attach to the **class of data**, not to a phase number.

| Class | Examples | Where it may be processed | Storage | Applies from |
|---|---|---|---|---|
| **C0 Synthetic** | SME-authored cases, Claude-drafted transcripts with no real entity | Any development configuration; first-party API; batch processing | Committed to the repo | Phase 0 |
| **C1 Anonymised historical** | Firm walkthroughs with entities, people, systems and amounts replaced *before leaving the firm* | First-party API under the data-sharing agreement; batch processing permitted | Encrypted disk, gitignored, no consumer cloud sync | Phase 0 |
| **C2 Firm-confidential** | The design partner's own methodology, their own revenue process walkthrough | First-party API with no-training terms agreed in writing | Encrypted disk or the Phase 1 application; access limited to the founder | Phase 0–1 |
| **C3 Audit-client confidential** | Any real engagement material | **EU-resident inference, production security architecture, RLS, MFA, logging** | Never on a laptop; only in the Phase 2 platform | Phase 2 |

**Phase 0 handles C0 and C1 only, plus C2 for the firm's own process walkthrough in the
bridge stage.** No C3 data touches Phase 0 under any circumstance — that is what makes
€0 of security spend defensible in this phase.

**The hierarchy you asked for, as an operating rule:** prefer synthetic; use anonymised
historical where synthetic cannot represent the complexity; use identifiable data only when
the experiment cannot be run without it. In practice, the corpus should be roughly
two-thirds C0 and one-third C1.

### Phase 0 data handling — the whole of it

- Full-disk encryption on the development machine; a password manager; the repository private.
- `corpus/real/` is gitignored *and* excluded from any consumer cloud sync (Dropbox, iCloud,
  OneDrive). Verify this on day one; it is the most likely accidental disclosure in the phase.
- One-page data-sharing and confidentiality agreement per design partner before any C1
  material arrives: evaluation-only use, **no model training**, no onward disclosure, deletion
  on request, named individual responsible. Prefer the firm's own template — most have one,
  and using theirs removes a negotiation.
- Written no-training / limited-retention terms with the model provider before C1 data is
  sent. Free, but it has lead time — start it in week 1.
- A deletion procedure that actually works: one folder, one command, confirmed in writing.

---

## 7.3 Minimum Revenue methodology specification

Not the full pack from `02` — the minimum that makes the experiment valid.

| Component | Phase 0 minimum | Full pack (later) |
|---|---|---|
| Sub-processes | **All 12** (R1–R12) | 12 |
| Coverage items | **55–70** (4–6 per sub-process) | 100+ |
| Must-know facts per item | 3–7 | 3–10 |
| Mandatory items (ISA 240, override, journals, cut-off) | **10–12, flagged** | Same |
| Deterministic follow-up triggers | **20–25** | 60+ |
| Risk library | **30 entries** | 40+ |
| Control library | **35 entries** | 50+ |
| Assertion + inherent-risk-factor enums | Complete | Complete |
| Standard references per item | Yes — they cost nothing and make SME review far faster | Yes |
| Firm-specific configuration | **No** — one neutral methodology | Per firm |

All twelve sub-processes are in scope even at minimum, because a gap in the pack shows up as
a false negative in the eval and would corrupt the measurement.

### The pack-gap rule — the most important methodological decision in Phase 0

When the engine misses a risk that the firm's working paper contains, there are two very
different causes:

- **Pack gap** — no coverage item would have elicited the underlying fact, and no library
  entry describes the risk. *This is a content defect. Fix the pack.*
- **Model failure** — the fact was in the transcript, the coverage item exists, the library
  entry exists, and the engine still missed it. *This is an engine defect. Fix the prompt or
  the stage.*

Every miss is triaged into one of the two before anything is changed, and the triage is
recorded. Without this discipline you will spend the phase tuning prompts to compensate for
missing methodology, which is both slower and produces an engine that cannot generalise.

### How the pack gets built

Founder drafts with Claude against `02`, SME reviews and corrects. The efficient loop is:
founder produces a full sub-process (coverage items, facts, triggers, candidate library
entries) → SME marks each item *keep / reword / delete / missing* in a single pass → founder
applies. Two sub-processes per SME hour is realistic once the format settles.

---

## 7.4 Data structures

These are the Phase 0 contract. They carry `engagementId` from the start even though Phase 0
has one case per folder — it costs nothing now and avoids a schema migration in Phase 1.

```ts
// ── identity and provenance ───────────────────────────────────────────────────
export const SourceLocator = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("transcript"), segmentId: z.string(), charFrom: z.number().int(),
             charTo: z.number().int() }),
  z.object({ kind: z.literal("note"), noteId: z.string(), charFrom: z.number().int(),
             charTo: z.number().int() }),
  z.object({ kind: z.literal("document"), documentId: z.string(), page: z.number().int().nullable(),
             charFrom: z.number().int(), charTo: z.number().int() }),
]);

export const EvidenceRef = z.object({
  locator: SourceLocator,
  quote: z.string().min(8).max(600),      // must occur verbatim in the located span
  speaker: z.string().nullable(),          // who said it — matters for reliability
});

export const Groundable = z.object({
  id: z.string(),                          // stable, content-addressed: sha256(kind + key fields)
  engagementId: z.string(),
  evidenceRefs: z.array(EvidenceRef).min(1),
  grounding: z.enum(["grounded", "needs_source", "human_authored"]),
});

// ── ingest ───────────────────────────────────────────────────────────────────
export const TranscriptSegment = z.object({
  segmentId: z.string(), ordinal: z.number().int(),
  speaker: z.string().nullable(), speakerRole: z.string().nullable(),
  tStartMs: z.number().int().nullable(), tEndMs: z.number().int().nullable(),
  text: z.string(),
});

export const IngestedSource = z.object({
  caseId: z.string(), engagementId: z.string(),
  language: z.enum(["nl", "en", "de"]),
  segments: z.array(TranscriptSegment),
  clientProfile: z.string().nullable(),    // entity, systems, revenue streams — free text, short
  sourceClass: z.enum(["C0", "C1", "C2"]), // §7.2 — recorded so a run can be audited later
});

// ── facts and coverage ───────────────────────────────────────────────────────
export const FactStatus = z.enum([
  "known", "unknown", "contradictory", "insufficiently_evidenced", "not_applicable",
]);

export const ProcessFact = Groundable.extend({
  coverageItemId: z.string(),              // "R6.2"
  factKey: z.string(),                     // "recognition_point"
  value: z.string().nullable(),            // null when status is unknown / not_applicable
  status: FactStatus,
  conflictingValues: z.array(z.object({ value: z.string(), ref: EvidenceRef })).default([]),
  actors: z.array(z.string()).default([]), // roles, not names
  systems: z.array(z.string()).default([]),
  certainty: z.enum(["stated", "implied", "assumed"]),
});

export const CoverageItemState = z.object({
  coverageItemId: z.string(),
  subProcess: z.string(),
  mandatory: z.boolean(),
  state: z.enum(["open", "partial", "covered", "not_applicable"]),
  notApplicableReason: z.string().nullable(),   // required when not_applicable — becomes documentation
  factStatuses: z.record(z.string(), FactStatus),
});

export const CoverageAssessment = z.object({
  caseId: z.string(),
  items: z.array(CoverageItemState),
  coveragePct: z.number(),                 // covered / applicable
  mandatoryOpen: z.array(z.string()),      // blocks completion
});

export const MissingFact = z.object({
  coverageItemId: z.string(), factKey: z.string(),
  why: z.string(),                         // why an auditor needs it
  question: z.string(),                    // the follow-up, in the interviewee's register
  origin: z.enum(["deterministic_trigger", "model_proposed"]),
  priority: z.enum(["mandatory", "high", "medium", "low"]),
});

// ── generated audit content ──────────────────────────────────────────────────
export const NarrativeBlock = Groundable.extend({
  subProcess: z.string(), heading: z.string(), body: z.string(),
  openPoints: z.array(z.string()).default([]),   // "not obtained" is first-class output
});

export const FlowStep = Groundable.extend({
  seq: z.number().int(), subProcess: z.string(),
  actor: z.string(), system: z.string().nullable(), action: z.string(),
  input: z.string().nullable(), output: z.string().nullable(),
  isDecision: z.boolean().default(false),
  controlIds: z.array(z.string()).default([]),
});

export const Risk = Groundable.extend({
  libraryRef: z.string().nullable(),
  newRiskJustification: z.string().nullable(),   // required when libraryRef is null
  title: z.string(), description: z.string(), subProcess: z.string(),
  assertions: z.array(Assertion).min(1),
  inherentRiskFactors: z.array(InherentRiskFactor).min(1),
  inherentRiskRating: z.enum(["lower", "moderate", "higher"]),
  significantRiskCandidate: z.boolean(),         // proposal only — never a conclusion
  fraudRelated: z.boolean(),
  drivers: z.array(z.string()),                  // what in THIS client makes it real
});

export const Control = Groundable.extend({
  libraryRef: z.string().nullable(),
  title: z.string(), description: z.string(), subProcess: z.string(),
  addressesRiskIds: z.array(z.string()).min(1),
  assertions: z.array(Assertion).min(1),
  controlType: z.enum(["preventive", "detective"]),
  controlNature: z.enum(["manual", "automated", "it_dependent_manual"]),
  frequency: z.enum(["per_transaction","daily","weekly","monthly","quarterly","annual","event_driven"]),
  ownerRole: z.string().nullable(),
  ipeUsed: z.string().nullable(),
  evidenceOfOperation: z.string().nullable(),
  keyControlCandidate: z.boolean(),              // proposal only
});

export const ControlGap = Groundable.extend({
  riskId: z.string(), description: z.string(),
  gapType: z.enum(["no_control", "control_not_precise", "control_undocumented", "information_missing"]),
  potentialImpact: z.string(),
});

// ── validation and assembly ──────────────────────────────────────────────────
export const GroundingReport = z.object({
  total: z.number().int(),
  grounded: z.number().int(),
  needsSource: z.array(z.object({
    objectId: z.string(), kind: z.string(),
    reason: z.enum(["no_ref", "ref_unresolvable", "quote_not_found", "ref_outside_engagement"]),
  })),
  integrityOk: z.boolean(),                      // false if any ref pointed outside this case
});

export const WorkingPaper = z.object({
  caseId: z.string(), engagementId: z.string(), packVersion: z.string(), runId: z.string(),
  narrative: z.array(NarrativeBlock), flow: z.array(FlowStep),
  risks: z.array(Risk), controls: z.array(Control), gaps: z.array(ControlGap),
  coverage: CoverageAssessment, openItems: z.array(MissingFact),
  provenanceIndex: z.array(z.object({ objectId: z.string(), refs: z.array(EvidenceRef) })),
});
```

**Grounding validator rules** (all deterministic, all unit-tested):
1. Every `Groundable` has ≥1 `EvidenceRef`.
2. Each locator resolves to a real segment or document in *this case*.
3. The `quote` occurs in the located span after whitespace and punctuation normalisation.
4. `libraryRef`, when present, exists in the loaded pack.
5. `newRiskJustification` is present whenever `libraryRef` is null.
6. `Control.addressesRiskIds` all exist in this run's risk set.
7. Failures set `grounding = "needs_source"` — **never drop the object**. A suppressed risk is
   more dangerous than an unsupported one.

---

## 7.5 The 6-case smoke set (development set)

**Purpose:** fast iteration. Runs in minutes, costs about €7, and never touches the cases the
gate is decided on.

| # | Case | What it stresses |
|---|---|---|
| 1 | Product sales, one ERP, automated order-to-invoice | The baseline; if this is weak nothing else matters |
| 2 | Services recognised over time, progress estimates | Subjectivity, IFRS 15 judgement, estimate risk |
| 3 | Manual SME: spreadsheet pricing, owner approves everything | Override risk, weak segregation, informal controls |
| 4 | ERP migration mid-year | The `change` inherent-risk factor, two control environments in one year |
| 5 | Outsourced invoicing + payment service provider | Service organisations, ISA 402, interface completeness |
| 6 | Vague and partly contradictory interviewee | `contradictory` and `insufficiently_evidenced` fact states; missing-fact detection |

**Construction, per case (2–4 hours):**

1. SME sketches the process in 15–20 minutes (bullet points, systems, roles, where it goes wrong).
2. Founder has Claude draft a realistic 1,500–4,000-word interview transcript from the sketch,
   with an explicitly planted set of risks, controls, gaps and at least three deliberate
   omissions.
3. **SME edits for realism and plants two surprises the drafter did not know about.** This step
   is not optional — see the contamination warning below.
4. The answer key is recorded in a separate file the engine never sees:
   planted risks (library refs), controls, gaps, the omissions an auditor should chase, and
   the mandatory items that should end `open`.

> **Contamination warning.** A transcript written by Claude and then evaluated by Claude is
> partly circular: the drafter and the extractor share a prior. Three mitigations, all
> required: the SME edits every case; the *scoring* ground truth comes from the SME and the
> firm, never from the generator; and **the gate is decided on real anonymised cases and the
> human blind test, not on synthetic scores.** Synthetic cases measure progress. Real cases
> and auditors decide.

Cases 1–6 are C0 synthetic and committed to the repository.

---

## 7.6 The evaluation set — and a challenge to its size

The plan called for 30 scenarios. **Build 30 only if the corpus arrives cheaply.** The gate
decision does not need 30; it needs enough real cases to be credible and enough synthetic
spread to catch systematic blind spots.

| Set | Size | Composition | Use |
|---|---|---|---|
| **Dev** | 10 | The 6 smoke cases + 4 more synthetic | Prompt and pack iteration. Run freely |
| **Test** | 12–20 | **8–10 real anonymised (C1) with paired working papers** + 6–10 synthetic covering the edge matrix | **Locked.** Run at milestones only, ideally twice in the whole phase |

The binding constraint is not the count — it is **8–10 real cases with the firm's own final
working paper attached**. That pairing is what makes the experiment meaningful, and it is the
single hardest thing to obtain. Ask for it in week 1, before any feature conversation.

**Edge matrix for the synthetic portion** — one dimension varied per case: recognition timing
(point-in-time / over time), sales channel complexity, degree of automation, service
organisations, mid-year system change, manual journal volume, entity size, framework
(IFRS / local GAAP), interview language (NL / EN), interview quality (rich / sparse / evasive).

**Labelling protocol.** For real cases the firm's working paper is the primary gold. The SME
then adds what a competent auditor *should* have found but the paper omits, recorded
separately. This gives two recall numbers, and the difference between them is itself a
finding:

- **Recall vs firm** — parity with current practice.
- **Recall vs expert-augmented** — the quality ceiling.

Labelling effort: 45–75 minutes per real case for "confirm and add", against 2–3 hours for
labelling from scratch. Using the firm's paper as the base is the main reason SME days stay
in single digits.

---

## 7.7 Outputs the engine must generate

Per case, per run:

| Output | Form | Purpose |
|---|---|---|
| `facts.json` | `ProcessFact[]` | The grounding backbone |
| `coverage.json` | `CoverageAssessment` | Coverage %, mandatory items open |
| `missing.json` | `MissingFact[]` | Follow-up questions with origin and priority |
| `narrative.json`, `flow.json` | `NarrativeBlock[]`, `FlowStep[]` | |
| `risks.json`, `controls.json`, `gaps.json` | Typed arrays | |
| `grounding.json` | `GroundingReport` | The integrity check |
| `workingpaper.html` / `.docx` | Rendered document | **The blind test material** |
| `run.json` | Manifest | Model, prompt versions, hashes, cost, latency |

### Format blinding — a requirement, not a nicety

The blind test compares our document with the firm's own. If ours looks different, auditors
score their prior about AI rather than the content, and the experiment is worthless.
Therefore:

- **One neutral template.** The firm's original working paper is re-rendered into the same
  template as ours: same typeface, same heading levels, same section order, same length
  conventions, entity names replaced consistently across all documents.
- **No AI tells.** No hedging register, no "it appears that", no confidence language, no
  em-dash tics, no section that only an AI would write. The SME reads one rendered output and
  strikes anything that reads as machine-written before the test runs.
- **Provenance rendered as an appendix**, identically for all three documents — for ours it is
  populated, for the firm's it is whatever their file contains. Do not let the presence of a
  source index give the game away; if the firm's paper has no sources, that absence is itself
  a legitimate scoring input under *traceability*, and the raters should see it as such.

---

## 7.8 Metrics and thresholds

### Automatic — run on every suite execution

| Metric | Definition | Threshold |
|---|---|---|
| Schema validity | Objects passing their Zod schema | **100%** |
| Grounding integrity | Refs resolving to a real span in this case, quote matching | **100%** |
| Cross-case leakage | Refs pointing outside the case | **0 — hard fail** |
| Unsupported claims in the assembled paper | `needs_source` objects rendered as supported | **0** |
| Mandatory item completion | Mandatory coverage items resolved or explicitly recorded open | **100%** |
| Coverage recall | Items the engine marked covered that the SME agrees are covered | **≥ 85%** |
| Coverage precision | Items marked covered that the SME disputes | **≤ 10% disputed** |
| Risk recall vs firm | Ground-truth risks from the firm's paper that the engine found | **≥ 85%** |
| Risk recall vs expert-augmented | Including what the SME added | **≥ 75%** |
| Risk precision | Generated risks the SME rates relevant | **≥ 75%** |
| Control recall / false positives | Against the firm's paper plus SME additions | **≥ 80% / ≤ 20%** |
| Assertion mapping accuracy | Exact-set match against SME labels | **≥ 85%** |
| Missing-fact detection | Facts an experienced auditor would still need, that the engine flagged | **≥ 70%** |
| Run-to-run variance | Standard deviation of risk recall over 3 runs of the same case | **≤ 5 pp** |
| Cost per case | From the run manifest | **≤ €2** |
| Wall-clock per case | Serial, all stages | **≤ 6 min** |

**Variance is not optional.** With a threshold at 85%, a single run that scores 87% tells you
very little if the run-to-run spread is 9 points. Run the dev set three times before trusting
any number, and report means with spread throughout.

### Human — the gate itself

| Metric | Threshold |
|---|---|
| Blind preference: our document (raw or reviewed) preferred or judged equal to the firm's | **≥ 60%** of rater × case judgements |
| Blind preference: **reviewed** version vs the firm's | **> 50% preferred** — if the reviewed version cannot beat the firm's own paper, the workflow does not work |
| Expected review effort: reviewed version vs authoring from scratch | **≥ 40% lower**, self-reported and, where possible, timed |
| Blinding integrity | Raters correctly identify the AI document **< 80%** of the time — above that, the format blinding failed and the preference numbers are unreliable |

### Pass / fail logic

- **Hard fails, no discussion:** cross-case leakage > 0; grounding integrity < 100%;
  unsupported claims in an assembled paper > 0; blinding integrity ≥ 80%.
- **Gate passes** when: all hard checks clean, **and** the blind preference thresholds are met,
  **and** at least seven of the nine automatic quality metrics are at threshold with the
  remainder within five points.
- **Stop rule.** If after three full iteration cycles (roughly six weeks of engine work) blind
  preference is below 40%, stop and reconsider the product rather than grinding on prompts.
  Write down now what you would do in that case; deciding it in advance is what makes the stop
  rule real.

---

## 7.9 The blind preference test protocol

The most important experiment in the phase. Design it once, properly.

**Materials.** For each of 6 real (C1) cases, three documents:

- **A** — the firm's original working paper.
- **B** — raw engine output, unedited.
- **C** — engine output after an auditor's review pass (see below).

All rendered in the neutral template (§7.7), entity names pseudonymised consistently across
all three, labelled only `Document 1 / 2 / 3` with the mapping randomised per rater per case.

**Producing variant C without building a review workspace.** Export B to `.docx`, hand it to
an auditor who is *not* one of the raters, and ask them to make it file-ready. Time the edit.
This gives variant C and the review-effort measurement in one step — and it is the reason a
review UI is not needed in Phase 0.

**Raters.** 6–9 experienced auditors (senior to manager level) across the three design
partners. Each rater scores 3 cases × 3 documents ≈ 9 documents ≈ 2 hours. Six raters × 3
cases gives three independent ratings per case. **No rater scores a case from their own firm** —
they would recognise their own working paper, and the blinding collapses.

**Instructions to raters.** "These working papers were prepared by different teams. Score each
on the criteria below, then answer the preference question." Nothing about AI until the final
question.

**Scoring, 1–7 per criterion:** completeness · audit relevance · clarity · conciseness ·
traceability of conclusions to source · *expected review effort* (asked as: "how many minutes
of your time to make this file-ready?" — a number, not a scale).

**Then, per case:** "Which document would you rather start from?" (forced choice) and
"What is missing from your preferred document?" (free text — this is the richest output of the
whole experiment and the best backlog you will get).

**Finally, once, at the very end:** "Do you think any of these were AI-generated? Which?" —
the blinding integrity check. Ask it last so it cannot contaminate the scoring.

**Analysis.** Primary endpoint: proportion of rater × case judgements where B or C is preferred
or equal to A. Secondary: mean review-effort minutes by document type; per-criterion means;
the free-text themes. Report spread, not just means — with six raters this is a directional
experiment, and saying so plainly is what makes it credible rather than overclaimed.

**Known confound, stated in the write-up:** whoever produced C has seen B, so C inherits B's
framing. Mitigate by using a different auditor for the edit than for the rating, and time-box
the edit to 45 minutes so C is a realistic review rather than a rewrite.

---

## 7.10 Founder work

| Work | Days |
|---|---|
| Repo, workspaces, domain schemas, `LlmClient`, run manifest, CLI skeleton | 3–4 |
| Methodology pack authoring with Claude (12 sub-processes, coverage items, triggers, libraries) | 6–8 |
| Pack loader and validator, coverage state machine, deterministic triggers | 3–4 |
| Stages: `extractFacts`, `evaluateCoverage`, `identifyMissingFacts` | 3–4 |
| Stages: `generateNarrative`, `generateFlow` | 2–3 |
| Stages: `identifyRisks`, `identifyControls`, `identifyGaps` | 4–5 |
| `validateGrounding` + unit tests + adversarial fixtures | 2–3 |
| `assembleOutputs` + neutral renderer (HTML + docx) | 2–3 |
| Eval harness: corpus loader, metrics, variance runs, report | 3–4 |
| Synthetic case authoring (drafting, incorporating SME edits) | 2–3 |
| Blind test logistics: materials, randomisation, collection, analysis | 2 |
| Iteration, triage, write-up of the gate decision | 3–4 |
| **Total** | **35–47 → plan on 38** |

---

## 7.11 What genuinely requires the audit SME

| Work | SME days | Can it be delegated? |
|---|---|---|
| Pack review: 12 sub-processes, coverage items, mandatory flags | 2–3 | No — this is the professional judgement being encoded |
| Risk and control library review | 1–1.5 | Partly — a senior auditor can do a first pass |
| Realism editing + planting surprises in 6–10 synthetic cases | 1–2 | Partly |
| Ground-truth labelling of 8–10 real cases (confirm firm's paper + add) | 1.5–3 | **Yes** — the design partners' own staff can do much of this as part of their participation, and they benefit from it |
| Producing variant C (review pass) for 6 cases | 0.5–1 | Yes — a different auditor, deliberately |
| Reading one rendered output for AI tells before the blind test | 0.25 | No |
| Gate interpretation: pack gap vs model failure triage | 0.5–1 | No |
| **Total** | **7–12 → plan on 8** | |

**This is a correction to `00 §0.8`,** which assumed 3–5 SME days. Corpus construction,
labelling and the blind test were under-counted. At €700–1,200 a day, eight days is
€5.6–9.6k — which on its own would consume the Phase 0 budget. Hence the hard recommendation:
**get the SME on equity or advisory terms, or split the work so that the design partners'
own staff absorb the labelling.** If neither is possible, Phase 0 costs €10–18k, and that is
the honest number.

---

## 7.12 What requires an engineer or security specialist

**In Phase 0: nothing, and that is defensible** — there is no service, no authentication, no
multi-tenancy, no network exposure, and no C3 data. The security surface is one laptop and one
API key.

Two exceptions worth the money:

| Item | When | Days | Cash |
|---|---|---|---|
| Architecture review of the engine boundary and schemas, at the end of Phase 0 | Before Phase 1 builds on it | 0.5–1 | €0.9–1.2k |
| Reading the grounding validator adversarially | With the above | included | — |

Everything else — RLS, authorization, session handling, signed URLs — belongs to Phase 1 and
Phase 2, where it is reviewed under the five-file rule in `05 §5.1`.

---

## 7.13 Cost — cash and economics kept separate

Per your refinement, two numbers, always shown together.

### Model cost

Per case, at Opus 5 for narrative/risks/controls and Sonnet 5 for facts and coverage, with the
pack and profile in a cached prefix:

| Stage | Model | ≈ Cost |
|---|---|---|
| normalise + ingest | Haiku 4.5 | €0.03 |
| extractFacts, evaluateCoverage, identifyMissingFacts | Sonnet 5 | €0.12 |
| generateNarrative + flow | Opus 5, high | €0.25 |
| identifyRisks | Opus 5, high | €0.22 |
| identifyControls + gaps | Opus 5, high | €0.25 |
| **Per case** | | **≈ €0.90–1.60** |

| Run | Cost | Batched |
|---|---|---|
| Smoke set (6) | ~€7 | ~€3.50 |
| Dev set (10) | ~€12 | ~€6 |
| Test set (20) | ~€24 | ~€12 |
| **Phase 0 total** (≈150 smoke runs, ~20 dev runs, 2–3 test runs, plus ad-hoc) | **€1,200–3,000** | |

Three rules that keep this from running away: iterate on the smoke set and gate on the test
set; batch everything non-interactive; and keep the cached prefix byte-stable — a cache hit
rate below 90% on suite runs is a silent invalidator and shows up directly in the budget.

### Cash outlay

| Line | SME on equity | SME billing |
|---|---|---|
| Audit SME, 8 days | €0 | €5,600–9,600 |
| Model spend | €1,200–3,000 | €1,200–3,000 |
| Claude Code subscription, 2 months | €200–400 | €200–400 |
| Data-sharing agreement | €0–2,000 | €0–2,000 |
| Architecture review (optional, end of phase) | €0–1,200 | €0–1,200 |
| Domain, tooling | €100 | €100 |
| **Total cash** | **€1.5–6.7k** | **€7–16.3k** |

### Economic development cost

Not cash, but track it — it is what tells you later whether the AI-native approach genuinely
compressed effort, and it is the replacement cost of the asset.

| Input | Quantity | Notional rate | Economic value |
|---|---|---|---|
| Founder | 38 days | €700/day | €26,600 |
| Audit SME | 8 days | €900/day | €7,200 |
| Auditor raters + variant-C editors | ~16 hours | €120/hour | €1,900 |
| **Phase 0 economic cost** | | | **≈ €35,700** |

So Phase 0 is roughly **€2–7k of cash against €36k of economic effort**. The €32–60k figure
for the full run to a paid pilot should always be read as *external cash required under a
founder-heavy, AI-native build*, never as the economic cost of creating the software.

---

## 7.14 Founder days summary

38 days over 7 weeks — about 5.5 days a week, which is realistic only if the corpus and SME
work proceed in parallel rather than in sequence. See the critical path in §7.15.

---

## 7.15 The fastest credible sequence

| Week | Build | In parallel — start on day 1 |
|---|---|---|
| **1** | Repo, domain schemas, `LlmClient`, run manifest, CLI skeleton. `extractFacts` running against one hand-written transcript. Pack skeleton for R5 and R6 only | **Approach three design partners. Ask for paired cases and working papers first, features never. Send the data-sharing agreement. Open the model-provider terms conversation. Book the SME** |
| **2** | Pack to full breadth: all 12 sub-processes, coverage items, mandatory flags, triggers. `evaluateCoverage`, `identifyMissingFacts`. Synthetic cases 1–3 drafted | SME books time for the week-3 pack review. Corpus requests chased |
| **3** | `generateNarrative`, `generateFlow`, `identifyRisks`. `validateGrounding` with unit tests. Smoke set complete at 6 cases. **First end-to-end run** | **SME pack review (2–3 days)**. First anonymised real cases arrive |
| **4** | `identifyControls`, `identifyGaps`. `assembleOutputs` + neutral renderer. Eval harness with metrics. First full smoke measurement | SME labels the first real cases. **Book the blind-test raters now** — six auditors' diaries are a three-week lead time |
| **5** | Iteration against the dev set. Pack-gap vs model-failure triage. Variance runs (3× dev set). Prompt and pack fixes | SME labelling continues. Variant C produced for the first cases |
| **6** | Freeze. Locked run against the test set. Fix only clear defects, re-run once. Assemble blind-test materials | Remaining labelling; format-blinding check by the SME |
| **7** | **Blind preference test executed.** Analysis. Gate decision memo: pass / iterate / stop, with the evidence | Debrief with all three partners |

**The critical path is not code.** It is (1) the paired real cases with working papers,
(2) SME availability, and (3) six auditors' diaries for the blind test. All three are started
in week 1 or the plan slips by a fortnight regardless of how fast the engine is built. If the
corpus is late, weeks 5–6 run on synthetic cases and the gate moves — do not substitute
synthetic results for the gate.

### The bridge stage — after the gate, before Phase 2

Once Phase 0 passes, the next real-world step is **not** an audit client. Run a live
walkthrough of the **design partner's own revenue process**, with the firm itself as the
audited entity: real auditors, a real meeting, real ERP terminology, real professional
judgement and real follow-up behaviour — at data class **C2**, with no audit-client
confidentiality and no security review required. It sits between Phase 0's corpus and Phase 2's
real engagements, and it is the cheapest realistic test available. Record it, transcribe it
with the platform the firm already uses, and run it through the engine unchanged.

---

## 7.16 What must not be built in Phase 0

Each of these would consume days without moving the hypothesis. If one starts to feel
necessary, that is a signal to re-read the objective at the top of this document.

**Platform**
- Database, ORM, migrations, RLS runtime — the schema *shape* is designed now; the migration is Phase 1
- HTTP server, API, authentication, users, sessions, roles
- Multi-tenancy runtime, engagement management
- Cloud infrastructure, Docker, Terraform, deployment pipeline, observability stack
- Queues, workers, job scheduling — the CLI runs serially and that is fine

**Product**
- Any web application, including a "quick" review UI. **Variant C is produced by editing a
  `.docx`** (§7.9) — that is the entire reason a review workspace is not needed yet
- Client questionnaire, client portal, invitations, evidence requests
- File upload, OCR, PDF ingestion — Phase 0 input is plain text
- Engagement dashboard, status tracking, notifications

**Pipeline**
- Embeddings, vector search, RAG — the transcript *is* the input; retrieval adds noise and cost
  and would confound the measurement
- Key-control selection, RCM assembly, test procedures, prior-year comparison
- The live coverage tick, ASR, diarisation, WebRTC — anything real-time
- Agent frameworks, tool-calling loops, multi-agent orchestration; the staged pipeline is the design
- Any fine-tuning or training on customer data — ever

**Content**
- Any process other than Revenue
- Firm-specific methodology configuration — Phase 0 runs one neutral methodology
- Sample-size tables, firm templates, Word styling beyond the single neutral renderer

**Process**
- A second strategy document. This plan and `00` are the baseline; the next document worth
  writing is the Phase 0 gate memo.
