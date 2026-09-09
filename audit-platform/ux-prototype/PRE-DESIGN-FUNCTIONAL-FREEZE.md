# Pre-Design Functional Freeze

The canonical functional model of the Audit AI interim product, as at the end of the pre-design
correction passes. **The V3 visual and interaction design must preserve everything in this
document.** Screens, layout, typography, colour, density and navigation mechanics are all open.
What is described here is not.

Where this document and the code disagree, this document is wrong and should be corrected — it
describes what was built and tested, not an intention.

---

## 1. Scope

The product covers **process-level interim audit work on one process**, inside an engagement.

Upstream, and **not** in this product: client acceptance, entity and IT understanding, the
identification of inherent risk factors, and materiality. Interim *receives* this work and shows
it read-only in step 1.

Downstream, and **not** in this product: **risk analysis** — the assessment of risks of material
misstatement — the final audit, and completion. Interim *hands forward* to them.

The product is not a Revenue application. Revenue is the one process with a methodology pack.

---

## 2. The seven steps

| # | Step | Route | The question it answers |
|---|---|---|---|
| 1 | Prepare | `#/prepare` | What do we already know, and who do we need? |
| 2 | Process interview | `#/interview` | How does this process actually work? |
| 3 | Understanding | `#/understanding` | Can we describe it, and is the description supported? |
| 4 | Controls & findings | `#/controls` | What controls it, and what is wrong with it? |
| 5 | Line walkthrough | `#/trace` | Do real transactions behave the way we documented? |
| 6 | Control testing | `#/testing` | Do the controls we intend to rely on operate? |
| 7 | Complete | `#/complete` | Is it reviewed, signed and handed forward? |

The order is fixed. The journey bar is stateful, not a tab bar: each step reports what it still
owes, and a step that cannot start says why.

Above the process sits the **engagement layer** (`#/engagement`): client, financial year, four
audit phases, six processes. Only Revenue is in scope.

### Step boundaries — the part most easily lost

**Step 2 is the whole input flow**, not one meeting. Interview transcript, client questionnaire,
documents and auditor notes all land here and feed one coverage model. Drafting is not completing:
the interview stays open, and a later answer re-enters it.

**Step 3 establishes and documents how the process works, and does nothing else.** Its nine stages
normalise sources, extract process facts, evaluate methodology coverage, structure the process and
its variants, generate the narrative, assemble the map, identify statements needing clarification,
validate grounding, and assemble the workpaper. It identifies **no** control, **no** finding and
**no** risk signal.

**Step 4 is a second, separate analysis run** against the understanding *the auditor has already
reviewed*. Its seven stages identify controls, identify gaps and process findings, identify risk
signals, map controls to signals, evaluate the six key-control criteria, validate references, and
assemble the matrix and the review queues. Step 4 cannot run while sections of the understanding
are unreviewed.

An implementation may share one model call across the two. The separation is the **product model**:
understand the process → review that understanding → then analyse it.

**Step 5 is not step 6.** A line walkthrough traces one real transaction against the documented
process to test whether the model is right. Control testing takes a population and a sample to test
whether a control operates. Neither substitutes for the other, and a walkthrough step where a
control did not need to operate is a corroborated step, not a tested control.

---

## 3. Process variants

A process is **not** one linear flow. Revenue has three variants — machine sales, spare part sales,
service contracts — which share steps, diverge, and converge at revenue posting. `processSteps` is
a graph: each step declares which variants it belongs to and what follows it, and the map is drawn
from that. The map and the model cannot disagree.

Variants are load-bearing for:

- which steps exist on a given path;
- whether a line walkthrough is required, decided **per variant**;
- which transactions are candidates for it;
- what "the process has been walked through" means.

A walkthrough of one variant is never evidence about another, and the file must not read as though
it were.

---

## 4. Evidence and provenance

**No claim without a source.** Every generated statement, control, finding and risk signal carries
at least one evidence reference, and the validation stage is ordinary code: the quote must occur in
the source it cites. A statement that cannot be grounded is marked *needs support* and cannot be
approved — it is never silently dropped and never softened into a lower-confidence claim.

Evidence is **inspectable inline**: click a statement and the source opens beneath it — speaker,
locator, exact words.

**Anything established during the session becomes evidence too.** A questionnaire answer submitted
now is registered as a source record (question, answer, respondent, timestamp, stable id) and the
fact then cites it. Facts are never updated by an unexplained internal override.

A non-answer creates no evidence. "I don't know" and "I'd rather have a call" establish nothing,
leave the fact unknown, and raise an open item for the auditor.

---

## 5. Where the human decision boundary sits

**AI proposes, the auditor decides.** The platform never concludes, never signs, and never resolves
uncertainty by choosing an answer.

The proposal and the conclusion are **two stored values**, never one. A finding carries what the
platform proposed; confirming, modifying or dismissing it records what the auditor concluded, and
modification is full — title, description, severity, impact and remediation. The original proposal
is preserved and remains visible.

