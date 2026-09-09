# Pre-V3 Functional Corrections

A functional / information-architecture correction pass on the V3 prototype. **No visual
redesign.** The seven-step workflow, the engagement layer, review-by-exception and the connected
model all stay. What changes is where they are wrong.

The rule for this pass: **fix disagreements between what the screen says and what the state
model holds — at the state model, never by hiding the wrong status in the UI.**

---

## 1. Current issues found

Verified by inspection, not assumed. Grouped by severity.

### Broken — the screen and the state disagree

| # | Issue | Evidence |
|---|---|---|
| 1 | **Resolving a contradiction leaves the fact contradictory.** `resolveConflict` writes the narrative block and closes the open item, but never touches `coverage`. The completion gate reads `cov.facts.contradictory === 0`, so the product simultaneously says "Contradiction resolved" and blocks completion on a contradictory fact | `state.js` `resolveConflict`; gate `contradiction` |
| 2 | **`undecided` counts as a concluded control.** `pending = controls.filter(c => !controlDecision(c))`, so setting *undecided* removes a control from the queue and satisfies the gate | `state.js` `controlSummary` |
| 3 | **"Extend the sample" closes the control test.** `concludeTest("extend")` sets `testConclusion`, and the gate is `!!S.testConclusion` | `state.js` `concludeTest`, gate `testing` |
| 4 | **Signing does nothing.** The Sign button raises a toast. No state changes, no reviewer exists, the gate `signed` is hard-coded `ok: false` and can never be met — Revenue can never actually complete | `app.js` `case "sign"`; gate `signed` |
| 5 | **The questionnaire does not store answers.** `answerQuestion` increments a counter. *Send*, *I don't know* and *Rather have a call* are the same action | `state.js` `answerQuestion` |
| 6 | **Transaction selection is cosmetic.** `lineWalk.transaction` is hard-coded to `candidates[0]` and the steps are a single global array. Selecting SO-24310 shows SO-24188's evidence | `data-process.js` |

### Broken — dead routes

Four actionable elements navigate to routes that are not registered:

| Element | Bad route |
|---|---|
| Walkthrough → "Draft the documentation" | `#/review` |
| RCM → "Back to review" | `#/review` |
| Questionnaire → "Back to the auditor view" | `#/understand` |
| Cockpit → "End" | `#/understand` |

### Wrong model

| # | Issue |
|---|---|
| 7 | **Revenue is modelled as one linear path.** Machine sales, spare parts and service contracts are materially different processes forced through `P1 → P8` |
| 8 | **One line walkthrough is treated as covering Revenue.** No concept of a walkthrough per applicable variant, or of a variant not requiring one |
| 9 | **Control testing is unconditional.** The gate demands a concluded test, so Revenue cannot complete without testing a control even where no reliance is planned |
| 10 | **Findings offer only Confirm / Dismiss.** The auditor cannot downgrade a proposed *significant deficiency* to a *deficiency* without recreating it |
| 11 | **Step 3 tells the auditor it is already identifying risks and controls.** The pipeline copy describes downstream work, so the sequence reads as decoration |
| 12 | **Step 2 has no "before the interview" state.** It only answers "what do we still not know?", with no way to start capturing the process |
| 13 | **Risk fields read as auditor conclusions.** `rating`, `significant`, `fraud` are presented as if concluded, inside a product that explicitly excludes risk analysis |
| 14 | **"Carry to final" is a silent dismissal.** No destination, no rationale |

---

## 2. Route fixes

Replace the four dead links: Walkthrough → `#/understanding`; RCM → `#/controls`;
questionnaire → `#/walkthrough`; cockpit End → `#/walkthrough`.

Add a **route integrity check** that runs in the prototype: on boot, every `data-href` the app
can render is collected and asserted against `ROUTES`. A mismatch logs a console error naming the
offender. Cheap, and it makes this class of bug impossible to reintroduce silently.

## 3. Revised Process Interview concept

Rename step 2 **Walkthrough → Process interview**. "Line walkthrough" stays. The two can no
longer be confused, and the internal coverage model is untouched.

Step 2 becomes the whole fact-gathering step with two faces:

