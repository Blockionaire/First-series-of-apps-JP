# UX Findings

Product and data-model gaps discovered while designing and building the prototype.

**These are findings, not changes.** No file under `audit-platform/audit-engine/` has been
modified from this session. Each finding names the observation, why it matters, the suggested
product change, the engine impact if any, and a priority. The engine track decides what, if
anything, to act on.

Priorities: **P1** — blocks a Phase 1 build or produces professionally wrong output.
**P2** — materially affects review efficiency or auditor trust. **P3** — worth knowing.

---

## F-01 · Contradiction is a flag, not an object

**Priority: P1** · Engine impact: **schema change**

**Observation.** `CoverageItemState.flags` includes `"contradiction"`, but nothing in
`packages/domain` holds the contradiction itself: which fact key is in dispute, which two (or
more) evidence refs disagree, what each says, or what the auditor decided. The prototype needed
all four to build the resolution screen, so it carries them in view data — which means the
engine could detect a contradiction and the product could not render it.

**Why it matters.** In the mock engagement, one contradiction (who may change a credit limit)
blocks a narrative block, a control (`C-02`), a risk (`R-07`) and a coverage item. It is the
single most persuasive moment in the demo, because it is a thing no auditor would have caught
before write-up. Without a typed object, the UI cannot show the two quotes side by side, and
the resolution cannot be recorded as documentation.

**Suggested product change.** A first-class `Contradiction` object:

```ts
Contradiction = {
  id, coverageItemId, factKey,
  positions: [{ value, evidenceRefs, source }],   // 2+
  detectedBy: "cross_source_check" | "model_proposed",
  blocks: string[],                               // ids of objects that cannot be concluded
  resolution: { choice, rationale, decidedBy, decidedAt } | null,
}
```

**Engine impact.** A new schema in `packages/domain`, a cross-source check after S3
(deterministic where two facts for the same `fact_key` differ), and `blocks[]` populated during
assembly. Everything downstream reads it; nothing existing has to change shape.

---

## F-02 · Nothing in the model records who decided what

**Priority: P1 for Phase 1** · Engine impact: **schema addition**

**Observation.** `GroundableBase` carries `id`, `engagementId`, `evidenceRefs` and `grounding`.
There is no review state, no preparer, no reviewer, no timestamp. This is correct for Phase 0 —
the review page is read-only and the blind test does not need it. But the entire review
workspace, the sign-off gates and the export exclusion logic in this prototype are built on
state the domain model has no place for.

**Why it matters.** ISA 230 requires the file to record who performed the work and who reviewed
it. If review state is added later as an application-layer concern, the canonical JSON export —
which is meant to *be* the audit file record — will not contain the one thing an inspector
looks for first.

**Suggested product change.** Extend `GroundableBase`:

```ts
review: {
  state: "draft" | "edited" | "approved" | "rejected",
  editedText: string | null,            // the auditor's text, never overwritten by regeneration
  preparedBy, preparedAt,
  reviewedBy, reviewedAt,
  rejectionReason: string | null,
}
```

**Engine impact.** Additive. Phase 0 writes `state: "draft"` and nulls; the validator ignores it.
Deciding it now costs nothing and avoids a migration over every record later.

---

## F-03 · Narrative section granularity does not match sub-process granularity

**Priority: P2** · Engine impact: **generation prompt / assembly**

**Observation.** `NarrativeBlock` carries `subProcess`, and S4 generates per sub-process. But a
working paper does not read as twelve sub-process sections. It opens with an overview, a systems
section and a roles-and-responsibilities section — and each of those spans several sub-processes
(roles draws on R1, R2, R3, R5, R8 and R11). The prototype's fourteen sections had to be authored
against a different spine from the one the engine emits.

**Why it matters.** If the product regroups the engine's output for presentation, the mapping
between an approved section and the blocks it contains becomes application logic, and the
canonical export no longer matches what the auditor approved.

**Suggested product change.** Add a `section` field to `NarrativeBlock` — a document section id
from a template in the pack — alongside `subProcess`. One block belongs to one section and one
sub-process; the section is the review and export unit, the sub-process stays the methodology
unit.

