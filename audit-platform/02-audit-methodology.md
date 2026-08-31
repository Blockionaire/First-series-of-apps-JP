# 2. Audit Methodology — the content the product must be right about

> **Unchanged in substance, and almost entirely Phase 0.** The methodology is the hypothesis,
> not the packaging: §2.1–§2.7 and §2.9 are built first, before any authentication or
> tenancy exists. Only §2.8 (test procedures) and §2.10 (prior-year comparison) move later.
> Phase map in §2.12.

This document is the specification the AI stages are held to. If the product is
technically excellent and methodologically wrong, it is unsellable: the firm's quality
department is the gatekeeper, and an oversight inspection (AFM, and equivalents elsewhere
in the EU) is the ultimate test of the output.

Everything here is written with an audit methodology SME on the team (see `05 §5.1`). The
standard references are the anchors; **the firm's own methodology always overrides**, which
is why every parameter below is configuration, not code.

## 2.1 Standards the output has to satisfy

| Standard | What it demands of us |
|---|---|
| **ISA 315 (Revised 2019)** | Understand the entity, the flow of transactions from initiation to recording in the general ledger, and the system of internal control across its five components. Identify and assess risks of material misstatement at the **assertion level**, positioned on a spectrum of inherent risk using the inherent risk factors. Understand the **IT environment** and identify risks arising from the use of IT and the general IT controls that address them. Evaluate the **design** of identified controls and determine whether they have been **implemented** (D&I) — the walkthrough is the classic procedure for exactly this. |
| **ISA 330** | Design responses to assessed risks at assertion level. Test operating effectiveness when the auditor intends to rely on controls, or when substantive procedures alone cannot provide sufficient appropriate evidence (relevant for high-volume, automated revenue streams). Constrains how our suggested test procedures must be framed. |
| **ISA 240** | Rebuttable presumption of fraud risk in revenue recognition; risk of management override; journal entries relating to revenue. The Revenue template must force this conversation, not leave it to the model's initiative. |
| **ISA 265** | Deficiencies in internal control are communicated to management/TCWG. Our "control gaps" output is the raw material for the management letter — model it as such from day one. |
| **ISA 500** | Sufficient appropriate evidence; relevance and reliability. Where a control relies on **information produced by the entity (IPE)** — a report, a query, an exception listing — the auditor must address the accuracy and completeness of that information. Every control we capture asks for its IPE. |
| **ISA 402** | Services provided by service organisations (outsourced invoicing, payment service providers, hosted ERP). The template asks for them and for the SOC 1 / ISAE 3402 report. |
| **ISA 230** | Documentation sufficient for an experienced auditor with no previous connection to understand the work; who performed it and when, who reviewed it and when. Drives our review workflow, sign-off records and export footer. |
| **ISA 220 (Revised) / ISQM 1** | Engagement quality management, direction/supervision/review, and the firm's responsibility for the resources — *including technology resources* — used on engagements. The firm will need to document why this tool is appropriate: we supply the technical documentation for that (see `04 §4.9`). |
| **EU Reg. 537/2014 / Dir. 2006/43/EC, national law (e.g. NL: Wta/Bta, NV COS)** | Audit file assembly and retention (at least five years for PIE audit working papers under Art. 15 of the Regulation; longer in several member states — the Dutch practice is seven). Our retention and export design has to serve this, and it *conflicts with naive GDPR erasure* — see `04 §4.6`. |
| **IFRS 15 / national GAAP (e.g. RJ 270)** | Revenue recognition model. The template must be framework-aware: the "when is revenue recognised" questions differ between an IFRS reporter and a Dutch GAAP SME. Framework is an engagement-level setting. |

Two deliberate design consequences:

- **The AI never concludes on reliance.** It drafts a proposed risk assessment, proposed
  key controls and proposed tests. Assessing risk and deciding on reliance are the
  auditor's judgements and are recorded as such.
- **The tool measures completeness of the *understanding*, not of the *audit*.** Coverage %
  is about the process walkthrough template, and the UI says so.

## 2.2 Assertion taxonomy (fixed vocabulary)

Used as an enum everywhere — in extraction, in the RCM, in exports.

**Classes of transactions and events (revenue, credit notes, cash receipts):**
`occurrence` · `completeness` · `accuracy` · `cutoff` · `classification` · `presentation`

**Account balances (trade receivables, contract assets/liabilities, deferred revenue):**
`existence` · `rights_and_obligations` · `completeness` · `accuracy_valuation_allocation` ·
`classification` · `presentation`

Firms with a different in-house vocabulary (some collapse classification/presentation, some
add "cut-off" to balances) get a mapping table in firm configuration; the internal enum
stays stable.

