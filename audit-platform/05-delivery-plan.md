# 5. Delivery Plan

> **Revised.** This document previously described a twenty-week, ≈6.4 FTE build to a
> pilot-ready product. That plan is not wrong — it is the *destination*, and it resumes at
> Phase 4. What follows is the sequence that gets there one funded gate at a time.
> `00-strategy-and-phasing.md` is the controlling document; the phase codes **A–F** used
> below are defined there, as is the capital register and the cost model.

## 5.1 Staffing

Founder-plus-AI first, headcount last. Full detail in `00 §0.9`.

| Phase | Founder | Bought in | Cash |
|---|---|---|---|
| **0** Engine validation | Pack authoring with Claude, pipeline, evals, corpus | Audit SME 3–5 d (equity preferred); 3 auditors × 2 h for the blind test | €0–6k |
| **1** Prototype | Whole build | Designer 1–2 d; SME 1–2 d output review | €0–2k |
| **2** Alpha | Tenancy, partner support | Security reviewer 1–2 d on isolation; counsel a few hours | €4–8k |
| **3** Paid pilot | Remediation | Architecture + security review 3–5 d; pen-test firm; counsel 10–20 h; insurance broker | €18–30k |
| **4+** | Hiring begins, funded by revenue | Full-stack engineer, then an audit methodology lead | — |

**The one role that is not optional at any budget** is the audit methodology SME. Get them
on equity or as an advisor; the plan works at €4k only if that person is not on a day rate.

**Five files never merge on AI review alone:** the RLS migration, request-context and session
plumbing, the authorization helper, the grounding validator, signed-URL and token issuance.

## 5.2 Design partners — week 0, for ground truth first

Three firms (not five — each costs real support time). Ideally one Big-4 team, one mid-tier,
one small firm. What you need from them, in priority order:

1. **The evaluation corpus.** Historical revenue walkthroughs *paired with the final working
   paper the firm produced*: transcript or detailed notes, narrative, risks, assertions,
   controls, gaps, and the reviewer's changes. Five to eight cases is enough to start.
2. Two hours of methodology time a week during Phase 0.
3. Three auditors for two hours each, for the blind preference test at the Phase 0 gate.
4. Their own revenue process as the first *real* walkthrough subject in Phase 1 — the firm
   as the audited entity. Real auditors, real judgement, no client confidentiality, no
   security review required. This is the cheapest bridge from synthetic to real.

**Before any corpus arrives**, settle the data question — anonymisation by the firm before
it leaves their environment, or a one-page data-sharing agreement. See `00 §0.7` item 1.
This is Phase 0 legal work, not Phase 3 legal work.

## 5.3 The five gates

Full definition, exit criteria and capital targets in `00 §0.5`. In brief:

| Gate | Objective | Founder time | Cumulative cash | Passes when |
|---|---|---|---|---|
| **P0** Audit engine validation | Prove the hypothesis on historical and synthetic input | 6–8 weeks | €4–11k | Recall/precision/coverage targets met **and** auditors prefer our output in a blind pair test |
| **P1** Working prototype | Auditors run the workflow themselves | 6–8 weeks | €6–16k | ≥60% of blocks accepted unchanged or lightly edited; one process end-to-end faster than today |
| **P2** Design-partner alpha | Real engagements, three partners, controlled | 4–6 weeks | €14–30k | Real use, high acceptance, measured time saving, willingness to continue |
| **P3** Secure paid pilot | Take money, rely on it for live work | 3–5 weeks | €32–60k | Firms pay — an invoice, not enthusiasm |
| **P4–5** Productisation, enterprise | Live cockpit, ASR, prior year, SSO, ISO, ISAE | — | revenue-financed | Commercial traction |

Two scheduling notes carried over from the original plan:

- **Interim walkthroughs cluster in September–December.** P0 and P1 run on historical data,
  so they are season-independent — which is the quiet advantage of this sequencing. Aim P2
  at the season, and use the firm's own process (§5.2) for anything that falls outside it.
- **Nothing in P0/P1 depends on a live meeting**, so a slipped design-partner call costs a
  day, not a phase.

## 5.4 Backlog by phase

Same epics as before, retagged. `A`–`F` per `00 §0.4`.