- **Before evidence** — *How do you want to capture the process?* Four routes: auditor-led
  interview, import a transcript, send a client questionnaire, add auditor notes. Plus the
  future live interview, labelled. These are input methods into one step, not modules.
- **With evidence** — what it does today: coverage, facts, gaps, contradictions, follow-ups.

Both faces are always reachable; the screen leads with whichever matters.

## 4. Draft-vs-complete rule

Made explicit and enforced differently at each end:

> **Drafting** the current understanding is allowed while required areas are open.
> **Completing the process interview** is not, unless each open required area has a documented
> reason.

The action is therefore **"Draft current understanding"**, never "the documentation". Where a
required area is open, the draft states it — *not established*, *question sent to the client*,
*evidence not yet obtained* — and never infers a value.

## 5. Contradiction resolution state propagation

One auditor decision updating every derived state, in one action:

```
source conflict  →  fact / coverage state  →  narrative block  →  control dependency
                 →  finding dependency     →  open item        →  completion gate
```

Three resolutions, three different downstream states:

| Auditor decision | Fact becomes | Coverage | Gate |
|---|---|---|---|
| One source is correct | `resolved_known` | item recomputed, may become covered | clears |
| Both routes exist | `resolved_with_exception` | covered; the second route is recorded | clears |
| Leave unresolved | stays `contradictory` | unchanged | **stays blocked** |

Both original statements stay in provenance in every case. The resolution is recorded as an
auditor statement alongside them, not instead of them. The product can never again show
"contradiction resolved" and a contradictory fact at once.

## 6. Revenue process variants

Revenue gains three variants sharing one step model:

| Variant | Path | Recognition |
|---|---|---|
| **Machine sales** | Quotation → Order → Credit → Despatch → **Installation & acceptance** → Invoice → Posting → Cash | On customer acceptance |
| **Spare part sales** | Order → Credit → Despatch → Invoice → Posting → Cash | On despatch |
| **Service contracts** | Contract → ServiceTrack set-up → Deferral schedule → Posting → Cash | Over time |

Spare parts *skip* installation; service contracts enter through their own three steps and
**converge** with the others at revenue posting. Note this is a process distinction, not a
reporting one — machines and spare parts are one revenue stream and two processes.

## 7. Branching process-map data model

Each step gains `variants[]`, `next[]`, `optional` and `shared`. The map is a graph, not a list:

```
P1 ─▶ P2 ─▶ P3 ─▶ P4 ─┬─▶ P5 ─▶ P6 ─▶ P7 ─▶ P8
   V1     V1,V2  V1,V2 │    V1     V1,V2  ALL   ALL
                       └────────────▲
                          V2 skips installation
S1 ─▶ S2 ─▶ S3 ────────────────────────────▲
   V3     V3     V3              converge at P7
```

No view may assume `P1…P8` is the only path. Filtering the map by variant is then trivial, which
is what V3 will need.

## 8. Line walkthrough per variant

A `LineWalkthroughRequirement` per variant: `required` · `not_required` (with a reason) ·
`completed`, plus *not yet decided*. Nothing is hard-coded — firm methodology decides which
transaction classes need a separate walkthrough, so the requirement is data the auditor sets.

Mock state: machine sales *required*, spare parts *required*, service contracts *not required*
with a documented reason. The completion gate reads **"every required line walkthrough
completed"**, not "a line walkthrough exists".

## 9. Transaction-selection fix

Two transactions, both fully working, rather than three of which one works:

- **SO-24188** — machine sales, 7 steps, the acceptance-before-invoice exception
- **SO-24310** — spare parts, 6 steps, no installation step at all, cash received and
  corroborated

Selecting one loads its own variant, steps, expected controls, evidence, observations and
verdicts. The third candidate is removed rather than faked.

This also fixes the language: the machine trace ends before cash because the invoice is not yet
due, so it says **"not yet occurred"** rather than claiming order-to-cash. The spare-parts trace
does reach cash. Three distinct concepts: *not applicable to this variant*, *not yet occurred*,
*not traced*.

## 10. Controls decision-state fix

`pending · key · not_key · undecided · carried_forward`.

Only **key** and **not_key** conclude a control. **Undecided keeps it in the queue and blocks the
gate.** Moving on with uncertainty requires the explicit action *Carry forward undecided*, with a
reason, which records `carried_forward` and unblocks — uncertainty is never silently completion.