**Engine impact.** One field, plus a `narrative_sections` list in the pack. S4's prompt asks for
the section as well as the sub-process.

---

## F-04 · Sentence-level provenance would make review slower, not more trustworthy

**Priority: P2** · Engine impact: **none — this is a product decision**

**Observation.** The instinct is to attach evidence to every sentence. Building the review
workspace showed the cost: the fourteen-section narrative contains 41 blocks and would contain
roughly 90 sentences. At sentence granularity the document becomes unreadable (a chip every
line) and approval becomes ninety clicks — replacing writing with clicking, which is the failure
mode `01 §1.6` warns about.

**What works instead**, and is what the prototype does: evidence attaches to the **block** (a
claim-bearing paragraph, one to three sentences), status is tracked per block, and approval
happens per **section**. A section is approvable only when every block inside it is grounded or
auditor-authored. Fourteen decisions, with one ungrounded sentence still able to stop its
section.

**Suggested product change.** Fix the block as the provenance unit in the product spec, and
instruct S4 to emit one claim per block rather than paragraph-length prose. Record explicitly
that sentence-level provenance was considered and rejected on review-cost grounds.

---

## F-05 · `MissingFact` cannot carry a follow-up through its lifecycle

**Priority: P1** · Engine impact: **schema change**

**Observation.** `MissingFact` has `coverageItemId`, `factKey`, `why`, `question`, `origin`,
`priority`, `triggerId`. It has no id, no state, no owner, no sent date and no record of what it
blocks. The Open Items screen needed every one of those, and it is the screen that makes the
product useful on the days the AI cannot finish the documentation.

**Why it matters.** A follow-up question that cannot be assigned, tracked or closed is a note,
not a workflow. The whole value claim — "follow-ups happen during the walkthrough instead of a
week later" — depends on them being live objects.

**Suggested product change.**

```ts
OpenItem = MissingFact & {
  id,
  state: "open" | "sent" | "answered" | "resolved" | "dismissed",
  owner: string | null,          // auditor, or the client contact it was sent to
  sentAt, answeredAt,
  blocks: string[],              // narrative blocks, risks or controls that cannot be concluded
  dismissalReason: string | null,   // required to dismiss; becomes documentation
}
```

**Engine impact.** Rename and extend. Phase 0 emits `state: "open"` with nulls.

---

## F-06 · Evidence requests are not questions and need their own type

**Priority: P2** · Engine impact: **new schema**

**Observation.** "Who reviews the price override report?" and "Send me the price override report
configuration and one month of output" are both currently `MissingFact`s. They behave completely
differently: one is answered in text and closes a fact; the other produces a document that has to
be ingested, re-run through S3, and may open new facts.

**Why it matters.** Four of the ten open items in the mock engagement are evidence requests. The
best of them — *the ISAE 3402 report covers FY2025 and Van Dijk has only run the process since
March 2026* — is not a missing fact at all. It is a gap in assurance coverage that a competent
auditor should raise, and design partners will notice whether the product can express it.

**Suggested product change.** `EvidenceRequest { id, title, why, coverageItemIds[], requestedFrom,
state, receivedSourceId }`, with receipt re-triggering ingest for the affected coverage items.

---

## F-07 · The key-control criteria structure is right, and should not be changed

**Priority: P3** · Engine impact: **none — validation of an existing design**

**Observation.** `KeyControlProposal.criteria` — six named criteria, each `met` / `not_met` /
`unknown`, plus a rationale and `follow_up_needed[]` — turned out to be the single best thing to
put on screen in the whole controls surface. It renders as a six-row table that explains the
proposal without any prose, and an `unknown` reads instantly as *this is the auditor's work, not
the model's*.

**Why it matters.** It is worth recording that this design was validated by use, because the
temptation in a later iteration will be to collapse it into a score. Control `C-10` in the mock
engagement — the monthly management review, with two criteria unknown — is the case that proves
the value: the honest output is *cannot be assessed*, and a score would have hidden that.

**Suggested product change.** None. Consider extending the same pattern to significant-risk
determination, which is currently a single boolean.