## 2.3 Inherent risk factors (fixed vocabulary)

`complexity` · `subjectivity` · `change` · `uncertainty` · `susceptibility_to_bias_or_fraud`

Every generated risk must name at least one inherent risk factor and place the risk on the
spectrum (`lower · moderate · higher`), with `significant_risk: boolean` as the auditor's
call, pre-populated but never auto-approved.

## 2.4 The Revenue (order-to-cash) process template

The template is data, not code: a versioned YAML/JSON pack loaded per firm and per
engagement (see `06 §6.2`). Structure:

```
process: revenue
  sub_processes[]:
    id, name, purpose, applicability_conditions
    coverage_items[]:
      id, question_intent, must_know_facts[], why_it_matters (standard ref),
      typical_risks[], typical_controls[], typical_evidence[], follow_up_triggers[]
```

### Sub-processes shipped in v0.1

| # | Sub-process | Core "must know" |
|---|---|---|
| R1 | **Customer & contract acceptance** | Who accepts customers, master-data creation and changes, credit assessment, contract terms and non-standard clauses, who can approve deviations |
| R2 | **Order entry** | Channels (EDI, webshop, e-mail, phone), where the order is recorded, completeness of order capture, pricing source, discounts and who approves them, blocking rules |
| R3 | **Credit management** | Credit limits, who sets and changes them, automatic blocking, release of blocked orders, monitoring of overdue balances |
| R4 | **Delivery / performance of the obligation** | Physical shipment vs. service delivery vs. over-time recognition, proof of delivery, third-party logistics, link between delivery and invoice trigger |
| R5 | **Invoicing** | Invoice generation (automated/manual), sequence and completeness, price and quantity derivation, VAT determination, invoice approval, manual invoices and who can raise them |
| R6 | **Revenue recognition** | Framework and policy, point-in-time vs over-time, contract combinations, variable consideration, principal vs agent, deferred revenue mechanics, journal generation (automatic or manual) |
| R7 | **Credit notes, returns and rebates** | Who can raise a credit note, approvals, limits, link to the original invoice, rebate/bonus accruals |
| R8 | **Cash receipt & AR** | Bank matching, unapplied cash, write-offs, dunning, AR ageing review, allowance for expected credit losses |
| R9 | **Cut-off** | What determines the period, period-end procedures, cut-off controls around closing, open-order/undelivered handling, closing calendar and GL close |
| R10 | **IT environment & interfaces** | ERP and satellite systems, interfaces (order → delivery → invoice → GL), automated controls and configuration, who has access to change prices/master data, ITGC touchpoints (access, change, operations), service organisations |
| R11 | **Manual journals & management override** | Who can post to revenue accounts, approval, standing journals, top-side entries, unusual entries around period end |
| R12 | **Monitoring & KPIs** | Management review of revenue and margin, budget-vs-actual, precision of the review, what happens when a variance is found |

R11 and R12 are deliberately part of the *revenue* template rather than deferred to an
entity-level module: this is where the fraud and management-review conversations happen and
where fully-AI-run interviews otherwise go shallow.

### Coverage item — worked example

```yaml
- id: R5.3
  sub_process: R5
  question_intent: "How is the invoice amount derived, and what prevents it from being wrong?"
  must_know_facts:
    - price_source            # contract, price list, order, manual entry
    - quantity_source         # delivery note, order, meter reading, timesheet
    - automated_or_manual
    - who_can_override_price
    - what_happens_on_override   # approval, log, exception report
    - exception_handling      # what if the invoice fails / is blocked
  why_it_matters:
    assertions: [accuracy, occurrence]
    note: "Pricing derivation is the primary accuracy risk in order-to-cash; overrides are the classic fraud vector."
  typical_risks: [RSK-REV-014, RSK-REV-021]
  typical_controls: [CTL-REV-031, CTL-REV-032]
  typical_evidence: ["screenshot of price determination config", "example invoice traced to order and delivery"]
  follow_up_triggers:
    - if: "automated_or_manual == 'automated' and price_source unknown"
      ask: "Where does the system take the price from — the contract, a price list, or the order? Who maintains it?"
    - if: "who_can_override_price is stated and what_happens_on_override unknown"
      ask: "When someone overrides the price, is that approved or logged anywhere, and who reviews it?"
    - if: "mentions 'exception report' and no reviewer named"
      ask: "Who reviews that exception report, how often, and what evidence is there that they did?"
```

The `follow_up_triggers` are what make the interview feel intelligent while staying
auditable: they are deterministic rules over the extracted facts, *and* the model may
propose additional follow-ups beyond them. Both are shown; the rule-based ones are never
skipped silently.

