# 0. Strategy, Phasing and the Capital Register

**This document now controls the other six.** Where `01`–`06` describe a capability, this
document says *when* it gets built and *what it costs*. Where they conflict, this wins.

The change in direction is not a change in ambition or in standards. It is a change in
*sequencing*: the previous plan defined the MVP as the first thing a Big-4 quality and
security department could approve. That is a real milestone — it is just not the first one
worth funding.

> **Doctrine.** Keep the audit-grade architecture and methodology. Delay enterprise-grade
> implementation until the core product value is demonstrated. Secure-by-design is not the
> same as enterprise-complete.

## 0.1 The hypothesis, and what actually tests it

> Can the platform reliably turn process-understanding information into audit documentation
> that auditors **mostly review rather than rewrite**?

Everything in Phase 0 exists to answer that and nothing else. Two consequences that shape
the whole plan:

1. **The answer does not require a product.** It requires a pipeline, a corpus, an eval
   harness and a read-only review page. A CLI and a static HTML report can settle the
   hypothesis before a single line of authentication is written.
2. **The measurement must be human, not only metric.** Risk recall against the firm's own
   working paper is necessary but not sufficient — the firm's paper is often mediocre, which
   is precisely the opportunity. See the Phase 0 gate in §0.5.

## 0.2 The two innovations, separated

| | Innovation A — Audit intelligence | Innovation B — Real-time meeting intelligence |
|---|---|---|
| What | Information → facts → narrative → risks → controls → gaps → review → export | WebRTC, streaming ASR, diarisation, 15-second coverage ticks, live follow-ups, the three-pane cockpit |
| Risk | Can it produce documentation an auditor would rather review than write? | Can we operate a real-time meeting reliably? |
| If it fails | Nothing else matters | The audit engine is still valuable |
| Phase | **0–1** | **4 (Product 3)** |

Separating them is the single largest cost reduction available, and it is not a compromise:
an excellent cockpit on top of a mediocre engine is worthless, while an excellent engine
with a plain input form is a business.

**The cheap substitute for the cockpit is better than it sounds.** Teams, Zoom and Meet all
produce transcripts today. Importing one and running the full pipeline delivers most of the
cockpit's value at roughly 2% of its cost. The only thing genuinely lost is *asking the
follow-up question during the meeting* — which returns in Product 3. Frame transcript import
as a feature, not a stopgap; it is how the product should work for firms that will never
adopt a new meeting tool.

## 0.3 Product sequence

```
P0  Revenue Audit Intelligence Engine     transcript/notes in → audit-ready structure out
P1  Revenue Walkthrough Workspace         questionnaire + import → coverage → review → export
P2  Secure Audit Interim Platform         controlled real-client use, design-partner alpha
P3  Live Walkthrough Copilot              real-time conversation intelligence
P4  Interim Audit Operating Layer         prior year, evidence, RCM depth, integrations
P5  Broader Audit AI Platform             more processes, control testing, further modules
```

## 0.4 Phase codes used in the register

| Code | Phase | Trigger to build |
|---|---|---|
| **A** | Audit Engine Validation | Needed to answer the hypothesis |
| **B** | Working Prototype | Needed for an auditor to use the workflow themselves |
| **C** | Design-Partner Alpha | Needed before **any real client data** touches the system |
| **D** | Secure Paid Pilot | Needed before **taking money** and relying on it for live work |
| **E** | Post-commercial | Build when customers pay and ask |
| **F** | Enterprise readiness | Build when procurement, not risk, demands it |

Mapping to §26 of the revision brief: **A/B = Category A** (prove value), **C/D = Category B**
(safely process real data), **E/F = Category C** (procurement and assurance maturity).

## 0.5 Capital gates

### Phase 0 — Audit Engine Validation · target €4–11k · 6–8 founder-weeks