---

## F-08 · Coverage percentage needs a stated denominator everywhere it appears

**Priority: P2** · Engine impact: **presentation contract, not schema**

**Observation.** `CoverageAssessment.coveragePct` is a single number. Building the screens showed
it is ambiguous in three ways: partially covered items (counted as half in a sub-process bar, not
at all in the headline), not-applicable items (removed from the denominator), and the fact that
it measures the understanding rather than the audit.

**Why it matters.** A partner will ask what 84% means within ten seconds of seeing it. If the
answer takes a paragraph, the number is a liability. `02 §2.1` already commits to "the UI says
so" — this finding is that the *data* should say so too, so every surface says the same thing.

**Suggested product change.** Return the components rather than only the percentage:
`{ covered, partial, open, notApplicable, applicable, total, pct }`, and fix the wording once:
*"37 of 44 applicable items covered · 1 not applicable"*.

---

## F-09 · Nothing links a regenerated object to what it replaced

**Priority: P2** · Engine impact: **schema addition**

**Observation.** `01 §1.5.3` requires that nothing regenerates silently and that regeneration
produces a visible diff requiring re-approval. There is no field anywhere in `packages/domain`
that links a new object to its predecessor, so the diff cannot be computed.

**Why it matters.** Regenerate-this-block is one of the four actions on every block in the review
workspace. Without a version link the product either loses the auditor's review context on every
regeneration, or fakes the diff by text similarity.

**Suggested product change.** `supersedes: string | null` and `version: number` on
`GroundableBase`, with the run manifest recording which stage produced which version.

---

## F-10 · A risk that cannot be concluded needs a way to say so

**Priority: P2** · Engine impact: **small schema addition**

**Observation.** `Risk` has no state expressing *this cannot be concluded yet*. In the mock
engagement, `R-07` (credit limits raised outside credit control) depends entirely on the
unresolved contradiction: accepting or rejecting it now would be a guess either way. The
prototype models this as `blocked`, driven by an open item.

**Why it matters.** The alternative behaviours are both bad: the model concludes anyway (a
guess presented as a conclusion), or the risk is omitted (absence hidden). The whole product
argument rests on the third option — *we identified this, and here is what stops us finishing it*.

**Suggested product change.** `blockedBy: string[]` (open item or contradiction ids) on `Risk`,
`Control` and `NarrativeBlock`, populated during assembly. The sign-off gate then becomes
computable rather than hand-written.

---

## F-11 · "Not obtained" and "needs source" look similar and mean opposite things

**Priority: P2** · Engine impact: **none — product vocabulary**

**Observation.** Two states are easy to conflate and are opposites in professional terms.
*Not obtained* is **good output**: the model correctly documented that the information was not
available, and that statement is grounded, approvable and belongs in the file. *Needs source* is
**a failure**: the model asserted something it could not support, and the statement must not be
approved.

**Why it matters.** If they share a visual treatment, an auditor learns to dismiss both, and the
grounding gate loses its force. In the prototype they are deliberately separated: not-obtained is
grey, italic and approvable; needs-source is amber and blocks the section.

**Suggested product change.** Fix the vocabulary in the product spec, and never render them in
the same colour family. Consider renaming `grounding: "needs_source"` to something that reads as
a defect (`"unsupported"`), since `needs_source` sounds like a to-do rather than a stop.

---

## F-12 · The pack's `follow_up_triggers` are the most demonstrable thing in the product

**Priority: P3** · Engine impact: **none — surface an existing field**

**Observation.** Showing an auditor that a follow-up came from a named deterministic rule
(`R5.3.T2`) rather than from the model's initiative changes the conversation completely. It is
the clearest available answer to *how is this different from ChatGPT*, and it is already in the
pack — `followUpTriggers[].id` — but is not currently carried through to the output.

**Suggested product change.** Ensure `triggerId` survives into every open item and is surfaced in
the UI. `MissingFact` already has the field; make sure it is populated and never null for
rule-derived questions.

---

---

# Findings from the second iteration