**Coverage state machine** per item: `open → partially_covered → covered`, plus
`not_applicable` (requires a reason, which itself becomes documentation) and `parked`
(deferred to a follow-up, becomes an open item). Coverage % = covered / applicable.

## 2.5 Seeded libraries

Shipped with the Revenue pack, curated with the SME, and extended by the firm.

**Risk library** (~40 entries for revenue). Each entry: id, title, description template,
assertions, inherent risk factors, typical drivers, typical controls, typical tests.
Examples:

| ID | Risk | Assertions | Factors |
|---|---|---|---|
| RSK-REV-002 | Revenue is recorded for goods shipped after period end (cut-off) | occurrence, cutoff | change, susceptibility_to_bias_or_fraud |
| RSK-REV-007 | Not all delivered goods/services are invoiced and recorded | completeness | complexity |
| RSK-REV-014 | Invoices are priced at other than the contractually agreed price | accuracy | complexity |
| RSK-REV-021 | Unauthorised price or discount overrides inflate or deflate revenue | accuracy, occurrence | susceptibility_to_bias_or_fraud |
| RSK-REV-028 | Revenue recognised over time uses unsupported progress estimates | accuracy, occurrence | subjectivity, uncertainty |
| RSK-REV-033 | Credit notes are used after period end to reverse fictitious revenue | occurrence, cutoff | susceptibility_to_bias_or_fraud |
| RSK-REV-041 | Interface between the order/delivery system and the GL drops or duplicates transactions | completeness, accuracy | complexity, change |

**Control library** (~50 entries). Each: id, title, description template, control type
(`preventive/detective`), nature (`manual/automated/IT-dependent manual`), frequency,
assertions addressed, typical evidence, typical IPE, typical test, common failure modes.

**Why libraries matter.** They anchor the model's output in the firm's vocabulary, make
outputs comparable across engagements, allow linking to the firm's standard test programs,
and dramatically reduce hallucination: the model's job becomes *"map what the client said
onto these, and flag what doesn't fit"* — with free-text creation still allowed and clearly
marked as new.

## 2.6 Risk & Control Matrix — canonical schema

One row per **risk × control** pair (an unmitigated risk gets a row with an empty control
and a gap flag).

| Field | Notes |
|---|---|
| `sub_process` | R1–R12 |
| `process_step` | Free text, from the narrative |
| `risk_id`, `risk_description` | Library id or `NEW` |
| `assertions[]` | From §2.2 |
| `inherent_risk_factors[]`, `inherent_risk_rating`, `significant_risk` | §2.3 |
| `control_id`, `control_description` | Library id or `NEW`; empty ⇒ gap |
| `control_objective` | What it prevents/detects |
| `control_type` | preventive / detective |
| `control_nature` | manual / automated / IT-dependent manual |
| `frequency` | per transaction / daily / weekly / monthly / quarterly / annual / event-driven |
| `control_owner` | Role, not just name |
| `ipe_used`, `ipe_completeness_accuracy_note` | ISA 500 |
| `is_key_control` | Auditor decision, AI-proposed |
| `design_effective` (`yes/no/tbd`), `implemented` (`yes/no/tbd`) | D&I conclusion — auditor field |
| `gap_description`, `gap_severity` | Feeds ISA 265 reporting |
| `planned_response` | Test controls / substantive / both |
| `test_procedure_ref` | Link to the test plan row |
| `evidence_refs[]` | Provenance — mandatory |
| `status`, `prepared_by`, `reviewed_by`, timestamps | Workflow |

The Excel export is this table with the firm's column order and styling applied.

## 2.7 Key-control selection criteria

The AI proposes `is_key_control` only when **all** of these hold, and it must state which
criterion each proposal rests on:

1. It addresses one or more assessed risks of material misstatement at assertion level.
2. It is sufficiently **precise** to detect a misstatement that could be material
   (a review of "the numbers look fine" is not).
3. There is evidence that it operated (signature, workflow record, system log, exception
   listing with resolution).
4. Its owner has the authority and competence to act on the exceptions it raises.
5. Its IT dependencies (automated logic, IPE) are identified, so the auditor knows what
   else must be tested for the control to be relied upon.
6. It is not redundant with a stronger control already selected for the same risk/assertion.

Where a criterion cannot be established from the walkthrough, the output says which one is
missing and generates a follow-up question — not a lower-confidence conclusion.

## 2.8 Suggested test procedures

For each key control the platform proposes a test with these components:

- **Nature**: inquiry (never alone), observation, inspection, reperformance, and for
  automated controls a configuration inspection plus supporting ITGC.
