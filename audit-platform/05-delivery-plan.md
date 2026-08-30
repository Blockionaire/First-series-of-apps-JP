# 5. Delivery Plan

## 5.1 Team

| Role | FTE | Why this person exists |
|---|---|---|
| Product lead / founder | 1.0 | Owns scope, design-partner relationships, the four-step promise |
| **Audit methodology SME** (ex-Big-4 senior manager or QA department) | 0.5–1.0 | Owns `02` — the template, libraries, standards mapping, and the review that stops us shipping something a quality department will reject. **This is the highest-leverage hire and the one most often skipped.** |
| Tech lead / architect | 1.0 | Architecture, tenancy and crypto design, code review |
| Full-stack engineers | 2.0 | Web, API, review workspace, RCM grid, portal |
| AI engineer | 1.0 | Pipeline stages, prompts, retrieval, eval harness, cost control |
| Product designer | 0.5 | The cockpit and review workspace are the product; they need real design |
| Security & compliance (fractional CISO) | 0.3 | Threat modelling, ISO/ISAE readiness, pen-test management, security pack |
| Privacy counsel / DPO (external) | 0.1 | DPA, DPIA template, AI Act classification, retention vs erasure |

≈ 6.4 FTE. Below five, cut scope (drop the client portal and prior-year comparison to
post-MVP), not quality gates.

## 5.2 Design partners — before any code

Three firms, contracted in week 0 with a one-page agreement covering: access to five
recorded real revenue walkthroughs (anonymised where required), two hours of methodology
time per week, and a commitment to a pilot. In exchange: free use through the pilot, and
influence on the template. Aim for one Big-4 team (rigour, hardest security review), one
mid-tier (fastest decision-making, most likely first paying customer) and one small firm
(reveals where the product is over-engineered).

Recordings collected in week 0–2 are the *golden set* the eval harness is built on. Without
them, everything after week 6 is guesswork.

## 5.3 Phases

Twenty weeks from kick-off to a pilot-ready MVP. Each phase ends in a demo to the design
partners with a written go/no-go.

### P0 — Discovery & foundations of the content (weeks 0–2)

- Contract three design partners; collect five recorded revenue walkthroughs plus the
  corresponding final documentation (narrative, RCM, test plan) — the ground truth.
- Methodology intake: each firm's revenue template, RCM columns, sample-size table,
  Word/Excel templates, review levels.
- Draft the Revenue template v0 (`02 §2.4`), risk and control libraries v0.
- Threat model, data-flow diagram, DPA/DPIA drafts started (they take longer than the code).
- Decide the LLM deployment path with each firm's security officer (Bedrock EU by default).
- **Exit:** signed partners, five recordings, template v0 reviewed by the SME, security
  design agreed in principle.

### P1 — Platform foundations (weeks 2–6)

- Monorepo, CI/CD, environments, IaC, observability.
- Tenancy: schema, RLS policies, engagement membership, the cross-tenant CI suite.
- Auth: OIDC SSO, MFA, roles; client-portal realm skeleton.
- Engagement + process CRUD, dashboard shell.
- Document ingest: upload → AV scan → OCR → structure-aware chunking → embeddings → summary.
- Hybrid retrieval with chunk-level citations; audit trail (append-only, hash-chained).
- **Demo:** create an engagement, upload last year's file, ask a grounded question and get
  an answer with page-level citations. **Exit gate:** cross-tenant suite green.

### P2 — The walkthrough engine (weeks 6–10)

- Template loader and coverage state machine.
- Realtime gateway: WebRTC audio, streaming ASR with diarisation, live transcript.
- Coverage tick (S1): coverage updates, deterministic + model-proposed follow-ups,
  provisional risks/controls, evidence requests.
- Cockpit UI (S3): three panes, live insights, one-click evidence request.
- AI-led mode with question sequencing and barge-in; questionnaire mode in the portal.
- Consent capture and recording indicator; resilience (buffer, reconnect, replay).
- **Demo:** run a real 45-minute walkthrough end-to-end and finish with ≥85% coverage.
  **Exit gate:** no meeting-blocking latency; a dropped connection loses nothing.

### P3 — Generation & review (weeks 10–14)

- Stages S2–S9: facts → narrative + flow → risks → controls/gaps → key controls → RCM → tests.
- Grounding validator and the `needs_source` state.
- Review workspace: block-level approve/edit/reject, provenance pane with audio playback,
  versioning and diffs, two-level sign-off.