Three rules follow, and none of them may be relaxed for a cleaner interface:

**Unknown is not not-applicable.** A fact nobody established and a fact that does not apply are
different states, and "not applicable" carries a documented reason.

**Undecided is not a conclusion.** A control left undecided stays in its queue and keeps its
completion gate unmet. Moving on despite the uncertainty is an explicit *carry forward* that
requires a reason. The same applies to open items, which carry a destination and a rationale.

**Uncertainty is preserved, not resolved.** A criterion that cannot be established produces a
follow-up question, never a low-confidence answer. Where two sources disagree, both are kept.

---

## 6. Contradictions

A contradiction is a first-class object with two conflicting sources, not a flag. Resolving it is
one action that propagates to the statement, the underlying facts, the coverage item that owns
them, the open item raised to chase it, and the completion gate.

It can be resolved in the evidence's favour (one source reflects the process; or both routes exist)
**or** left unresolved and carried forward. Carrying forward preserves the conflict — it does not
resolve it, and **the completion gate stays blocked**. The gate is worded "No unresolved
contradictions" so that the label and the logic agree.

---

## 7. Control testing

Conditional, and **per control**:

1. Nothing is testable until a control has been concluded as key.
2. Each key control gets a **scope decision** — test required, or not required with a reason.
   Deciding not to rely and responding substantively is a legitimate outcome.
3. Each control scoped for testing carries **its own** test state and **its own** conclusion.
4. **Extending a sample is not a conclusion.** It changes the selection and the test stays open.
5. Only *rely* or *do not rely* closes a test, and it closes that control only.

Step 6 is satisfied when every key control has a scope decision and every control scoped for
testing has its own conclusion. One conclusion never closes another control's test.

---

## 8. Review and sign-off lifecycle

Six states, not a boolean:

```
work in progress → ready to sign → preparer signed → submitted → in review
                                                          ↓            ↓
                                                      reopened ←───────┤
                                                          ↓            ↓
                                                     (points answered) approved = COMPLETE
```

**Ready for review is not complete.** The preparer's signature records that the work is finished;
the process closes only when the reviewer approves it.

**Reopening carries work, not a status.** Sending the file back raises review points, each with a
reviewer, a date, a comment, the object it concerns and a state. An unanswered review point
**blocks resubmission** — the guard is in the action, not only in the button. Answering it records
the response on the file and releases it.

Which signatures are required is **configuration**, not code: `methodologyConfig` decides whether
manager and partner review apply. Completion gates declare whether they are applicable and are
filtered by it, so a condition that does not apply to this engagement is absent rather than
permanently unmet.

---

## 9. Completion semantics

A process is complete when every **applicable** gate is met and the required signatures exist.
Gates link to the step that clears them. There is **no risk-analysis gate**: interim ends before it.

What Revenue hands forward at completion: the process understanding (narrative, map, facts), the
risk and control matrix, the concluded findings, the line walkthrough results, and every matter
carried forward with its destination and its reason.

---

## 10. Risk

Risk signals are **identified** during interim and **never assessed or concluded** in this product.
They are library-mapped, carried in the matrix, and handed to risk analysis, which is a separate
phase that reads this output. The matrix is a **view** of work recorded elsewhere, not a place where
work happens.

Interface copy must not describe a risk as assessed, rated by the auditor, or concluded.

---

## 11. Interaction commitments the design must keep

These are behavioural, not visual. How they look is open.

- **Review by exception.** The routine is separated from the judgement, and the auditor is shown
  what needs them before being asked for anything.
- **Progressive disclosure.** Methodology depth — coverage items, fact keys, triggers, ISA
  references, the six criteria — is available and never in the way.
- **Undo instead of confirmation.** Every routine decision is reversible; nothing asks "are you
  sure?".
- **Keyboard-workable queues.** Every review queue can be worked without the mouse, and a key only
  acts where the action exists.
- **One command surface.** Everything off the seven-step spine is reachable from ⌘K.
- **No fabricated confidence.** No percentage scores on judgements, and no "AI draft" labels — the
  provenance is the trust signal.

---

## 12. What is deliberately not built

Production infrastructure of any kind: authentication, database, real inference, cloud, integration
with an audit file system. Real sampling and real control-testing infrastructure. A full review-notes
subsystem — one worked review point proves the loop. Speech recognition and the live interview
cockpit, which is labelled a future concept. Additional methodology packs. Any part of risk analysis
or the final audit.

**The Audit Intelligence Engine (`audit-platform/audit-engine/`) is not modified from the prototype
track.** Data-model gaps found while building are recorded as findings in `UX-FINDINGS.md` for that
track to act on.

---

## Status

Frozen for the V3 design phase. Verified by four Playwright suites — route integrity, 66
state-model assertions, a 47-assertion UI walkthrough of the full seven-step workflow, and the
standalone bundle over `file://` — all passing with no runtime errors.