- **Population and its source**, and how completeness of that population will be established
  (this is where the IPE conversation lands).
- **Timing**: interim + roll-forward considerations.
- **Extent**: sample size from the firm's parameter table, driven by control frequency and
  risk. Illustrative defaults, replaced by firm configuration on install:

  | Frequency | Population/yr | Illustrative sample (higher risk) |
  |---|---|---|
  | Annual | 1 | 1 |
  | Quarterly | 4 | 2 |
  | Monthly | 12 | 3–5 |
  | Weekly | 52 | 8–15 |
  | Daily | ~250 | 20–25 |
  | Many per day | >250 | 25–60 |
  | Automated (with effective ITGC) | n/a | 1 + ITGC coverage |

  The UI always shows the parameter that produced the number.
- **Attributes to inspect**, as a checklist that becomes the test workpaper post-MVP.
- **Prior-year note**: if the control is unchanged and was tested last year, flag the
  rotation option under ISA 330 (evidence from previous audits may be used for unchanged
  controls, provided the control is tested at least once in every third audit) — flagged as
  a decision for the auditor, never applied automatically.

## 2.9 Fraud, override and journal entries

Non-negotiable template content, always asked:

- The rebuttable ISA 240 presumption of fraud risk in revenue recognition: which revenue
  streams, and if the presumption is rebutted, the reason is documented explicitly.
- Who can post manual journals to revenue accounts and what approval exists.
- Unusual terms: side letters, bill-and-hold, consignment, right-of-return, channel
  stuffing indicators, unusual period-end activity.
- Incentives: are sales bonuses or covenants tied to revenue?

These questions are marked `mandatory: true` in the template. The walkthrough cannot be
marked complete with mandatory items open — it can only be closed with an explicit
"not obtained" reason that lands in the file.

## 2.10 Prior-year comparison logic

Three comparisons run against last year's approved artefacts:

1. **Narrative diff** — semantic, sub-process by sub-process, classified `unchanged /
   wording only / substantive change`, with the evidence for each substantive change.
2. **Risk diff** — new risks, removed risks, changed ratings; a removed risk always
   requires an auditor reason.
3. **Control diff** — new/removed/changed controls, with special attention to changes in
   nature (manual → automated is a very common ERP-migration finding), owner and frequency;
   changed key controls trigger a "reliance decision needs revisiting" flag.

The output is a short **"Changes in the process vs. prior year"** section, which is exactly
what ISA 315R asks the team to conclude on when using information from prior periods, and
one of the most-cited pain points from the design-partner interviews.

## 2.11 Methodology guardrails in the product

| Guardrail | Mechanism |
|---|---|
| No AI conclusion enters the file unreviewed | Approval workflow; export blocks on unapproved blocks |
| No claim without evidence | Grounding validator; "needs source" state (see `03 §3.7`) |
| Mandatory questions cannot be silently skipped | Template `mandatory: true` + completion gate |
| Sample sizes and thresholds come from the firm | Firm configuration; number always shown with its parameter |
| Reliance decisions are human | `is_key_control`, `design_effective`, `implemented`, `planned_response` are auditor fields, AI-proposed only |
| Standard references are visible | Every template item carries its standard reference, shown on hover in review |
| The file records AI assistance | Export footer + audit trail with model, version and prompt hash |

## 2.12 Phase map

| Section | Content | Phase |
|---|---|---|
| §2.1 | Standards mapping | **A** — shapes every schema and prompt |
| §2.2–§2.3 | Assertion and inherent-risk-factor vocabularies | **A** — enums; changing them later rewrites every record |
| §2.4 | Revenue template, 12 sub-processes, coverage items | **A** — the core IP |
| §2.5 | Risk and control libraries | **A** — the main hallucination control |
| §2.6 | RCM schema | **A** as a schema, **B** as an artefact (deterministic assembly) |
| §2.7 | Key-control criteria | **B** — proposal with criterion-by-criterion assessment |
| §2.8 | Test procedures and sample sizes | **E** — needs a paying firm's parameter table to mean anything |
| §2.9 | Fraud, override, journals | **A** — mandatory items; omitting them makes the output professionally wrong, and it costs a day |
| §2.10 | Prior-year comparison | **E** for the diff; **B** for ingesting prior-year documents as evidence |
| §2.11 | Guardrails | **A** — all of them, they are prompt and code structure rather than infrastructure |

Two things in this document are deliberately *not* deferred despite being cheap to defer:
the ISA 240 mandatory items (§2.9), because their absence is a professional defect rather
than a missing feature, and the guardrails (§2.11), because retrofitting them means
re-validating every stage.