| Epic | Phase | Acceptance criteria |
|---|---|---|
| **E1** Methodology pack: 12 sub-processes, coverage items, mandatory ISA 240 items | **A** | Coverage % computed correctly with `not_applicable` reasons; SME signs off the pack |
| **E2** Risk + control libraries | **A** | Every generated risk maps to a library entry or justifies why none fits |
| **E3** Typed stage framework, schemas, validators | **A** | Each stage runs standalone from the CLI with a fixture in and a validated artefact out |
| **E4** Stages S3–S6 (facts, narrative + flow, risks, controls + gaps) | **A** | Full artefact set generated from a transcript with no web app running |
| **E5** Evidence refs + grounding validator | **A** | Every persisted object has a resolvable reference or is `needs_source`; quote occurs in the cited source |
| **E6** Eval harness + golden corpus | **A** | Runs in CI; a prompt or pack change posts a metric diff |
| **E7** Read-only output viewer | **A** | Sufficient to run the blind preference test |
| **E8** Tenancy schema + RLS + authorization helper | **B** | Cross-tenant queries return nothing under RLS; authorization tests in CI |
| **E9** Managed auth, engagement structure, roles | **B** | A user outside `engagement_members` gets 404 on every route |
| **E10** Transcript import + structured note entry | **B** | A Teams VTT file produces a full artefact set unattended |
| **E11** Review workspace: approve / edit / reject, provenance, versioning | **B** | Approved content immutable; regeneration creates a version with a visible diff; source reachable in one click |
| **E12** Basic append-only audit event log | **B** | Who prepared, who reviewed, when — exportable |
| **E13** Deterministic RCM assembly | **B** | Excel round-trip preserves every field |
| **E14** Word / Excel export | **B** | Opens in the firm's template; footer names preparer, reviewer, dates, model version |
| **E15** AI questionnaire + secure client links | **B/C** | Client user cannot reach any auditor artefact (proved by test); links expire |
| **E16** Document ingestion, retrieval, AV scan, signed URLs | **C** | A 200-page PDF searchable in <3 min; every chunk resolves to a page |
| **E17** Cross-tenant fuzz suite, EU infra, logging, backups + restore test, deletion | **C** | Suite is a merge gate; a restore has actually been performed |
| **E18** Two-level review (preparer / reviewer) | **C** | Sign-off recorded per artefact per level |
| **E19** Security review, pen test, privacy pack, IR process, insurance | **D** | No open critical or high findings; DPA signed; certificate in hand |
| **E20** Live cockpit, ASR, prior-year comparison, test procedures, SSO | **E/F** | Deferred by design |

## 5.5 Definition of done, per gate

**P0 — engine validation**
- [ ] Pack and libraries signed off by the SME.
- [ ] Full artefact set generated from every corpus case, headless.
- [ ] Grounding failures ≈ 0; every object traceable to a quote.
- [ ] Risk recall ≥ 85%, precision ≥ 75%, coverage recall ≥ 85% against SME labels.
- [ ] Blind preference test passed (`00 §0.5`).
- [ ] Corpus obtained under an anonymisation protocol or a data-sharing agreement.

**P1 — prototype**
- [ ] Tenancy schema with RLS from the first migration; authorization tests in CI.
- [ ] Transcript import, questionnaire and note entry all reach the same pipeline.
- [ ] Review workspace with provenance, versioning and immutability after approval.
- [ ] Append-only event log records preparer and reviewer with timestamps.
- [ ] Word and Excel export into a firm template.
- [ ] Edit rate ≥ 60% accepted unchanged or lightly edited.

**P2 — alpha**
- [ ] Cross-tenant suite green as a merge gate; isolation code reviewed by a human.
- [ ] MFA mandatory for auditor accounts; EU hosting end to end including inference.
- [ ] Backups with a *performed* restore; engagement deletion; written retention position.
- [ ] Logging and alerting; short-TTL signed URLs; AV scan on client uploads.
- [ ] Zero-retention / no-training terms agreed with the model provider.

**P3 — paid pilot**
- [ ] Independent architecture and security code review complete, findings remediated.
- [ ] Penetration test with no open critical or high findings.
- [ ] DPA, DPIA where required, retention policy, privacy notice, IR process.
- [ ] Professional indemnity and cyber cover in force.
- [ ] At least one firm has paid.

## 5.6 Metrics

**Edit rate remains the metric that decides the product.** For each generated block:
`accepted unchanged · lightly edited · materially rewritten · rejected`. It is the
time-saving signal, the prompt backlog, and the post-market monitoring evidence. Instrument
it in P1 — retrofitting means a lost phase of signal.

