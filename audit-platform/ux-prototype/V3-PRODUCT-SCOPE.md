# V3 Design Direction — the process-level interim audit

**Supersedes the scope of `NEXT-GEN-UX-DIRECTION.md`, not its interaction philosophy.**
That document fixed *how* the product should feel: calm, contextual, evidence-first,
exception-driven, invisible AI. All of it survives. What changes in V3 is *what the product is
a workspace for*.

---

## 1. The scope correction

V2 read as an **AI documentation generator with a review workflow bolted on**. Its four-stage
spine — Understand → Review → Resolve → Complete — described the shape of a *review session*,
not the shape of an *audit*. An auditor looking at it would conclude the product writes process
narratives. That undersells it and, worse, it designs the product into a corner.

The product is the **workspace in which an auditor performs the interim audit of a business
process**. Documentation is one output of that work. Controls are another. Findings are another.
The line walkthrough is another. Control testing is another. Sign-off closes the process.

### Where interim sits

```
Client acceptance
  → Understanding the entity
    → Understanding processes and systems
      → Inherent risk factors
        → ▓▓▓ INTERIM AUDIT ▓▓▓   ← the product
          → Risk analysis
            → Further audit work / final
```

The product must know it lives inside a larger engagement, and must not pretend to be the whole
of it. Interim is bounded on both sides, and the boundaries are shown, not hidden.

### Risk analysis is out of scope — and that has a design consequence

V2 asked the auditor to conclude on eleven risks: accept, modify or reject each one. **That was
risk analysis, and it does not belong in interim.** Assessing risks of material misstatement at
assertion level happens *after* the process work is done, with the process understanding as an
input.

So in V3, identified risks stop being a decision queue and become **an output carried forward**.
They are still identified, still library-mapped, still linked to controls, still exported in the
matrix — but the auditor is not asked to conclude on them here. What the auditor concludes on in
interim is: the process understanding, the controls, the findings, the line walkthrough, and any
control testing.

> **Assumption on the record.** This removes an interaction the earlier prototype had. It follows
> directly from "risk analysis comes after this and is not part of the current product scope",
> but it is a scope judgement, so it is called out rather than made quietly. If risks should
> still be concluded during interim, this is the one decision to reverse.

---

## 2. Product architecture: two layers

### Engagement layer

Client · financial year · engagement · interim status · the processes in scope.

Thin on purpose. It exists to answer *which piece of work am I in?* and to make it obvious that
Revenue is one process among several inside one interim phase inside one engagement.

```
Vandersteen Industrial Systems B.V.   FY2026
  Planning ✓   Interim ●   Final —   Completion —

  Interim — processes
    Revenue / order-to-cash    ● in progress    step 4 of 7
    Purchasing                 — later
    Payroll                    — later
    Inventory                  — later
    Treasury                   — later
    Financial close            — later
```

### Process workspace

Where the work happens. The auditor enters `Client → FY2026 → Interim → Revenue` and carries
Revenue through the whole interim workflow without leaving.

Everything V2 built — triage, focus queues, inline evidence, ⌘K, undo — lives *inside* this
layer.

---

## 3. The Revenue interim workflow

Seven steps. This is the product's actual spine.

| # | Step | The auditor's question | Principal output |
|---|---|---|---|
| 1 | **Prepare** | What do we already know, and who do we need? | A scoped, informed starting point |
| 2 | **Walkthrough** | How does this process actually work? | Established facts, with sources |
| 3 | **Understanding** | Can we describe it, and is the description right? | Narrative, process steps, **the map** |
| 4 | **Controls & findings** | What controls exist, and what is wrong? | Controls, gaps, deficiencies |
| 5 | **Line walkthrough** | Does a real transaction behave the way we described? | A traced transaction, exceptions |
| 6 | **Control testing** | Do the controls we rely on actually operate? | Test results (future state) |
| 7 | **Complete** | Is the process work finished and defensible? | Sign-off, export, hand-forward |

Steps 5 and 6 are the two the previous prototype was missing, and step 5 is the one that changes
what the product *is*.

---

## 4. Workflow is not interaction mode

The V2 spine was a category error: it exposed an interaction rhythm as if it were the workflow.

