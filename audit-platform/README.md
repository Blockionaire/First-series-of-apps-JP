# Interim Audit Platform — MVP Build Plan

Working title: **Walkthrough** (placeholder).

An AI-assisted workflow platform for the interim phase of a statutory audit. It runs the
process walkthrough (AI-led, auditor-led-with-AI-listening, or client self-service
questionnaire), and turns it into audit-ready documentation: process narrative, flow,
risks mapped to assertions, controls and gaps, key controls, a draft Risk & Control
Matrix, and suggested control tests — all reviewable, editable and approvable by the
auditor, with a full provenance trail back to the source.

> **Scope of this document set.** This is a build plan for a *first working MVP*, not a
> product spec for the full vision. It is written to be executable by a small team in
> ~20 weeks and to survive review by (a) an audit quality department, (b) a security
> officer, and (c) a DPO.

## Read in this order

| # | Document | What it settles |
|---|---|---|
| 0 | this file | Scope, MVP boundary, key decisions |
| 1 | [`01-product-and-ux.md`](01-product-and-ux.md) | Personas, the four-step flow, every screen, trust-by-design UX |
| 2 | [`02-audit-methodology.md`](02-audit-methodology.md) | Standards mapping, the Revenue template, coverage model, risk/control/RCM taxonomies |
| 3 | [`03-architecture.md`](03-architecture.md) | Stack, services, data model, the staged AI pipeline, RAG, evals, exports |
| 4 | [`04-security-privacy-compliance.md`](04-security-privacy-compliance.md) | Tenant isolation, crypto, GDPR/AI Act, LLM data boundary, certification roadmap |
| 5 | [`05-delivery-plan.md`](05-delivery-plan.md) | Team, 5 phases over 20 weeks, backlog, gates, metrics, risks, and two costings — conventional and AI-first (§5.8) |
| 6 | [`06-ai-contracts.md`](06-ai-contracts.md) | JSON schemas, prompt structure, cache layout, concrete API calls, eval definitions |

## The MVP boundary

**In scope (v0.1, pilot-ready):**

- One process: **Revenue / order-to-cash**, one engagement type: statutory audit interim phase.
- Three walkthrough modes: AI-led interview, auditor-led with AI listening, client self-service questionnaire.
- Client knowledge base per engagement (prior-year file, process descriptions, org chart, system list, sample documents).
- Generation of: narrative, process flow, risks + assertions, controls + gaps, key control suggestions, draft RCM, suggested test procedures, follow-up questions and evidence requests (live during the interview).
- Review/approve workflow with provenance, versioning, and an append-only audit trail.
- Export to Word and Excel; canonical JSON export.
- Separate, EU-hosted workspaces per client and engagement, SSO, MFA, RLS-enforced isolation.
- Prior-year comparison for the revenue process (diff of narrative, risks, controls).

**Explicitly out of scope for v0.1** (planned, sequenced in `05`):

- The other five processes (purchases, payments, payroll, inventory, IT/ITGC) — the
  template engine is built generic; only the Revenue content pack ships.
- Direct Caseware / AuditFile / CCH write-back (v0.1 exports files; API integration is post-MVP).
- Execution of control testing (sampling, tick-marks, workpaper generation) — v0.1 *suggests* the tests.
- Firm-configurable methodology editor (v0.1 loads firm methodology as configuration + templates maintained by us with the design partner).
- Mobile app, offline mode, real-time multi-auditor co-editing.

## Eleven decisions that shape everything else

1. **Staged pipeline, not one big agent.** Each artefact (facts → narrative → risks → controls → RCM → tests) is produced by a separate, typed, individually evaluable stage. Reviewable, cacheable, cheap to re-run, and each stage can be regression-tested. See `03`.
2. **No claim without a source.** Every generated object carries `evidence_refs` pointing at transcript spans or document chunks. Objects that fail the grounding validator are surfaced as *"needs source"* rather than silently shown. This is the single most important trust mechanism in the product.
3. **Coverage model drives the interview**, not free-form chat. The Revenue template defines coverage items with must-know facts; the AI's follow-up questions are generated to close open coverage items. This is what makes it an audit tool instead of a chatbot.
4. **The auditor's edit is the truth.** AI output is always a *draft version*. Approval freezes a version; regeneration creates a new version and never overwrites approved content.
5. **Isolation is enforced in the database**, via Postgres row-level security keyed on tenant + engagement, not by application filters or by prompt instructions. Cross-tenant leakage tests run in CI.
6. **EU-resident inference.** Recommended path: Claude on **Amazon Bedrock, `eu-central-1`** (Frankfurt) so model inference stays in the EU under an existing AWS DPA. Trade-off: Bedrock has no Message Batches or Files API — we implement our own batching queue and pass documents inline. Alternative path (first-party Claude API with a zero-data-retention agreement) is kept behind one config flag. See `04`.
7. **Untrusted-by-default handling of client content.** Uploaded documents and transcripts are data, never instructions; prompt-injection defences and a strict tool allowlist are part of the pipeline design, not an afterthought.
8. **Model routing by stage.** `claude-opus-5` for judgement-heavy stages (risks, controls, key-control selection), `claude-sonnet-5` for extraction and the low-latency live interview loop, `claude-haiku-4-5` for classification/redaction. See `06` for the cost model — a full revenue walkthrough lands around €4–9 in model spend.
9. **Built AI-first, reviewed human-first.** These documents are the specification, so
   the build runs through Claude Code against them: ≈2.5–3.0 FTE instead of 6.4, and
   €245–390k instead of €525–710k (`05 §5.8`). Four things never ship on AI review
   alone — tenant isolation, the grounding validator, auth and crypto, and the audit
   methodology itself.
10. **Design partners from week 0.** Three audit firms (one Big-4 team, two mid-tier) commit to recording five real revenue walkthroughs and to piloting in the Sep–Dec interim season. The season is a hard deadline; the plan is built backwards from it.
11. **Documentation says an AI helped.** The exported file records that the artefact was AI-assisted, which model version produced it, who reviewed it and when — because that is what ISA 230 documentation and the firm's quality management system will be asked for.

## One-paragraph pitch of the user experience

An audit senior opens the engagement, clicks **Revenue → New walkthrough**, drops last
year's process description and this year's system list into the knowledge panel, and
starts the meeting. During the call the left pane shows the live transcript, the middle
pane shows the coverage checklist filling in green, and the right pane fills with
follow-up questions to ask, risks spotted, and evidence to request — which they can push
into the client portal with one click. Twenty minutes after hanging up, the walkthrough
tab shows a finished narrative, a flow diagram, eleven risks mapped to assertions, nine
controls with three gaps, four suggested key controls, a draft RCM and a test plan. Every
sentence has a source; clicking it plays back the exact moment in the recording. The
senior edits, approves, the manager reviews, and it exports into the firm's file.