The redesign (`NEXT-GEN-UX-DIRECTION.md`) surfaced three more, all of them about what the engine
should *emit* rather than how it should be displayed.

## F-13 · The engine should emit the statement it can support, not only the flag

**Priority: P1** · Engine impact: **stage output**

**Observation.** When grounding validation fails, the engine currently produces
`grounding = needs_source` and nothing else. The auditor is left with an unsupported sentence and
a blank page. Building the focus queue made it obvious that the single most valuable thing the
product can offer at that moment is *the version of the sentence the evidence does support* —
which the engine is uniquely well placed to write, because it already knows which facts it had.

**Why it matters.** With the fallback, resolving an unsupported claim is one keystroke. Without
it, it is a writing task, and the reviewer is doing exactly the authoring work the product exists
to remove. In the prototype this is the difference between four judgements in four keystrokes and
four judgements in four paragraphs.

**Suggested product change.** Every object that fails grounding carries
`supported_alternative: string | null` — the same claim narrowed to what the evidence actually
establishes, itself grounded — plus the existing `why`. Where nothing at all can be supported,
`null`, and the UI offers only edit, ask or reject.

**Engine impact.** A second, cheap pass over the failed objects after S8, with the retrieved
evidence in context. It is not a new stage so much as a repair step.

## F-14 · Coverage items need a plain-language form of their gap

**Priority: P2** · Engine impact: **methodology pack**

**Observation.** The pack's `questionIntent` is written to steer the interview ("How is the
invoice amount derived, and what prevents it from being wrong?"). It is the wrong sentence to put
on a coverage screen, where the auditor's question is what is *missing*. The prototype had to
author a `plain` string per gap by hand: *"Who reviews the price override report, and what happens
when an exception is found."*

**Why it matters.** This is the difference between the coverage screen reading like methodology
software and reading like a colleague's summary. It is a content change, not a code change, and
the SME can write it while reviewing each item.

**Suggested product change.** Add `gapStatement` to each coverage item in the pack — one sentence
naming what is not yet known, phrased so it can follow the words "we don't yet know". Same
review format, two hours of SME time for the whole pack.

## F-15 · The exception set is a live view, not a snapshot

**Priority: P3** · Engine impact: **none — product spec**

**Observation.** A queue of items needing judgement shrinks as it is worked, so anything holding
a position in it must be re-derived after every decision rather than advanced. The prototype's
first implementation silently skipped every other item because it incremented an index into a
list that had already shortened.

**Why it matters.** It is not a UI bug so much as a modelling one, and it will recur in any
production implementation that treats "what needs attention" as a fetched list rather than a
derived view. In an audit product, silently skipping an item that needed a judgement is the worst
class of defect there is.

**Suggested product change.** State it in the product spec: the exception set is derived from
current object state on every read; positions in it are identified by object id, never by index.

---

# Findings from the third iteration

Reframing the product around the full process-level interim audit
(`V3-DESIGN-DIRECTION.md`) surfaced two structural gaps, both about objects the engine has no
representation for at all.

## F-16 · There is no process-step model, so there is nothing to draw or to test against

**Priority: P1** · Engine impact: **new schema + a generation stage**

**Observation.** The engine emits `NarrativeBlock`s grouped by sub-process and `FlowStep`s with a
sequence number, actor, system and action. `FlowStep` is close, but it is a flow *of the
narrative*, not a model of the process: it has no stable identity across runs, nothing attaches
controls or findings to it, and it is not the unit anything else refers to.

The prototype needed a `ProcessStep` — a named stage of the process, with its actor, its system,
the controls that operate on it and the findings recorded against it — to build the Process
Understanding Map, to annotate that map with controls in step 4, and to trace a transaction
against it in step 5. All three of V3's new surfaces stand on this one object.

**Why it matters.** Without it, the map is a picture the application draws from prose, which
means it can drift from the documentation it claims to represent, and the line walkthrough has
nothing stable to trace against. It also happens to be the object that makes the product legible
in ten seconds to someone who will not read a narrative.

**Suggested product change.**