**The seven steps are the workflow. Understand → Review → Resolve → Complete is the rhythm
*inside* each step.**

Every step follows the same four beats, which is why the product only has to teach them once:

| Beat | In step 2 (Walkthrough) | In step 4 (Controls) | In step 5 (Line walkthrough) |
|---|---|---|---|
| **Understand** | Coverage: what is still unknown | Which controls were identified | Which transaction, and what we expect |
| **Review** | Confirm facts, answer follow-ups | Confirm each control | Confirm each step against evidence |
| **Resolve** | Contradictions, missing facts | Unowned controls, unclear evidence | Missing documents, inconsistencies |
| **Complete** | Coverage sufficient | Controls concluded | Trace concluded |

This is the answer to "do not expose seven permanent enterprise tabs". The auditor learns one
interaction model and applies it seven times. The steps differ in *content*, never in *rhythm*.

---

## 5. Navigating seven steps without a tab bar

A seven-item tab bar is exactly what V2 removed. The replacement is a **process journey**: an
ordered, stateful line rather than a row of peers.

```
Vandersteen / FY2026 / Interim / Revenue                        Saved   ⌘K   ?
─────────────────────────────────────────────────────────────────────────────
Prepare ✓  Walkthrough ✓  Understanding ✓  Controls 4 left  Line walkthrough
                                            ▔▔▔▔▔▔▔▔▔▔▔▔▔   · Testing · Complete
```

Three things make this a journey and not a tab bar, and each is load-bearing:

1. **It is ordered and directional.** Steps read left to right in the order the work happens.
2. **Each item carries its own state**, not just a label: `✓` done, a count when it owes you
   something, `—` when it has not started.
3. **Later steps are visibly not-yet-live** and say why on hover — *"available once the process
   understanding is approved"*. A tab bar implies you may go anywhere; a journey tells you where
   you are in a piece of work. Nothing is *blocked* — an auditor can always look ahead — but the
   product is honest about sequence.

The **process home** (clicking "Revenue") is the map plus the journey: one screen answering
*where is this process?* Two levels of navigation total — engagement, and process. No third.

---

## 6. The Process Understanding Map

**This is V3's centre of gravity**, and the reason the product stops reading as a document
generator.

One diagram of the process as understood, built in step 3, annotated in step 4, and **tested
against reality in step 5**. The same object, gaining meaning at each step:

```
        step 3                    step 4                      step 5
   ┌─────────────┐         ┌─────────────┐           ┌─────────────┐
   │  Quotation  │         │  Quotation  │           │  Quotation  │
   │  Sales eng. │   ──▶   │  Sales eng. │    ──▶    │  Sales eng. │
   │             │         │  ◆ CTL-004  │           │  ◆ ✓ QUO-0412│
   └─────────────┘         └─────────────┘           └─────────────┘
   what happens            what controls it          did it happen
                           and what is missing       on this transaction
```

The Revenue map, eight steps: **Quotation → Sales order → Credit check → Despatch → Installation
& acceptance → Invoicing → Revenue posting → Cash receipt.**

Each node carries its actor and system, the controls attached to it, and any finding on it. It is
drawn in the same restrained language as everything else — hairlines, one accent, no gradients —
and it must stay legible when a partner glances at it from two metres away.

**Why this earns its place:** it is the only object that makes the product's whole claim visible
at once. The narrative says the process in words; the map says it in a form you can *test*. And
step 5 is literally running a real transaction through it.

---

## 7. Line walkthrough — the new product concept

> Testing the process model against a real transaction.

The auditor picks one transaction and traces it end to end through the documented process. For
each step the product shows six things:

```
  Step 5 of 7 — Installation and acceptance

  EXPECTED STEP       The customer signs an acceptance protocol on installation
  EXPECTED CONTROL    Signed acceptance protocol retained (CTL-REV-013)
  EXPECTED EVIDENCE   Acceptance protocol, signed and dated

  ACTUAL EVIDENCE     Acceptance protocol ACC-24188, signed 22 September 2026
  OBSERVATION         The invoice is dated 15 September — seven days before
                      the customer accepted the installation

  ▍ EXCEPTION         Revenue was recognised before the performance
                      obligation was satisfied
```