## 11. Findings modify flow

Confirm · **Modify** · Dismiss. Modify edits title, severity, impact and remediation inline. The
stored result keeps the system proposal and the auditor conclusion as separate values, so the
file shows what was proposed and what was concluded.

## 12. Risk-analysis boundary

Interim identifies **risk signals**; it does not conclude risk. `rating`, `significant` and
`fraud` are relabelled at every surface as *system-proposed signal, carried into risk analysis*,
never as an auditor conclusion. The data stays — the matrix and the hand-forward need it.

## 13. Conditional control-testing logic

A scope decision precedes the test. For each control concluded **key**: `test_required` ·
`no_test_required` (reason) · `deferred`.

Step 6 is therefore **required**, **not applicable** (with a basis) or **not yet decided**. The
gate becomes *"required control testing completed, or documented as not required"*. Where no
reliance is planned, Revenue completes with no test and the reason on file.

## 14. Extend-sample logic

*Extend the sample* is not a conclusion. It adds mocked items, produces further results, and
leaves the test **open** with the gate blocked. Only *Rely* or *Do not rely* close it.

## 15. Carry-forward logic

*Carry to final* becomes **Carry forward**, capturing destination (risk analysis · final audit ·
client follow-up · other) and a rationale. A carried item keeps its origin, state, destination,
reason and owner, and appears in the hand-forward at completion.

## 16. Questionnaire state flow

The questionnaire writes into the same fact model as every other source:

- **Send** stores the answer against that question, marks it answered, updates the fact and
  coverage, and advances to the next unanswered question.
- **I don't know** records an explicit unable-to-answer, leaves the fact unresolved and raises an
  open item for the auditor.
- **Rather have a call** records a preferred follow-up mode, leaves the question unresolved and
  raises an auditor follow-up.

An answer that conflicts with the process interview surfaces a contradiction; one that
establishes an unknown fact updates coverage; a new topic creates a follow-up. Deterministic and
mocked, but structurally connected.

## 17. Sign-off / reviewer states

Stateful, and driven by a mocked methodology configuration
(`requiresManagerReview: true`, `requiresPartnerReview: false`):

```
work in progress → ready for review → submitted → in review
                 → approved (complete)   or   → review points open (reopened)
```

Preparer signs; that makes the process *ready for review*, not complete. Partner review is
required only where the configuration says so.

## 18. Revised completion gates

Every gate carries an applicability, so nothing blocks on work this process does not need:

| Gate | Applicable when |
|---|---|
| Preparation confirmed | always |
| Process interview sufficiently complete | always |
| Required methodology areas addressed or documented | always |
| Process understanding reviewed | always |
| Documentation approved | always |
| Controls concluded | always |
| Findings concluded | always |
| Required line walkthroughs completed | per variant requirement |
| Control testing completed or documented as not required | per scope decision |
| No unsupported statements | always |
| Contradictions resolved or carried forward | always |
| Open matters resolved or carried forward | always |
| Preparer signed | always |
| Reviewer approval | if `requiresManagerReview` |
| Partner approval | if `requiresPartnerReview` |

No risk-analysis gate. Interim ends before it.

## 19. Revised next-action order

Prepare → interview contradictions → required areas → draft understanding → documentation
judgements → approve clean sections → conclude controls → conclude findings → required line
walkthroughs → **review findings the walkthrough raised** → decide the testing approach →
perform required tests → open matters → submit for review → reviewer approval → complete.

The walkthrough-finding step is the one that must not be skipped: testing reality changed the
documented understanding, and that has to be reviewed before the workflow moves on.

## 20. Guided-demo changes

Rewritten to match actual behaviour — in particular the contradiction is resolved with `1`/`2`/`3`,
not Enter, which the current script gets wrong. Twelve beats: engagement → variants → prepare →
process interview → draft → review by exception → provenance → controls and findings → line
walkthrough → the finding it raises → conditional testing → complete and hand forward.

---

## Deliberately not in this pass

The V3 visual redesign. Production backend, authentication, database, real inference, cloud.
Any change to `audit-engine`. A review-notes module beyond a mocked reopen. Full audit-strategy
functionality behind the testing scope decision. Real sampling.