- RCM grid; test plan screen with firm sample-size parameters.
- Eval harness v1 running against the golden set, in CI.
- **Demo:** walkthrough → full documentation set reviewed and approved in under 90 minutes.
  **Exit gate:** hallucination rate (unresolvable/unsupported evidence refs) = 0 in
  approved output; ≥60% of generated blocks approved without material edit.

### P4 — Around the core (weeks 14–17)

- Exports: DOCX (firm template), XLSX RCM + sources sheet, canonical JSON.
- Client portal: requests, uploads, questionnaire, client-side audit trail.
- Prior-year comparison and the "changes vs prior year" section.
- Dashboard: status, coverage, open items, risks/controls/tests counts.
- Notifications and reminders.
- **Demo:** the full four-step loop, including the client's side. **Exit gate:** an export
  opens cleanly in the firm's Word/Excel templates and passes a manager's review.

### P5 — Hardening & pilot (weeks 17–20)

- External penetration test + remediation; load test of the realtime path.
- Retention jobs, deletion reports, backup/restore test, DR runbook.
- DPIA finalised, DPA signed, security pack published, AI Act documentation pack.
- Pilot onboarding: firm templates loaded, methodology parameters configured, training.
- **Exit gate:** the MVP checklist in §5.5 is fully green.

### Season timing — the one scheduling decision that matters

Interim walkthroughs cluster in **September–December**. A twenty-week build starting now
lands *after* that window. Do not wait a year for the next one:

- **Weeks 8–14: shadow pilot.** The firm runs its walkthroughs exactly as it does today;
  we record and generate in parallel with **zero reliance** on our output. This gives real
  data, real comparisons against the firm's own final documentation (the best possible eval
  signal), and zero risk to the file.
- **Weeks 20+: limited live pilot** on off-cycle engagements (non-December year-ends, and
  interim work done in Q1/Q2 — there is more of it than people assume).
- **Next September: full pilot** across three firms, with a product that already has a
  season of shadow evidence behind it.

## 5.4 Backlog — epics and acceptance criteria

| Epic | Key stories | Acceptance criteria |
|---|---|---|
| **E1 Tenancy & access** | RLS on all tables; engagement membership; SSO; MFA; roles; break-glass | Cross-tenant suite green; a user outside `engagement_members` gets 404 on every route; break-glass writes to the tenant's audit log |
| **E2 Knowledge base** | Upload, AV, OCR, chunking, embeddings, summary, prior-year flag | A 200-page PDF is searchable in <3 min; every retrieved chunk resolves to a page number |
| **E3 Template engine** | Load process pack; coverage state machine; mandatory items; applicability rules | Coverage % computed correctly with `not_applicable` reasons; walkthrough cannot complete with open mandatory items without a recorded reason |
| **E4 Live interview** | WebRTC, streaming ASR, diarisation, transcript persistence, reconnect | Partial transcript <1s; a 60-min session survives a 30s network drop with no data loss |
| **E5 Live insights** | Coverage tick, deterministic follow-ups, model follow-ups, evidence requests | Insight refresh ≤15s; every suggestion carries a reason and a source quote; requests reach the portal in one click |
| **E6 AI-led mode** | Question sequencing, phrasing, barge-in, TTS, "park" | A complete AI-led walkthrough reaches ≥80% coverage on a golden-set scenario |
| **E7 Generation** | S2–S9 with schemas, validators, provenance, cost logging | Every persisted object has ≥1 resolvable evidence ref or is `needs_source`; per-stage cost visible in the dashboard |
| **E8 Review workflow** | Block statuses, edit, approve, reject with reason, comments, versioning, two-level sign-off | Approved content is immutable; regeneration creates a version with a visible diff; sign-off records who/when per artefact |
| **E9 RCM & tests** | Grid, filters, add/split rows, firm sample-size parameters | Excel round-trip preserves every field; sample size always displays its driving parameter |
| **E10 Prior-year** | Import, semantic diff, change classification, confirm-as-change | Every reported change has evidence; a removed risk requires an auditor reason |
| **E11 Client portal** | Requests, uploads, questionnaire, notifications | Client user can never reach an auditor artefact (proved by test); uploads land in the right engagement with an audit-trail entry |
| **E12 Export** | DOCX, XLSX, JSON, documentation footer | Opens in the firm's template with correct styles; footer names preparer, reviewer, dates, model version |
| **E13 Audit trail** | Append-only, hash chain, WORM anchoring, export | Tampering detectable; the trail exports as a readable PDF/CSV for an inspector |
| **E14 Evals** | Golden set, metrics, CI gate, drift monitoring | The suite runs in CI; a methodology or prompt change shows its effect as a diff |
| **E15 Compliance ops** | Retention jobs, deletion reports, DSAR export, consent records | Retention runs produce an auditable report; consent is retrievable per walkthrough |