**The interaction is the focus queue again** — one step at a time, keyboard first, `Enter` to
corroborate, `X` to raise an exception. The auditor has already learned this pattern in steps 2
and 4. The map sits above the card and fills in as the trace advances, so the auditor always sees
how far through the process they are.

**It closes with a result, not a document:**

```
  7 steps expected · 6 corroborated · 1 exception
```

**What the product can do here** (and what it must not): suggest which evidence should exist for
each step, flag a document that was never supplied, compare dates and amounts across steps to
find inconsistencies, and draft the resulting documentation. It must not conclude that something
is an exception — it proposes, the auditor concludes, exactly as everywhere else.

**Why this matters more than it looks.** The exception in the mock engagement is not decorative:
invoicing before acceptance contradicts the recognition policy the narrative describes. The line
walkthrough finds the process model *wrong*, which is precisely what a walkthrough is for and
precisely what an AI-drafted narrative would otherwise have left unchallenged.

---

## 8. Control testing — future state, clearly separated

**Control identification and control testing are different objects and must never merge.** A
control is a thing that exists in the process. A test is a procedure performed on it, with a
population, a selection, evidence and a conclusion. One control may have no test, one test, or a
test in a later period.

The concept flow, shown for one control only:

```
CONTROL → TEST SETUP → POPULATION & SELECTION → EVIDENCE → RESULTS → EXCEPTIONS → CONCLUSION
```

V3 shows this as a **labelled future-state concept**, the way the live cockpit is labelled — one
worked example, honest about not being built. The product may eventually propose the procedure,
the expected evidence and the selection approach; the auditor approves the procedure and
concludes the result. Sample sizes always show the firm parameter that produced them.

Not built in V3: real populations, real sampling, evidence upload, test workpapers.

---

## 9. Process completion gates

Revenue is complete when the process-level interim work is complete — **not** when risk analysis
is done.

| Gate | Cleared by |
|---|---|
| Process understanding reviewed | Step 3 |
| Process documentation approved | Step 3 |
| Controls concluded | Step 4 |
| Findings concluded | Step 4 |
| Line walkthrough completed | Step 5 |
| Required control testing completed | Step 6 |
| No unsupported statements | Any step |
| No unresolved contradictions | Any step |
| Open matters resolved or carried forward | Any step |
| Prepared and reviewed | Step 7 |

Each gate links to the work that clears it. Completion hands three things forward to risk
analysis, stated explicitly on the screen: the process understanding, the risk-and-control
matrix, and the findings. That hand-forward is what makes the product's place in the lifecycle
visible instead of implied.

---

## 10. What changes, concretely

**Kept without change:** the interaction philosophy, the design system, triage → focus → read,
inline evidence, plain language with methodology behind a disclosure, ⌘K, undo-not-confirmation,
the keyboard model, block-level provenance, the needs-support gate, contradictions blocking
downstream objects.

**Changed:**

| V2 | V3 |
|---|---|
| Four-stage spine as the workflow | Seven-step process journey; the four beats become the rhythm inside each step |
| Coverage as a top-level stage | Inside step 2, where the walkthrough happens |
| Documentation as the product's centre | One output among five; the map is the centre |
| Risks as a decision queue | An output carried forward to risk analysis |
| Gaps listed under controls | **Findings** as a first-class object with its own conclusions |
| Engagement barely present | An engagement layer, with Revenue as one process of six |

**New:** the process home, the Process Understanding Map, Prepare as a real step, the line
walkthrough, and the control-testing concept.

---

## 11. What V3 must not become

- A seven-tab enterprise application. The journey is ordered and stateful, or it has failed.
- A project-management module. Prepare is one screen, not a planning suite.
- A risk-analysis tool. That is the next product, and pretending otherwise misleads a buyer.
- A diagram editor. The map is generated from the understanding and annotated by the workflow;
  it is not a canvas for drawing boxes.
- Heavier. V3 adds three screens and must not add a single permanent pixel of chrome.

## Success test

An audit manager clicks through Revenue and says:

> *"This isn't a tool that writes my documentation. This is where I'd do the interim work."*

And a senior, on the line walkthrough:

> *"It caught that the invoice went out before the customer signed. I would have found that in
> February, if at all."*