```ts
ProcessStep = {
  id, engagementId, seq,
  name, actor, system,
  description,                 // one sentence, grounded
  subProcess,                  // the methodology unit it belongs to
  controlIds: string[],
  findingIds: string[],
  evidenceRefs: EvidenceRef[],
}
```

Generated once alongside the narrative, from the same facts, so the two cannot disagree.

## F-17 · The line walkthrough has no representation at all

**Priority: P1** · Engine impact: **new schema; a stage that is mostly deterministic**

**Observation.** Nothing in `packages/domain` expresses *expected versus actual*. A line
walkthrough compares, for each process step, what should have happened and what evidence should
exist against what was actually obtained, and concludes corroborated or exception.

**Why it matters.** It is the step that tests the process model against reality — in the mock
engagement it is what finds that the invoice preceded customer acceptance by seven days, which no
amount of interviewing surfaced. It is also the strongest demonstration that the product is an
audit workspace rather than a documentation generator, and the engine currently cannot produce
any part of it.

**Suggested product change.**

```ts
LineWalkthrough = {
  id, engagementId, transactionRef, selectionRationale,
  steps: [{
    processStepId,
    expectedStep, expectedControlId, expectedEvidence,   // derived from the process model
    actualEvidence, evidenceRefs,                        // obtained
    observation,
    proposedVerdict: "corroborated" | "exception",
    auditorVerdict: ... | null,
    exceptionDescription: string | null,
  }],
  notApplicableSteps: [{ processStepId, reason }],
  conclusion, raisedFindingIds: string[],
}
```

Most of this is deterministic once the process model exists: the *expected* columns come straight
from `ProcessStep` and its controls. The model's contribution is comparing supplied evidence
against expectation and proposing a verdict — and, in the mock case, noticing that two dates on
one order are the wrong way round.

## F-18 · Concluding on risks belongs to the next phase, not to interim

**Priority: P2** · Engine impact: **none — product scope**

**Observation.** V2 asked the auditor to accept, modify or reject each identified risk. That is
risk assessment, which happens after the process work with the process understanding as an input.
V3 removed the queue: risks are still identified, library-mapped and exported in the matrix, but
they are carried forward rather than concluded.

**Why it matters worth recording:** the engine's `Risk` output is unchanged and still valuable —
what changed is who consumes it and when. If a later product covers risk analysis, the interim
product's job is to hand over a complete, provenance-carrying set of candidate risks, not a set of
half-made decisions.

---

## F-19 · A process has variants, and almost everything downstream depends on them

**Priority: P1** · Engine impact: **schema change**

**Observation.** The prototype modelled Revenue as one linear flow. It is not. Machine sales,
spare part sales and service contracts share most of their steps, diverge at installation and at
billing, and converge at revenue posting. They also have two different recognition bases. Once
that is admitted, four things stop being process-level and become variant-level: which steps
exist, which line walkthroughs are required, which transactions are candidates, and what
"complete" means.

**Why it matters.** A file that says "we walked through Revenue" when it walked through one
machine sale has not covered spare parts at all, and nothing in the file says so. This is not a
presentation problem — it is the difference between coverage and the appearance of coverage.

**Suggested engine change.** A `ProcessVariant` alongside `ProcessStep`, with steps declaring
their variant membership rather than a single ordered list:

```
ProcessVariant {
  id, processId, name,
  revenueStream, materiality,                    // for scoping
  recognitionBasis: "point_in_time" | "over_time",
  description, evidenceRefs,
}

ProcessStep {
  ...,
  variantIds: string[],        // which paths this step is on
  next: string[],              // successors — the graph, not an index
  isConvergencePoint: boolean,
  skipReason: string | null,   // why a variant that reaches here does not use it
}
```

The step list becomes a directed graph. Generation should propose variants from the sources (the
transcript distinguishes them plainly) and the auditor confirms them, exactly as with everything
else the engine proposes.

---

## F-20 · Line walkthrough scope is a decision with a reason, not a default

**Priority: P1** · Engine impact: **new schema**

**Observation.** The first version of the trace assumed one walkthrough was required and pre-seeded
it. Whether a variant needs a line walkthrough is a methodology question answered per variant, and
"not required" is a legitimate answer that has to carry a reason a reviewer can assess. Pre-seeding
the answer from the pack made the platform decide.