| Measure | Definition | P0 target | P2 target |
|---|---|---|---|
| Edit rate | Share accepted unchanged or lightly edited | — | ≥ 70% |
| Unsupported claims in approved output | Objects whose references do not resolve | 0 | **0** |
| Coverage recall | Items marked covered that the SME agrees are covered | ≥ 85% | ≥ 90% |
| Risk recall | Ground-truth risks the engine found | ≥ 85% | ≥ 90% |
| Risk precision | Generated risks the SME rates relevant | ≥ 75% | ≥ 80% |
| Control identification | Recall and false-positive rate vs the firm's paper | ≥ 80% / ≤ 20% | ≥ 85% / ≤ 15% |
| **Missing-information detection** | Facts an experienced auditor would still need, that the engine flagged | ≥ 70% | ≥ 80% |
| Blind preference | Auditors preferring our draft over the firm's own paper | ≥ 60% | ≥ 70% |
| Total auditor time per revenue process | Interview + write-up + review, versus today's 4–8 h | — | ≤ 2 h |
| Model cost per walkthrough | Measured per stage | — | ≤ €5 (no live loop) |

Optimise for workflow improvement, not benchmark scores: a model that scores well and still
gets rewritten has failed.

## 5.7 Cost model

Superseded by `00 §0.8`. In summary: **€4–11k** to know whether the engine works,
**€14–30k** to have design partners using it on real engagements, **€32–60k** to a
defensible paid pilot. The conventional €245–390k / ≈2.5–3.0 FTE plan is the cost of the
*destination* (Phase 4–5), not of the hypothesis, and is retained in §5.9 for that purpose.

## 5.8 Risks

| # | Risk | Impact | Mitigation |
|---|---|---|---|
| 1 | Unsupported content reaches a file | Existential | Grounding validator, `needs_source`, approval gate on export, zero-tolerance release gate |
| 2 | **Corpus never materialises** | P0 cannot be measured; the whole plan stalls at the first gate | Make the corpus the first ask of every design partner, before features; accept anonymised text; fall back to SME-authored synthetic cases if needed (weaker, but not zero) |
| 3 | **SME unavailable or expensive** | The largest swing factor in the P0 budget | Equity or advisory arrangement agreed before starting; a retired or part-time quality-department reviewer is often both better and cheaper |
| 4 | Quality department rejects the methodology | No sale at any price | SME sign-off at P0 and again at P2; firm methodology as configuration |
| 5 | Auditors rewrite everything | Time saving evaporates | Edit rate from P1; blind preference test at P0 catches it before any product is built |
| 6 | **Half-tenancy** built and RLS retrofitted | Confidentiality bug plus a painful migration | RLS in the first migration (`00 §0.7` item 2); authorization tests in CI |
| 7 | **AI-generated security code shipped unreviewed** | Cross-tenant leakage | The five-file human-review rule (§5.1); light isolation review at P2, full review at P3 |
| 8 | A design partner demands SSO / ISO before the alpha | Phase 5 work pulled into Phase 2 | "Not yet", or "that is a paid enterprise engagement" — never "yes, we'll build it" |
| 9 | Pen-test scope creep | P3 budget doubles | Scope fixed to app, API, auth and tenancy; agree it in writing before booking |
| 10 | Transcript quality from meeting platforms | Weak input, weak output | Measure on the corpus; allow segment correction and re-run; ASR remains a P4 option, not a P1 dependency |
| 11 | Model or provider change | Cost and quality volatility | `LlmClient` abstraction; model IDs and effort as configuration; evals detect regressions |
| 12 | Prompt injection via client documents | Manipulated conclusions | Untrusted-content handling (`03 §3.9`); no side-effecting tools in content stages |
| 13 | Scope creep to more processes | Nothing ships well | Revenue only until P4 |

## 5.9 The destination — retained for reference

Phases 4 and 5 are where the original plan resumes, and its estimates hold: live walkthrough
cockpit, integrated ASR and diarisation, real-time follow-ups and evidence requests, richer
client portal, prior-year comparison and change detection, test procedure generation and
control testing, sampling, further process packs (purchases, payments, payroll, inventory,
ITGC), enterprise identity, per-tenant KMS, hash-chained trail with WORM anchoring,
ISO 27001, ISAE 3402 Type II, methodology editor, and audit-software integrations.

Prioritise that work by, in order: user value, willingness to pay, frequency of request,
enterprise procurement requirement, engineering cost. Fund it from revenue or a raise —
not from the money that was supposed to test the hypothesis.
