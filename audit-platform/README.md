# Interim Audit Platform — Build Plan

Working title: **Walkthrough** (placeholder).

An AI-assisted workflow platform for the interim phase of a statutory audit. It turns
process-understanding information — an imported meeting transcript, a structured client
questionnaire, or an auditor's notes — into audit-ready documentation: process narrative,
flow, risks mapped to assertions, controls and gaps, and a draft Risk & Control Matrix. All
of it reviewable, editable and approvable by the auditor, with every claim traceable to its
source.

> **Start here:** `00-strategy-and-phasing.md` for the sequencing,
> `07-phase-0-execution-plan.md` for what to build first, and
> `09-founder-critical-path.md` for what is waiting on you personally.
>
> **Read `00-strategy-and-phasing.md` first.** It is the controlling document: it decides
> what gets built in which phase and what each phase costs. Documents `01`–`06` describe the
> full system; `00` sequences it.

## Read in this order

| # | Document | What it settles |
|---|---|---|
| **0** | [`00-strategy-and-phasing.md`](00-strategy-and-phasing.md) | **The hypothesis, the five capital gates, the A–F register for every requirement, where the lean sequencing is genuinely wrong, and the cost model** |
| 1 | [`01-product-and-ux.md`](01-product-and-ux.md) | Personas, the four-step flow, every screen, trust-by-design UX — and what ships when (§1.7) |
| 2 | [`02-audit-methodology.md`](02-audit-methodology.md) | Standards mapping, the Revenue template, coverage model, risk/control/RCM taxonomies (§2.12 phase map) |
| 3 | [`03-architecture.md`](03-architecture.md) | Managed-first stack, data model, the staged pipeline, the headless Phase-0 engine (§3.13) |
| 4 | [`04-security-privacy-compliance.md`](04-security-privacy-compliance.md) | Isolation, crypto, GDPR, the LLM data boundary — and the protects-the-data vs proves-maturity split (§4.12) |
| 5 | [`05-delivery-plan.md`](05-delivery-plan.md) | Staffing, design partners, the five gates, backlog by phase, metrics, risks |
| 6 | [`06-ai-contracts.md`](06-ai-contracts.md) | Schemas, prompt and cache layout, API calls, eval harness — and Phase-0 engine economics (§6.9) |
| **9** | [`09-founder-critical-path.md`](09-founder-critical-path.md) | **The living checklist of what only you can do — SME, design partners, paired cases, data agreement, raters. The engineering track is ahead of the human track; this is the critical path** |
| 8 | [`08-tooling-and-development-stack.md`](08-tooling-and-development-stack.md) | The frozen Phase 0 toolchain, costs per tool, and the API gate (§G) |
| **7** | [`07-phase-0-execution-plan.md`](07-phase-0-execution-plan.md) | **The build backlog for Phase 0: engine surface, schemas, methodology minimum, corpus construction, metrics and thresholds, the blind-test protocol, effort, cost, the seven-week sequence, and what must not be built** |

## The doctrine

> Keep the audit-grade architecture and methodology. Delay enterprise-grade implementation
> until the core product value is demonstrated. **Secure-by-design is not the same as
> enterprise-complete.**

The hypothesis to be tested before spending real money:

> Can the platform reliably turn process-understanding information into audit documentation
> that auditors **mostly review rather than rewrite**?

## Product sequence

```
P0  Revenue Audit Intelligence Engine    transcript/notes in → audit-ready structure out    €4–11k
P1  Revenue Walkthrough Workspace        questionnaire + import → coverage → review → export  €6–16k
P2  Secure Audit Interim Platform        real client data, three design partners            €14–30k
P3  Live Walkthrough Copilot             real-time conversation intelligence                revenue-financed
P4  Interim Audit Operating Layer        prior year, evidence, RCM depth, integrations
P5  Broader Audit AI Platform            more processes, control testing, further modules
```

Cumulative cash to a defensible **paid pilot: €32–60k** (Phase 3), assuming heavy founder
involvement, heavy Claude Code use, managed infrastructure and selective specialist review.
The earlier €245–390k estimate was never the cost of the hypothesis — it was the cost of the
destination, and it resumes at Phase 4.

## Scope

**Revenue / order-to-cash only**, in every phase up to Product 4. The template engine is
generic so the other five processes are content packs; only Revenue is implemented. One
exceptional workflow beats six mediocre ones.

## Twelve decisions that shape everything else

1. **Prove the engine before building the product.** Phase 0 has no authentication, no
   tenancy runtime and no cloud: a package, a CLI, an eval corpus and a static report.
2. **Separate the two innovations.** Audit intelligence first; real-time meeting
   intelligence (WebRTC, ASR, diarisation, the live cockpit) becomes Product 3. An excellent
   cockpit on a mediocre engine is worthless; the reverse is a business.
3. **Transcript import is the cheap substitute for the cockpit** — Teams and Zoom already
   produce transcripts, so one to two days of work delivers most of the cockpit's value.
   Treat it as a first-class feature, not a stopgap.
4. **No claim without a source.** Evidence references in the first schema, a deterministic
   grounding validator in code, `needs_source` rather than silent omission. The highest
   retrofit cost in the plan, and therefore Phase 0.
5. **A coverage model drives the interview**, not free-form chat. Deterministic follow-up
   triggers on missing facts; the model may add more but never replaces them.
6. **A staged pipeline, not one agent.** Typed stages with their own schema, prompt version,
   evals and re-run capability — and runnable headless, forever.
7. **The auditor's edit is the truth.** AI proposes; the auditor decides. Approval freezes a
   version and is attributable to a named human.
8. **Isolation in the database, from the first migration.** `tenant_id` and
   `engagement_id` everywhere with RLS enabled — two days now, a risky migration later.
9. **Buy commodity infrastructure, build audit intelligence.** Managed Postgres, auth,
   storage, queues, logging, inference. A modular monolith until scale forces a split.
10. **Founder plus AI before headcount** — but five files never merge on AI review alone:
    the RLS migration, request-context plumbing, the authorization helper, the grounding
    validator, and signed-URL/token issuance.
11. **Security that protects data ships early; security that proves maturity to procurement
    ships when customers pay for it.** Per-tenant KMS, hash chaining, WORM anchoring,
    break-glass, SAML/SCIM, ISO 27001 and ISAE 3402 are all Phase F. MFA, RLS, encryption,
    access-control tests and a plain audit log are not.
12. **Documentation says an AI helped** — model version, preparer, reviewer, dates — because
    that is what ISA 230 and the firm's quality management system will ask for.

## Where the lean plan needed correcting

Four items were moved *earlier* than the lean sequencing put them, because omitting them is
a genuine risk rather than a procurement gap (full reasoning in `00 §0.7`):

- **Legal work on the evaluation corpus starts in Phase 0**, not Phase 3 — that corpus is a
  design partner's real working papers.
- **RLS in the first migration**, to avoid a half-tenancy filtered in application code.
- **A plain append-only audit log in Phase 1** — ISA 230, not enterprise polish.
- **MFA mandatory from first real data**, not "where easy to provide".

Plus two additions: a **blind preference test** at the Phase-0 gate (metrics alone can pass
while the product fails), and **professional indemnity and cyber insurance** in the Phase-3
budget.