**Suggested engine change.**

```
LineWalkthroughRequirement {
  id, engagementId, processId, variantId,
  proposedState: "required" | "not_required",   // from the methodology pack
  proposedRationale: string | null,
  auditorState: "required" | "not_required" | null,
  auditorRationale: string | null,              // mandatory when not_required
  decidedBy, decidedAt,
}
```

The pack proposes; the auditor decides; both are stored. The completion gate reads the auditor
value and is unmet while it is null — which is what makes "we did not think about spare parts" a
visible state rather than an invisible one.

---

## F-21 · Control testing needs a scope decision before it needs a test

**Priority: P2** · Engine impact: **new schema**

**Observation.** Concluding that a control is key does not mean it will be tested. Testing follows
an intention to rely, and deciding *not* to rely — responding substantively instead — is a normal
outcome that has to be recorded. Without that object the step is either always outstanding or
silently skipped.

**Suggested engine change.**

```
ControlTestingRequirement {
  id, engagementId, controlId,
  state: "required" | "not_required" | "not_decided",
  rationale: string | null,          // mandatory when not_required
  plannedReliance: boolean,
  decidedBy, decidedAt,
}
```

Two consequences for the test object itself: extending a sample must be a change to the
`selection`, never a value of `conclusion`; and the conclusion vocabulary must be closed to
`rely` / `do_not_rely`, so that "we extended it" cannot be mistaken for an answer.

---

## F-22 · Undecided is a bookmark, and the model has to say so

**Priority: P1** · Engine impact: **additive fields**

**Observation.** The prototype allowed a control to be set to `undecided` and treated that as
concluded, which cleared it from the queue and from the completion gate. That is the single most
dangerous class of bug in an audit tool: an uncompleted judgement that looks completed.

**Suggested engine change.** Separate the values that conclude from the values that do not, and
give "moving on anyway" its own explicit object:

```
CarryForwardDecision {
  id, subjectType: "control" | "open_item" | "finding" | "coverage_item",
  subjectId,
  destination: "final_audit" | "risk_analysis" | "next_interim" | "group_team",
  rationale: string,           // mandatory
  decidedBy, decidedAt,
}
```

Any derived "is this concluded?" predicate then reads: an explicit conclusion, or a
`CarryForwardDecision`. Nothing else. `undecided` stays in the record as the auditor's bookmark
and keeps the item in its queue.

---

## F-23 · The auditor's conclusion is a different value from the system's proposal

**Priority: P1** · Engine impact: **additive fields**

**Observation.** Findings could be confirmed or dismissed but not modified, so an auditor who
disagreed with the wording or the severity had to dismiss a real finding or accept a wrong one.
Once modification exists, the file has to hold both versions — what the platform proposed and what
the auditor concluded — or the record of what the tool actually contributed disappears.

**Suggested engine change.** On every auditor-facing generated object:

```
proposal:   { title, severity, impact, remediation, ... }   // immutable, as generated
conclusion: { decision: "confirmed" | "modified" | "dismissed",
              title, severity, impact, remediation,          // present when modified
              decidedBy, decidedAt } | null
```

This also answers a question the firm will eventually ask about every AI feature: how often did
the auditor change what it produced, and in which direction? That is not measurable unless both
values are kept.

---

## F-24 · Sign-off is a state machine, not a boolean

**Priority: P1** · Engine impact: **schema change** (supersedes part of F-02)

**Observation.** "Signed" and "complete" were the same thing in the prototype, which made ready
for review indistinguishable from reviewed. In the firm's actual workflow they are six states, and
which of them are required is configuration, not code — process-level partner review applies to
PIE and listed engagements and not to others.

**Suggested engine change.**

```
SignOffState {
  preparer: "unsigned" | "signed",
  review:   "not_submitted" | "submitted" | "in_review" | "approved" | "reopened",
  partner:  "not_required" | "not_submitted" | ... ,
  signatures: [{ role, userId, at }],
  reviewPoints: ReviewPoint[],        // what "reopened" carries
}

MethodologyConfig {
  requiresManagerReview: boolean,
  requiresPartnerReview: boolean,
  partnerReviewRationale: string,
}
```