## 5.5 Definition of MVP done

**Functional**
- [ ] A revenue walkthrough can be completed in all three modes.
- [ ] Full artefact set generated, reviewed, approved and exported to the firm's templates.
- [ ] Prior-year comparison produces a "changes vs PY" section with evidence.
- [ ] Client portal handles questionnaires and evidence requests end-to-end.

**Audit quality**
- [ ] The methodology SME and one design partner's quality department sign off the Revenue
      template, libraries and RCM schema.
- [ ] Every output block is traceable to a source in ≤5 seconds from the UI.
- [ ] Mandatory ISA 240 / fraud / management-override items cannot be silently skipped.
- [ ] The exported file satisfies an experienced-auditor read (ISA 230) in a blind review by
      a manager not involved in the engagement.

**Security & compliance**
- [ ] Cross-tenant suite green; pen test complete with no open critical/high findings.
- [ ] EU-only processing verified end-to-end, including the model endpoint.
- [ ] DPA, sub-processor list, DPIA template, security whitepaper published.
- [ ] Retention, deletion and break-glass flows demonstrated.
- [ ] Audit trail hash chain verified by an independent script.

**Operational**
- [ ] Cost per walkthrough measured and under €10.
- [ ] p95 generation time after a 60-minute walkthrough < 15 minutes.
- [ ] Restore from backup tested; DR runbook exercised.

## 5.6 Metrics

**The product metric that decides everything: edit rate.** For every generated block we
record whether the auditor approved it unchanged, edited it slightly, rewrote it, or
rejected it. That single distribution tells us whether the product is saving time, and it is
also the post-market monitoring signal we owe under the AI Act posture in `04 §4.9`.

| Metric | Baseline (today) | MVP target |
|---|---|---|
| Total auditor time per revenue process (interview + write-up + review) | 4–8 h | ≤ 1.5 h |
| Blocks approved without material edit | n/a | ≥ 70% |
| Unsupported claims in approved output | unknown | **0** |
| Coverage at end of walkthrough | not measured | ≥ 90% of applicable items |
| Follow-ups raised during the meeting (vs. after) | ~10% | ≥ 80% |
| Risk recall vs. the firm's own final documentation (shadow pilot) | — | ≥ 90% of the firm's risks found, plus additions |
| Review cycles before manager approval | 2–3 | ≤ 1.5 |
| p95 time from "end meeting" to "draft ready" | days | ≤ 15 min |
| Model cost per walkthrough | — | ≤ €10 |

Eval harness (runs in CI on every prompt/template change): golden set of the five real
recordings plus ~25 synthetic scenarios covering edge cases (over-time revenue, agent vs
principal, ERP migration mid-year, outsourced invoicing, heavy manual journals). Metrics:
coverage recall, risk recall/precision vs. SME-labelled ground truth, assertion-mapping
accuracy, grounding failure rate, schema validity, cost and latency per stage.

## 5.7 Cost model

**Run cost per 60-minute walkthrough** (Bedrock EU path, no batch discount; list prices:
Opus 5 $5/$25 per MTok, Sonnet 5 $2/$10, Haiku 4.5 $1/$5; cached input reads bill at a
fraction of base input — verify current cache multipliers against the pricing page when
budgeting):

| Component | Estimate |
|---|---|
| Live interview loop (~150 ticks, Sonnet 5 low effort, cached prefix) | $1.50–2.00 |
| S2 normalise (Haiku) | $0.05–0.10 |
| S3 facts (Sonnet) | $0.10–0.15 |
| S4–S7 narrative, risks, controls, key controls (Opus 5, high effort) | $1.30–1.60 |
| S9 test procedures (Opus 5) | $0.20–0.30 |
| S10 prior-year comparison (Opus 5) | $0.30–0.50 |
| Ingestion (embeddings + summaries) | $0.10–0.30 |
| ASR (self-hosted GPU, amortised) | €0.30–0.50 |
| **Total** | **≈ €4–6, budget €10 with re-runs and reviewer regenerations** |

