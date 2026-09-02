# Evaluation corpus

`synthetic/` — data class **C0**. Authored cases with no real entity. Committed.
`real/` — data class **C1**. Anonymised historical cases with paired working papers.
**Gitignored and never committed.** Nothing arrives here before the data-sharing
agreement or the firm's anonymisation protocol is in place (07 §7.2).

## Case folder

```
case.yaml         metadata: id, set (dev|test), origin, data class, what it stresses
transcript.txt    the input the engine sees
answer-key.yaml   ground truth the engine NEVER sees
```

## The six-case smoke set (07 §7.5) — development set, iterate freely

| # | Case | Stresses | Status |
|---|---|---|---|
| 01 | Product sales, one ERP, automated order-to-invoice | The baseline | **drafted** |
| 02 | Services recognised over time, progress estimates | Subjectivity, IFRS 15 judgement | to author |
| 03 | Manual SME, spreadsheet pricing, owner approves everything | Override risk, weak segregation | to author |
| 04 | ERP migration mid-year | The `change` factor, two control environments | to author |
| 05 | Outsourced invoicing and a payment service provider | ISA 402, interface completeness | to author |
| 06 | Vague, partly contradictory interviewee | `contradictory` and `insufficiently_evidenced` states | to author |

**Authoring loop, 2–4 hours per case:** SME sketches the process in 15–20 minutes → draft a
realistic transcript with a planted set of risks, controls, gaps and at least three
deliberate omissions → **SME edits for realism and plants two surprises the drafter did not
know about** → record the answer key separately.

> **Contamination warning.** A transcript drafted with Claude and evaluated by Claude is
> partly circular. The SME edit is not optional, the scoring ground truth comes from the SME
> and the firm, and **the gate is decided on real anonymised cases and the human blind test**,
> never on synthetic scores (07 §7.5).

The **test set** is locked: real cases plus edge-matrix synthetics, run at milestones only.
Never iterate against it.