Completion gates must declare `applicable` and be filtered by it, so a condition that does not
apply to this engagement is absent rather than permanently unmet. A gate list that can never
reach zero teaches auditors to ignore it.

---

## F-25 · A questionnaire answer is evidence, not a separate application

**Priority: P2** · Engine impact: **none — wiring**

**Observation.** The client questionnaire looked connected and was not: answering a question
changed nothing in coverage, and "I don't know" and "I'd rather have a call" did nothing at all.
All three are different states of the same fact, and the last two are new work for the auditor.

**Suggested product change.** A questionnaire response resolves the `MissingFact` it was raised
for, updates the coverage item that owns it, and closes the open item that was chasing it — one
write, three visible consequences. A non-answer resolves nothing and raises an open item with the
reason it could not be answered, which is genuinely more useful than a guess.

---

## Summary

| # | Finding | Priority | Engine impact |
|---|---|---|---|
| F-01 | Contradiction is a flag, not an object | P1 | New schema + cross-source check |
| F-02 | No review state, preparer or reviewer in the model | P1 | Additive fields on `GroundableBase` |
| F-03 | Narrative sections ≠ sub-processes | P2 | One field + pack section list |
| F-04 | Sentence-level provenance rejected; block is the unit | P2 | None (S4 prompt guidance) |
| F-05 | `MissingFact` has no lifecycle | P1 | Rename and extend |
| F-06 | Evidence requests need their own type | P2 | New schema |
| F-07 | Key-control criteria structure validated | P3 | None |
| F-08 | Coverage % needs its components | P2 | Return components |
| F-09 | No version link for regeneration | P2 | `supersedes` + `version` |
| F-10 | No way to say a risk cannot be concluded | P2 | `blockedBy[]` |
| F-11 | "Not obtained" vs "needs source" must not look alike | P2 | None (vocabulary) |
| F-12 | Surface the deterministic trigger id | P3 | None (populate existing field) |
| F-13 | Emit the statement the evidence *does* support | P1 | A repair pass after validation |
| F-14 | Coverage items need a plain-language gap statement | P2 | Pack content |
| F-15 | The exception set is a derived view, not a list | P3 | None (product spec) |
| F-16 | No process-step model to draw or trace against | P1 | New schema + generation stage |
| F-17 | The line walkthrough has no representation | P1 | New schema; mostly deterministic |
| F-18 | Risks are carried forward, not concluded in interim | P2 | None (product scope) |
| F-19 | A process has variants; the step list is a graph | P1 | New schema + graph on `ProcessStep` |
| F-20 | Line-walkthrough scope is a decision with a reason | P1 | New schema |
| F-21 | Control testing needs a scope decision first | P2 | New schema |
| F-22 | Undecided is a bookmark, not a conclusion | P1 | Additive fields + `CarryForwardDecision` |
| F-23 | Proposal and conclusion are two values | P1 | Additive fields |
| F-24 | Sign-off is a state machine, and gates are conditional | P1 | Schema change |
| F-25 | A questionnaire answer is evidence | P2 | None (wiring) |

**F-16, F-17 and F-19 are the three that change what the engine produces**, and everything the
current prototype does downstream of step three depends on them. F-19 is the one to settle first:
variants change the shape of `ProcessStep`, and every later object that references a step —
walkthrough requirements, traces, coverage — inherits that shape.

**F-22, F-23 and F-24 are cheap now and expensive later.** All three are additive fields that
separate a proposal from a conclusion and an intention from a decision. Retrofitting them means
migrating records whose meaning is already ambiguous, which is a much worse problem than adding a
column. F-22 in particular is a correctness issue rather than a UX one: the prototype shipped a
version in which an unmade judgement counted as a made one, and nothing in the data model
prevented it.

Five earlier findings (F-01, F-02, F-05, F-10, F-13) remain in the same category. F-24 supersedes
the review-state half of F-02: a boolean is not enough, and the shape it should take is now known
from building it.