Against 3–5 hours of senior time saved (€400–900 of capacity at typical Dutch rates), the
margin is not the constraint — trust is. Do not optimise cost before week 14; do measure it
from week 3.

**Build cost to pilot-ready** (20 weeks, ≈6.4 FTE): roughly €450k–600k fully loaded,
plus ~€25k infrastructure and tooling, €15–25k penetration test, €25–40k ISO 27001
preparation, €10–20k legal (DPA, DPIA, AI Act review). Materially lower if founders are
unpaid; the pen test and the methodology SME are the two line items not to cut.

**Pricing sketch** (for the business case, not part of the MVP): per engagement-process
(€250–500) or a per-engagement bundle covering all six processes (€1,500–3,000), plus a
firm platform fee. Anchored on time saved, not on seats — audit firms buy hours.

## 5.8 Risks

| # | Risk | Impact | Mitigation |
|---|---|---|---|
| 1 | **Hallucinated or unsupported audit content reaches a file** | Existential — a regulator finding would end the product | Grounding validator; `needs_source`; approval gate on export; zero-tolerance release gate; every claim traceable |
| 2 | **Quality department rejects the methodology** | No sale, at any price | SME on the team from week 0; template signed off in P0 and again in P3; firm methodology as configuration, never hardcoded |
| 3 | **Auditors don't trust the output and rewrite everything** | Time saving evaporates; product is worse than Word | Edit rate as the primary metric from P3; provenance UX; shadow pilot comparing our output to the firm's own |
| 4 | **ASR quality on Dutch, accents, and finance/ERP jargon** | Bad transcript ⇒ bad everything downstream | Domain lexicon boosting (system names, product names from the knowledge base); measure WER on the golden set; auditor can correct a segment and trigger re-generation |
| 5 | **Security review blocks the pilot** | 3–6 month delay | Security pack, pen test and DPIA finished *before* the pilot, not during; EU inference by default; cross-tenant test evidence handed over proactively |
| 6 | **Methodology heterogeneity across firms** | Endless bespoke work | Template + libraries + parameters as data; firm-specific content lives in configuration; refuse code forks |
| 7 | **Interim season timing** | A year lost | Shadow pilot in weeks 8–14 (§5.3); off-cycle live pilot at week 20 |
| 8 | **Scope creep to all six processes** | Nothing ships well | Revenue only in v0.1; the engine is generic but only one content pack ships; greyed-out tiles in the UI carry the vision |
| 9 | **Caseware/integration expectations** | Deal blocker late in the cycle | Set expectations early: v0.1 exports files; canonical JSON is the integration substrate; scope integration work in the pilot contract |
| 10 | **Model or provider change** (pricing, availability, deprecation) | Cost and quality volatility | `LlmClient` abstraction; model IDs and effort levels as configuration; evals detect regressions on model change; two viable deployment paths |
| 11 | **Client-side adoption** (process owners won't talk to an AI) | Half the value proposition | Auditor-led-with-AI-listening is the default mode; AI-led is opt-in; questionnaire as the low-friction fallback |
| 12 | **Prompt injection via client documents** | Manipulated audit conclusions | Untrusted-content handling (`03 §3.9`), no side-effecting tools in content-touching stages, egress allowlist, injection classifier flag |

## 5.9 Post-MVP roadmap

| Horizon | Content |
|---|---|
| **v0.2** (+3 months) | Purchases and Payments content packs; firm methodology editor (templates and libraries editable by the firm); SCIM; Caseware/CCH export mapping |
| **v0.3** (+6 months) | Payroll and Inventory; ITGC module (access, change, operations) with the IT auditor as a distinct persona; control testing execution (sampling, attribute workpapers, tick-marks) |
| **v0.4** (+9 months) | Entity-level controls and the other ISA 315R components; fraud risk workshop support; multi-year trend of process changes; benchmarking across a firm's portfolio (aggregated, never cross-tenant) |
| **v1.0** | The full interim operating layer: interview → understanding → risks → controls → key controls → testing → documentation → write-back into the audit system → sign-off, with the firm's methodology as a first-class configurable asset |