**Build:** Revenue methodology pack, coverage model, typed stage framework, S3 facts →
S4 narrative + flow → S5 risks → S6 controls + gaps, evidence-reference model, grounding
validator, eval harness, golden corpus, a read-only review page.
**Do not build:** authentication, multi-tenancy runtime, live audio, portal, ingestion
pipeline for PDFs (plain text is enough), exports beyond a rough Word render.

**Gate — all four, not three:**
1. Risk recall ≥ 85% against SME-labelled ground truth, precision ≥ 75%.
2. Grounding failures ≈ 0 on the corpus; every object traceable.
3. Coverage recall ≥ 85% on the twelve sub-processes.
4. **Blind preference test:** three auditors, each shown an anonymised pair (our output vs
   the firm's own working paper for the same walkthrough), asked which they would rather
   start from. Target: ours preferred or judged equal in ≥ 60% of pairs. Cost: six auditor
   hours. This is the gate that actually matters, and metrics alone can pass while it fails.

### Phase 1 — Working Prototype · cumulative €6–16k · 6–8 founder-weeks

**Build:** managed auth, firm/engagement structure (with tenancy in the schema from the
first migration — see §0.7), transcript import, structured note entry, AI questionnaire,
coverage tracking, review workspace with provenance and versioning, deterministic RCM
assembly, Word/Excel export, basic append-only event log.
**Data:** synthetic and firm-anonymised only. No real client data yet.

**Gate:** auditors materially prefer reviewing generated documentation to authoring it —
measured on edit rate (≥ 60% of blocks accepted unchanged or lightly edited) and on
end-to-end time for one revenue process.

**Bridge worth taking:** run the first real walkthroughs on the **design partner's own
revenue process**, with the firm itself as the audited entity. Real auditors, real judgement,
zero client confidentiality, no security review required. It is the cheapest way to get from
synthetic data to real behaviour.

### Phase 2 — Design-Partner Alpha · cumulative €14–30k · 4–6 founder-weeks

**Build:** production tenancy with RLS enforced and tested, authorization tests in CI,
cross-tenant suite, EU managed infrastructure, MFA mandatory for auditor accounts, secure
client questionnaire links, controlled document ingestion with AV scanning, logging and
alerting, backups **with a tested restore**, engagement deletion, a written retention
position, light independent review of the isolation code.
**Partners: three, not five.** Each one costs real support time; three gives signal, five
eats the capital advantage that justifies this whole plan.

**Gate:** demonstrated use on real engagements, high output acceptance, measured time
saving, willingness to continue — ideally willingness to pay.

### Phase 3 — Secure Paid Pilot · cumulative €32–60k

**Buy:** independent architecture and security code review, penetration test with
remediation, privacy pack (DPA, DPIA where required, retention policy, privacy notice),
incident-response process, **professional indemnity and cyber insurance** (see §0.8 — the
previous plan omitted this and procurement will ask).

**Gate:** firms pay. Not verbal enthusiasm — an invoice.

### Phase 4–5 — Productisation and enterprise readiness

Financed by revenue or a raise. This is where the previous €245–390k plan resumes: live
cockpit, ASR, prior-year comparison, test procedures, SSO/SCIM, ISO 27001, ISAE 3402,
per-tenant KMS, hash-chained trail, methodology editor, further process packs.

## 0.6 The capital register

Effort in founder-days (`fd`) and specialist-days (`sd`). Cash excludes founder time.
Specialist rates assumed: audit SME €700–1,200/day, application-security or architecture
reviewer €900–1,200/day, privacy counsel €200–300/hour.

### Methodology and audit content

| Item | Phase | Why there / risk of delaying | Cheaper managed route | Debt if later | Founder | Specialist | Cash |
|---|---|---|---|---|---|---|---|
| Revenue pack: 12 sub-processes, coverage items, must-know facts | **A** | It *is* the hypothesis. Nothing downstream is testable without it | None — this is the IP | n/a | 6–10 fd | 3–5 sd SME | €2.5–6k |
| Risk + control libraries (~40 / ~50) | **A** | Anchors output in firm vocabulary and is the main hallucination control | None | n/a | 3–5 fd | 2–3 sd SME | incl. above |
| Assertion and inherent-risk-factor vocabularies | **A** | Enum used by every schema; changing it later rewrites every prompt and record | None | High | 1 fd | 0.5 sd | — |
| Deterministic follow-up triggers on missing facts | **A** | The difference between an audit instrument and a chatbot | None | Medium | 3–5 fd | — | — |
| ISA 240 fraud / management-override mandatory items | **A** | Omitting them makes the output professionally wrong, not merely thin. Costs a day | None | n/a | 1 fd | 0.5 sd | — |
| Key-control *proposal* with criteria assessment | **B** | Auditors judge the engine partly on this; it is a prompt, not infrastructure | None | Low | 2 fd | 0.5 sd | — |
| Suggested test procedures | **E** | Downstream of key controls; no bearing on the hypothesis | None | Low | — | — | — |
| Sample-size parameter tables per firm | **E** | Needs a paying firm's methodology to be worth anything | None | Low | — | — | — |
| Prior-year *diff* | **E** | Most-requested feature, but you have no second year of structured data anyway | None | Low | — | — | — |
| Prior-year documents as an *evidence source* | **B** | Nearly free once ingestion exists, and it is what makes output feel tailored | None | Low | 0.5 fd | — | — |
| Firm methodology editor | **F** | Configuration by hand serves three partners fine | None | Medium | — | — | — |
| Second process pack (purchases, payroll…) | **E/F** | One exceptional pack beats six mediocre ones | None | Low | — | — | — |

### AI pipeline

| Item | Phase | Why there / risk of delaying | Cheaper managed route | Debt if later | Founder | Specialist | Cash |
|---|---|---|---|---|---|---|---|
| Typed stage framework, schemas, validators | **A** | The architecture the brief wants preserved | Zod + plain TS | n/a | 4–6 fd | — | — |
| S3 facts / S4 narrative + flow / S5 risks / S6 controls + gaps | **A** | The hypothesis itself | Claude API | n/a | 8–12 fd | — | model spend |
| Evidence-reference model in the schema | **A** | **Highest retrofit cost in the plan.** Adding provenance later means rewriting every prompt, schema, record and screen | None | **Very high** | 2 fd | — | — |
| Grounding validator (deterministic code) | **A** | The core differentiator; also the component where a silent bug is invisible | None | **Very high** | 3 fd | 0.5 sd review at D | — |
| Prompt-injection handling (delimiters, no side-effecting tools, restated rules) | **A** | Structural, near-zero cost now; retrofitting means re-validating every stage | None | Medium | 1–2 fd | — | — |
| Eval harness + golden corpus | **A** | Without it you are guessing, and every later prompt change is unmeasured | Run in CI | High | 4–6 fd | 3–5 sd SME labelling | €2.5–6k |
| Batch API for eval runs | **A** | Halves the cost of the phase's dominant spend | First-party Claude API | Low | 0.5 fd | — | saves money |
| Model routing + per-stage cost/latency telemetry | **A** | You cannot manage what you do not measure; one day | — | Low | 1 fd | — | — |
| PDF/Docx ingestion, OCR, chunking, embeddings | **B** | Phase 0 runs on plain text; ingestion is for real documents | Managed OCR (Textract / Document Intelligence); pgvector | Low | 3–4 fd | — | usage |
| Hybrid retrieval (vector + lexical) | **B** | Needed once documents exist; trivial in Postgres | pgvector + tsvector | Low | 2–3 fd | — | — |
| Reranking pass | **C** | Quality tuning, not capability | Haiku call | Low | 0.5 fd | — | — |
| Deterministic RCM assembly | **B** | Pure code joining existing structures; auditors expect the artefact | None | Low | 2 fd | — | — |
| Live coverage tick (15s loop) | **E** | Product 3 | — | Low | — | — | — |

### Product and interface

| Item | Phase | Why there / risk of delaying | Cheaper managed route | Debt if later | Founder | Specialist | Cash |
|---|---|---|---|---|---|---|---|
| Read-only review page (Phase 0 output viewer) | **A** | Needed to run the blind preference test | Static HTML from the CLI | None | 1–2 fd | — | — |
| Review workspace: block approve / edit / reject, provenance pane | **B** | This is where auditors spend their time; the product lives or dies here | — | n/a | 8–12 fd | 1–2 sd design | €0–2k |
| Finding versioning + immutability after approval | **B** | Cheap now; a data-migration problem later | — | High | 2 fd | — | — |
| Coverage view | **B** | The visible proof that the engine is systematic | — | Low | 2 fd | — | — |
| Transcript import (Teams/Zoom VTT, notes) | **B** | **The highest value-per-day item in the plan** — most of the cockpit's value for 1–2 days of work | — | None | 1–2 fd | — | — |
| Structured note entry (auditor-led mode) | **B** | Fallback input; weaker value than import or questionnaire | — | None | 2 fd | — | — |
| AI questionnaire for clients (async) | **B/C** | Tests the second input mode and the coverage engine's follow-ups | Magic-link, managed auth | Low | 5–8 fd | — | — |
| Word / Excel export | **B** | Auditors judge output in their own file format | `docx` + `exceljs` | Low | 3–4 fd | — | — |
| Two-level review (preparer / reviewer) | **C** | ISA 230 needs *who reviewed*; one level is not audit documentation | — | Low | 2 fd | — | — |
| Engagement dashboard | **C** | Convenience until there are many engagements | — | Low | 2 fd | — | — |
| Full client evidence portal / PBC | **E** | Firms already have channels for this | — | Low | — | — | — |
| Live walkthrough cockpit | **E** | Product 3 | — | Medium | — | — | — |
| Prior-year comparison UI, change detection | **E** | No second year of data yet | — | Low | — | — | — |

### Platform, tenancy and security

| Item | Phase | Why there / risk of delaying | Cheaper managed route | Debt if later | Founder | Specialist | Cash |
|---|---|---|---|---|---|---|---|
| `tenant_id` + `engagement_id` on every table, **RLS in the first migration** | **B** | Costs two days now. Retrofitting RLS onto a live schema with data and dozens of queries is the classic expensive migration — and the window where a mistake leaks a client | Managed Postgres (Neon / Supabase / RDS), EU region | **Very high** | 2 fd | 0.5 sd review at C | ~€1k |
| Server-side authorization helper (no frontend trust) | **B** | Trivial to do right from the start; a nightmare to unpick | — | High | 1 fd | — | — |
| Managed authentication | **B** | Never build this | Clerk / WorkOS / Auth0, EU | Low | 1 fd | — | €0–50/mo |
| MFA mandatory for auditor accounts | **C** | A provider toggle. Account takeover on a real engagement is the same confidentiality breach as cross-tenant leakage | Provider setting | None | 0.2 fd | — | — |
| Secrets management, environment separation, no production data locally | **B** | Free with any managed platform; expensive habit to fix later | Platform secret store | Medium | 1 fd | — | — |
| TLS + encryption at rest | **B** | Default on every managed service | Managed | None | 0 fd | — | — |
| Authorization tests in CI | **B** | The cheapest guarantee that the isolation still holds after every AI-generated change | — | Medium | 2 fd | — | — |
| Cross-tenant fuzz suite | **C** | Required before two real clients share the system | — | Medium | 2 fd | — | — |
| **Basic append-only audit event log** (actor, action, object, timestamp) | **B** | ISA 230 requires *who prepared / who reviewed and when*. Without it the output is not audit documentation, even in an alpha. Half a day — this is **not** enterprise polish | Postgres table, revoked UPDATE/DELETE | High | 0.5 fd | — | — |
| Engagement deletion + written retention position | **C** | Every design partner asks "what happens to our data when we stop?" | Cascade delete + prefix delete | Low | 1 fd | — | — |
| Backups **and a tested restore** | **C** | Managed PITR is free; an untested backup is a belief, not a control | Managed PITR | Low | 0.5 fd | — | — |
| Logging, monitoring, alerting | **C** | Needed to know something went wrong before a customer tells you | Sentry / Better Stack, EU | Low | 1 fd | — | €0–100/mo |
| Short-TTL signed URLs for documents | **C** | Real documents arrive here | Object store native | Low | 1 fd | — | — |
| AV scan on client uploads | **C** | Anything a third party uploads | Managed scanning / ClamAV worker | Low | 0.5 fd | — | — |
| EU hosting for all stores and inference | **C** | Target market; also the cheapest answer to the first procurement question | Managed EU regions | Medium | 1 fd | — | — |
| Zero-retention / no-training terms with the model provider | **C** | Contractual, free, but has lead time — start before Phase 2 | Provider agreement | None | 0.2 fd | — | — |
| No standing staff access to tenant data (policy + practice) | **C** | Free as a policy while the team is one person; expensive to introduce after habits form | — | Low | 0.2 fd | — | — |
| Independent architecture + security code review | **D** | Before real money and real reliance | Contract reviewer | n/a | — | 3–5 sd | €3–6k |
| Penetration test + remediation | **D** | The scope is small now: one app, one API, auth and tenancy | Boutique firm | n/a | 3–5 fd fixing | — | €8–15k |
| DPA, DPIA, retention policy, privacy notice | **D** (corpus agreement at **A**, see §0.7) | Needed to take money and process client data at scale | Templates + counsel review | n/a | 1 fd | 10–20 h counsel | €3–6k |
| Incident-response process (one page + contacts) | **D** | Cheap; the absence is what makes a small incident a crisis | — | Low | 0.5 fd | — | — |
| Professional indemnity + cyber insurance | **D** | Procurement will ask; you are drafting documentation used in a regulated audit | Broker | n/a | 0.5 fd | — | €1.5–4k/yr |
| Per-tenant KMS / customer-managed keys | **F** | Managed encryption at rest plus RLS protects the data; per-tenant keys prove maturity | KMS when asked | Medium | — | — | — |
| Hash-chained audit trail + WORM anchoring | **F** | Tamper-*evidence* is a procurement answer; tamper-*resistance* is already there via access control and backups | — | Medium | — | — | — |
| Two-person break-glass infrastructure | **F** | Meaningless with a one-person team; the policy is what matters now | — | Low | — | — | — |
| SAML / SCIM / directory sync | **F** | Managed auth providers add these as a paid tier when a customer demands it | Provider upgrade path | Low | — | — | — |
| ISO 27001 / ISAE 3402 | **F** | Assurance maturity, financed by revenue | — | n/a | — | — | — |
| Caseware and other integrations | **E/F** | Canonical JSON export is the substrate; the integration follows the paying customer | — | Low | — | — | — |

## 0.7 Challenge — where the revised sequencing is genuinely wrong

The brief asked me not to simply agree. Eight items, split by severity.

### Unacceptable if omitted — fix the sequencing

**1. Phase 0 touches real client data, so the legal work starts in Phase 0, not Phase 3.**
The ground-truth corpus is a design partner's historical working papers. That material is
the firm's IP, is covered by professional secrecy, contains the audit client's confidential
information and names real people. A firm cannot hand it over on a handshake, and if one
does, that is a warning about the firm, not a win.
*Fix, in order of preference:* (a) the firm anonymises before it leaves their environment —
entity names, people, amounts replaced — and you receive only redacted text, which removes
most of the problem and costs nothing; (b) a one-page data-sharing and processing agreement,
ideally drafted by the firm's own legal team, stating evaluation-only use, no model training,
deletion on request. Budget €0–2k. Do not start collecting the corpus before one of these
is in place.

**2. Row-level security belongs in the first migration, not the first real customer.**
The brief already puts isolation early, but the failure mode is subtler than skipping it:
building a *half-tenancy* — `tenant_id` columns filtered in application code — and adding
RLS later. Retrofitting RLS onto a populated schema with dozens of queries and background
jobs is a genuine re-platforming task, and every missed policy is a client-confidentiality
bug. Two days in Phase 1 versus a fortnight and real risk in Phase 2.

**3. A basic audit trail is a methodology requirement, not enterprise polish.**
The brief defers the hash-chained trail (correctly) but the *plain* append-only log —
who prepared, who reviewed, when, what changed — is what ISA 230 asks for. Without it,
Phase 2 output is a draft, not audit documentation, and the design partners cannot put it
in a file. Half a day. Keep the hash chain and WORM anchoring in F.

**4. MFA is mandatory for auditor accounts from first real data.**
The brief says "MFA where easy to provide". Make it required at Phase 2. It is a toggle in
any managed provider, and the consequence of an account takeover on a live engagement is
identical to the cross-tenant leak the brief rightly refuses to risk.

**5. The Phase 0 gate, as written, can pass while the product fails.**
Recall against the firm's own working paper measures agreement with existing practice — and
existing practice is the thing you claim to improve. Add the blind preference test in §0.5.
Six auditor hours; it is the cheapest and most decisive experiment in the plan.

**6. Professional indemnity and cyber insurance are missing from the cost model.**
You will be drafting documentation used in a statutory audit. Procurement asks for
certificates before signature, and cover has lead time. €1.5–4k a year, Phase 3.

### Professionally uncomfortable, but genuinely fine to defer

**7. The enterprise security stack.** Per-tenant KMS, hash chaining, WORM anchoring,
two-person break-glass, privileged-access infrastructure, SAML/SCIM, ISO 27001, ISAE 3402 —
every one of these is a procurement answer rather than a control that protects a three-firm
alpha better than managed encryption at rest, RLS, MFA, least privilege and logging already
do. Deferring them is uncomfortable to write in a security section and correct in practice.
None creates re-platforming cost: KMS is an encryption-envelope change, hash chaining is an
insert-path change, SSO is a provider tier.

**8. The entire real-time layer.** WebRTC, ASR, diarisation, reconnect resilience, the
15-second tick, the cockpit. Deferring loses nothing structural provided the pipeline stays
runnable from a transcript — which it must be anyway, since that is how evals run forever.
The one caution is in §0.9.

### Two structural cautions that are cheap now and annoying later

**9. Keep the pipeline headless.** The stages, schemas, validators and eval harness live in
a package that runs from a CLI with no web framework present. Phase 0 depends on it, CI
depends on it forever, and Product 3 will call the same package from a different transport.
Writing the pipeline inside Next.js route handlers is the most likely way this plan
accidentally rebuilds itself in Phase 1.

**10. Use the first-party Claude API in Phases 0–1, EU-resident inference from Phase 2.**
On synthetic and anonymised data there is no residency requirement, and the first-party API
gives you the Message Batches API — 50% off the phase's dominant cost — plus the Files API.
When real client data arrives at Phase 2, switch the `LlmClient` implementation to an
EU-resident deployment. Keep the abstraction from day one; it is a configuration switch, not
a rewrite.

## 0.8 Revised cost model

| Phase | Founder | Cash — likely | Cash — if things go badly | Dominant cost |
|---|---|---|---|---|
| **0 Engine validation** | 6–8 weeks | **€4–11k** | €15k | SME days; model spend for eval runs |
| **1 Prototype** | 6–8 weeks | **+€2–5k** → €6–16k | €22k | Infrastructure, a little design help |
| **2 Design-partner alpha** | 4–6 weeks | **+€8–14k** → €14–30k | €40k | Isolation review, data agreements, EU infra |
| **3 Secure paid pilot** | 3–5 weeks | **+€18–30k** → €32–60k | €75k | Pen test, security review, privacy pack, insurance |
| **4–5 Productisation and enterprise** | — | financed by revenue or a raise | | The previous €245–390k plan resumes here |

**Phase 0 in detail**, because it is the number most likely to be wrong:

| Line | Low | High | Note |
|---|---|---|---|
| Audit SME (pack review + corpus labelling) | €0 | €6k | €0 if the SME is a co-founder or advisor on equity; this is the single largest swing factor |
| Model spend for development and eval runs | €800 | €2,500 | ~€45 per full 30-scenario suite at Opus high effort; iterate on a 6-scenario smoke set (~€9) and run the full suite at milestones; halve with the Batch API |
| Corpus data-sharing agreement | €0 | €2,000 | €0 where the firm's own legal drafts it or the corpus is anonymised before it leaves them |
| Claude Code subscription, tooling, domain | €300 | €600 | |
| **Total** | **€1.1k** | **€11.1k** | |

**What blows this budget:** an SME on full commercial rates rather than equity; a pen-test
scope that expands to "the whole platform" instead of app, API, auth and tenancy; and a
design partner that insists on SSO or ISO before the alpha. The answer to the last one is
either "not yet" or "that is a paid enterprise engagement" — never "yes, we'll build it".

**Direct answer to the financial question.** Yes: **€4–11k determines whether the engine
works**, **€14–30k puts it in front of design partners on real engagements**, and
**€32–60k reaches a defensible paid pilot** — on the stated assumptions of heavy founder
involvement, heavy Claude Code use, managed infrastructure and selective specialist review.
The €245–390k figure was never the cost of the hypothesis; it was the cost of the
destination.

## 0.9 Staffing

| Phase | Founder | Bought in |
|---|---|---|
| 0 | Everything: pack authoring with Claude, pipeline, evals | Audit SME 3–5 days (equity preferred); three auditors × 2 h for the blind test |
| 1 | Product build | Designer 1–2 days on the review workspace; SME 1–2 days on output review |
| 2 | Tenancy, alpha support | Security reviewer 1–2 days on isolation code; privacy counsel a few hours on the alpha agreement |
| 3 | Remediation | Architecture + security review 3–5 days; pen-test firm; privacy counsel 10–20 h; insurance broker |
| 4+ | Hiring begins here, funded by revenue | First hires: full-stack engineer, then audit methodology lead |

**Rules that make founder-plus-AI safe rather than reckless:**

- Five files never merge on AI review alone: the RLS migration, the request-context and
  session plumbing, the authorization helper, the grounding validator, and signed-URL / token
  issuance. One day of a human reviewer, roughly €1k, is the cheapest insurance in this plan.
- Every AI-generated change to a pipeline stage runs the eval suite before merge.
- The audit methodology is drafted with Claude and **signed off by a qualified human**.
  AI-generated audit content reviewed only by AI is precisely the failure mode this product
  exists to prevent.

## 0.10 What still must not be compromised

Unchanged from the original plan and reaffirmed here: server-side tenant and engagement
isolation; authorization; secure secret handling; encryption in transit and at rest;
provenance and grounding validation; source traceability; human approval with attribution;
audit methodology quality; controlled model context; automated access-control tests; EU and
privacy handling once real data is involved; and independent human review of
high-consequence code before production reliance.

## 0.11 The moat, restated

Not infrastructure. The durable assets are: audit methodology encoded as machine-readable
logic; the coverage models; the grounded data model and provenance; the human-review
workflow; the proprietary evaluation corpus; the accumulated record of what auditors
actually edited; firm methodology configuration; and the trust that follows from all of it.
Phase 0 builds five of those eight for under €11k. The cockpit is a UX moat for later.
