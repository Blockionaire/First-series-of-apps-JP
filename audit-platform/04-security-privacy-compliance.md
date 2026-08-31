# 4. Security, Privacy and Compliance

> **Revised for the phased plan.** Nothing here is withdrawn — but §4.12 now separates the
> controls that *protect the data* from the controls that *prove assurance maturity to
> procurement*, and phases them accordingly. The first category is not negotiable at any
> budget. The second is deferred until customers pay for it. Where the revised sequencing
> was wrong, §4.12 says so.

The buyer is an audit firm bound by professional secrecy, supervised by a national
regulator, and processing its clients' confidential financial data. The security review is
not a formality that follows the sale — **it is the sale**. This document is written so it
can be handed to a firm's security officer and DPO more or less as-is.

## 4.1 What we are protecting, and from whom

| Asset | Sensitivity | Primary threats |
|---|---|---|
| Interview recordings and transcripts | High — unreleased financial information, named individuals, sometimes fraud discussion | Cross-tenant leakage, insider access, exfiltration via LLM prompt/response, subpoena/jurisdiction |
| Client documents (contracts, reports, prior-year files) | High — confidential and often price-sensitive | Same, plus malicious upload (malware, injection) |
| Working papers (risks, controls, RCM, conclusions) | High — regulated audit documentation | Tampering, undetected modification, loss of integrity of the audit trail |
| Firm methodology and templates | High — competitive IP of the firm | Leakage between tenants |
| Identity and access data | High | Account takeover, privilege escalation, unmanaged client-portal accounts |

Threat actors we design against, in priority order: (1) a bug that crosses a tenant or
engagement boundary; (2) a compromised or over-privileged internal account (ours or the
firm's); (3) content-borne attacks via uploaded documents; (4) opportunistic external
attackers; (5) unlawful third-country access to data at rest or in transit.

## 4.2 Isolation model

**Default: pooled infrastructure, hard logical isolation.**

- `tenant_id` on every row; **Postgres RLS** policies on every table; the application role
  has no `BYPASSRLS`; every transaction sets `app.tenant_id`, `app.user_id`, `app.role`.
- A second policy layer scopes to `engagement_members`, so a user in the right firm still
  cannot read an engagement they are not assigned to (this also implements ethical walls
  and independence separation inside a firm).
- Object storage keys are prefixed `tenant/<id>/engagement/<id>/…`; IAM policies and signed
  URLs (≤5 min TTL, single object, bound to the requesting session) enforce the prefix.
- **Per-tenant data keys**: envelope encryption with a KMS CMK per tenant; blobs and the
  transcript column family are encrypted with tenant-scoped data keys. A logic bug that
  leaks a storage key still yields ciphertext the other tenant's key cannot open.
- **Retrieval isolation**: vector search filters on `engagement_id` *and* is executed under
  RLS. There is no global index.
- **Optional silo tier** for large firms: dedicated database (or dedicated cluster),
  dedicated bucket, dedicated KMS key, same code path. Sold as an enterprise option; the
  architecture supports it from day one because the tenant is already the sharding key.

**Verification, not assertion.** A `cross-tenant` CI suite creates two tenants with two
engagements each and asserts denial across every procedure, every worker entry point, every
storage path and every retrieval query. It is a merge gate, and its report is part of the
security pack we hand to prospects.

## 4.3 Identity and access

| Aspect | v0.1 |
|---|---|
| Auditor auth | OIDC SSO against the firm's IdP (Entra ID / Okta); no local passwords in the enterprise tier |
| MFA | Enforced by the firm's IdP; for firms without SSO, WebAuthn or TOTP required, no SMS |
| Client portal auth | Separate identity realm, separate cookie/session domain, e-mail + OTP or magic link with short TTL, optional SSO; portal accounts are scoped to one engagement |
| Authorisation | RBAC (`partner`, `eqr`, `manager`, `senior`, `staff`, `client_user`, `readonly`) evaluated per engagement, plus artefact-level rules (only `manager+` can approve at reviewer level; only `partner`/`eqr` can lock) |
| Provisioning | SCIM (post-MVP) — v0.1 uses JIT provisioning from OIDC claims plus admin invitation |
| Sessions | Short-lived access tokens, rotating refresh, absolute session lifetime, device/session list, forced logout on role change |
| Our own staff access | No standing access to tenant data. Break-glass only: two-person approval, time-boxed, tenant notified, every action in the tenant's own audit log |

That last row is the one every firm asks about. The design answer is that support
diagnostics run on metadata (job status, error classes, token counts), never on content,
and content access requires an auditable break-glass flow.

## 4.4 Cryptography and key management

- TLS 1.3 everywhere, HSTS, modern cipher suites only; internal service-to-service traffic
  also TLS (mTLS where the platform supports it).
- At rest: AES-256-GCM. Database and volume encryption plus **application-level envelope
  encryption** for the highest-sensitivity fields (recordings, transcript text, uploaded
  document bodies) using per-tenant CMKs in an EU KMS with HSM backing.
- Key rotation: CMK annual (automatic), data keys per object; re-encryption jobs on rotation.
- **CMEK / bring-your-own-key** offered in the enterprise tier: the firm holds the CMK and
  can revoke it, which is the strongest possible answer to "what if we want our data
  cryptographically unreachable to you".
- Secrets in a managed secret store, injected at runtime, never in images or env files in
  the repo; automated secret scanning in CI.
- Backups encrypted with a separate key, restore tested quarterly (restore test evidence is
  part of the ISAE readiness pack).

## 4.5 Recording, consent and transparency

- Recording never starts without an explicit, logged consent step naming: who is recording,
  what is recorded, why, how long it is kept, and that an AI system is processing it.
  Consent is captured per participant and stored with the walkthrough.
- **Participants are told they are interacting with an AI system** in AI-led and
  questionnaire modes, in plain language, before the first question — the transparency
  expectation under the EU AI Act for AI systems interacting with natural persons, and
  simply the right thing to do in a professional setting.
- A visible recording indicator is present for the entire session; stopping the recording is
  always available, and a walkthrough can be completed with notes only.
- Member-state rules on recording conversations differ; the platform makes consent a
  configurable, blocking step per tenant rather than assuming one jurisdiction's rule.

## 4.6 GDPR

**Roles.** The audit firm is the controller for the personal data in the engagement (its
client's employees' names, roles, statements); we are the **processor**. A GDPR Art. 28 DPA
with documented sub-processors is part of the standard contract. The audit client is a data
subject population we never contract with directly — which is exactly why consent and
transparency live in the product, not only in a contract.

**Personal data actually present.** Names, job titles, e-mail addresses, voices (biometric
in the loose sense — a voice recording is personal data; we do not perform voice
identification, which keeps us out of Art. 9), and opinions expressed by identifiable people
about colleagues and controls. The last category is the sensitive one in practice: "the CFO
approves everything himself" is personal data *and* an audit finding.

| Principle | Implementation |
|---|---|
| Lawful basis | Controller's legitimate interest / legal obligation (the statutory audit). Consent is used for *recording*, not as the basis for processing the audit data itself |
| Purpose limitation | Data is used only to produce this engagement's documentation. **No training of models on customer data, contractually and technically** |
| Minimisation | Recordings are optional; retention of raw audio is separately configurable (default: delete audio after transcript approval + 90 days, keep the transcript) |
| Storage limitation | Retention policy per tenant, defaulting to the statutory audit retention period (at least 5 years for PIE working papers under Art. 15 of Reg. 537/2014; 7 years is the common Dutch setting), then automated deletion with a report |
| Integrity/confidentiality | §§4.2–4.4 |
| Data subject rights | Access/rectification requests are routed to the controller with a per-person export tool; **erasure is constrained by the audit retention obligation**, and the product says so explicitly (a deletion request against audit documentation is refused on the legal-obligation ground, and that refusal is itself logged) |
| Transfers | All processing in the EU (§4.7). Any sub-processor outside the EEA requires an explicit tenant opt-in, SCCs and a transfer impact assessment |
| DPIA | We produce a template DPIA covering recording, transcription and automated drafting for the controller to adopt — a concrete sales accelerator, since the firm must do one anyway |

## 4.7 The LLM data boundary — the question every firm asks first

**What leaves our systems and where does it go?**

| Data | Sent to the model? | Where inference runs |
|---|---|---|
| Transcript segments (current walkthrough) | Yes | EU region |
| Retrieved document chunks (this engagement) | Yes, only the retrieved chunks | EU region |
| Client profile summary + coverage state | Yes (cached prefix) | EU region |
| Firm methodology, templates, libraries | Yes (cached prefix) | EU region |
| Raw audio | **No** — audio goes to ASR only | EU GPU (self-hosted) or EU managed endpoint |
| Other engagements' or tenants' data | **Never** | — |
| Identity data, credentials | **Never** | — |

**Recommended deployment: Claude on Amazon Bedrock in `eu-central-1`.** Inference stays in
Frankfurt under the firm's (or our) existing AWS agreements, which is the easiest sentence
to get past a security officer. Two trade-offs we accept and design around:

- Bedrock does not offer the Message Batches API or the Files API. We implement our own
  batching queue for non-latency-sensitive work (prior-year comparison, re-runs) and pass
  documents inline as content blocks. The 50% batch discount is unavailable on this path —
  it is priced into the cost model in `05 §5.7`.
- Prompt caching, structured outputs / strict tool use, citations, adaptive thinking and
  effort control are all available on Bedrock, so the pipeline design in `03`/`06` is
  unaffected.

**Alternative, behind one configuration flag:** the first-party Claude API with a
zero-data-retention agreement, which unlocks Batches and Files and slightly lower operating
cost. This is offered only to tenants that accept it in writing after their own assessment.
The abstraction is a single `LlmClient` interface in `packages/ai`, so the choice is
per-tenant configuration, not a fork.

**Standing commitments in the contract:** no training on customer data; no human review of
customer content by the model provider outside contractual abuse-monitoring terms;
retention at the provider limited per the agreed terms; sub-processor list published and
change-notified.

## 4.8 Application security

| Area | Controls |
|---|---|
| SDLC | Branch protection, mandatory review, no direct pushes to `main`; threat model per epic; security-relevant changes flagged for a second reviewer |
| Pipeline | SAST (CodeQL/Semgrep), dependency and licence scanning, container scanning, IaC scanning, secret scanning — all blocking |
| Uploads | Type allowlist, size limits, AV/malware scan before indexing, quarantine bucket, content-type sniffing, no execution path, PDFs parsed in a sandboxed worker with no network egress |
| Injection | Parameterised SQL only; strict output escaping; CSP with nonces; no `dangerouslySetInnerHTML` on model output; prompt-injection defences per `03 §3.9` |
| API | Per-tenant and per-user rate limits, request size caps, idempotency keys on mutations, strict CORS, signed webhooks |
| Egress | Workers run with an egress allowlist (model endpoint, ASR, storage); nothing else can call out — this is a meaningful containment control against both exfiltration and injected-tool abuse |
| Logging | Structured logs with content redaction by default; correlation ids; log access is itself audited; logs retained 12 months in the EU |
| Vulnerability management | Quarterly external pen test (first one before the pilot), continuous dependency updates, documented SLAs (critical 24h, high 7d) |
| Availability | Multi-AZ, RPO 15 min / RTO 4h, quarterly restore tests, documented DR runbook |
| Incident response | Documented IR plan with severity levels, on-call, forensic log preservation, controller notification without undue delay and within 72h of awareness as required for the firm's own Art. 33 obligation |

## 4.9 EU AI Act posture

Our current, deliberate reading — to be confirmed with counsel before the pilot, and
re-confirmed as guidance develops:

- The system is an **AI system** placed on the market by us (provider), used by audit firms
  (deployers).
- It does not fall into a prohibited practice category, and we do not believe it falls in
  Annex III high-risk (it is a professional productivity and drafting tool; it does not
  determine access to services, employment, credit or essential benefits). **The decisions
  that matter remain human**: risk assessment, reliance and sign-off are the auditor's, and
  the product enforces that structurally.
- The transparency obligation for AI systems interacting with natural persons applies to the
  AI-led interview and questionnaire — implemented in §4.5.
- GPAI obligations sit with the model provider; we keep their documentation in our vendor
  file.

**We nonetheless build to a high-risk-shaped bar**, because it is cheap when done early and
because firms' quality departments will demand something like it regardless: documented
intended purpose and limitations, technical documentation of the pipeline, dataset/knowledge
provenance, logging of every inference with inputs' hashes and outputs, human-oversight
design (review/approve, override, "needs source"), accuracy and robustness testing (the eval
suite in `05 §5.6`), and a post-market monitoring loop that tracks correction rates in the
field.

If the classification later turns out to be high-risk for some deployment, the gap to close
is paperwork and conformity assessment — not a re-architecture. That is the point.

## 4.10 Assurance roadmap (what the buyer will ask for)

| When | Artefact |
|---|---|
| Before the pilot | Security whitepaper, architecture and data-flow diagrams, DPA + sub-processor list, template DPIA, first external pen test report + remediation, IR and BCP plans, cross-tenant test evidence |
| Pilot + 6 months | ISO 27001 certification (scope: the platform and its operations) |
| Pilot + 9–12 months | SOC 2 Type II *or* **ISAE 3402 Type II** — for this buyer ISAE 3402 is the more persuasive of the two, because the firm's own auditors and the regulator speak that language |
| Ongoing | Annual pen test, quarterly restore tests, continuous control monitoring, published status page and vulnerability disclosure policy |

Also on the radar: **NIS2** — if a tenant is itself in scope, its supply-chain security
obligations flow to us through the contract, so the ISO 27001 work is not optional in
practice.

## 4.11 The five sentences that must be true in the first sales meeting

1. Your data never leaves the EU, and model inference runs in Frankfurt.
2. No model is ever trained on your data, contractually and technically.
3. Tenant and engagement isolation is enforced in the database, and we test it on every
   commit — here is the evidence.
4. Nothing reaches your audit file without a named human approving it, and every sentence
   has a traceable source.
5. Here is the DPA, the sub-processor list, the pen test report and the DPIA template.

## 4.12 Security by capital phase

The distinction that governs this section:

> **Category B — protects the data.** Build before the relevant live pilot. Non-negotiable.
> **Category C — proves maturity to procurement.** Build when traction justifies it.

Deferring Category C is uncomfortable to write in a security document and correct in
practice. Deferring Category B is not an option at any budget.

### Category B — required before real client data (Phase C/D)

| Control | Phase | Why it protects data, not just procurement |
|---|---|---|
| `tenant_id` + `engagement_id` on every table, RLS in the first migration | **B** | The one boundary whose failure is a confidentiality breach. Two days now; a migration and real risk later |
| Server-side authorization, never frontend-trusted | **B** | — |
| Managed authentication with secure sessions | **B** | Never build this yourself |
| **MFA mandatory for auditor accounts** | **C** | A provider toggle. Account takeover on a live engagement is the same breach as cross-tenant leakage — the brief's "where easy to provide" is too soft |
| Automated authorization + cross-tenant tests in CI | **B/C** | The only guarantee that isolation still holds after each AI-generated change |
| Secrets in a managed store; environments separated; no production data locally | **B** | Cheap habit to form, expensive to retrofit |
| TLS 1.3 and encryption at rest | **B** | Default on managed services |
| **Basic append-only audit event log** | **B** | ISA 230 requires who prepared, who reviewed and when. Without it the output is not audit documentation. Half a day — this is *not* enterprise polish |
| Short-TTL signed URLs; AV scan on client uploads | **C** | Third-party file upload is an untrusted input path |
| Backups **with a performed restore test** | **C** | Managed PITR is free; an untested backup is a belief |
| Logging, monitoring, alerting | **C** | You need to know before the customer tells you |
| Engagement deletion + a written retention position | **C** | Every design partner asks what happens to their data |
| EU hosting for stores and inference; no-training / zero-retention terms | **C** | Target market, and contractual work with lead time |
| No standing staff access as a policy | **C** | Free while the team is one person; expensive after habits form |
| Independent security code review; penetration test; DPA, DPIA, retention policy, IR process | **D** | Before money changes hands and real reliance begins |
| Professional indemnity + cyber insurance | **D** | Procurement asks for certificates before signature; cover has lead time |

### Category C — deferred to enterprise readiness (Phase F)

| Control | Why deferring is genuinely safe | Cost of adding later |
|---|---|---|
| Per-tenant KMS / envelope encryption / CMEK | Managed encryption at rest plus RLS and least privilege already protect the data. Per-tenant keys defend against a *different* threat — proving cryptographic separation to a procurement questionnaire | Encryption-envelope change; medium, contained |
| Hash-chained audit trail + daily WORM anchoring | Tamper-*evidence* is an assurance argument; tamper-*resistance* already comes from access control, managed backups and revoked UPDATE/DELETE | Insert-path change; medium |
| Two-person break-glass infrastructure | Meaningless with a one-person team — the *policy* is what matters now | Low |
| SAML / SCIM / directory synchronisation | A paid tier of the managed auth provider, bought when a customer requires it | Low |
| Privileged-access management tooling | Same reasoning as break-glass | Low |
| ISO 27001, ISAE 3402 Type II | Assurance maturity, financed by revenue. §4.10's timeline moves to Phase F | n/a |

### What the revised sequencing got wrong

Four corrections, restated here so this document is self-contained (full reasoning in
`00 §0.7`):

1. **The legal work starts in Phase 0, not Phase 3.** The evaluation corpus is a design
   partner's historical working papers — their IP, covered by professional secrecy,
   containing their client's confidential information and named individuals. Either the firm
   anonymises before it leaves their environment (preferred, free) or there is a one-page
   data-sharing and processing agreement stating evaluation-only use, no model training and
   deletion on request. Nothing else in Phase 0 is legally interesting; this is.
2. **RLS in the first migration**, not at first customer. The failure mode is a
   half-tenancy filtered in application code.
3. **The plain audit log is a methodology requirement**, not procurement polish.
4. **MFA mandatory, not optional**, from first real data.

### Data classification drives the requirements

Security requirements attach to the **class of data being processed**, not to a phase number.
The authoritative table is `07 §7.2`; in summary:

| Class | What | Processing | Storage |
|---|---|---|---|
| **C0** Synthetic | Authored cases, no real entity | Any development configuration; batch processing | Repository |
| **C1** Anonymised historical | Firm walkthroughs anonymised *before leaving the firm* | First-party API under a data-sharing agreement | Encrypted disk, gitignored, no consumer cloud sync |
| **C2** Firm-confidential | The firm's own methodology and its own process walkthrough | No-training terms agreed in writing | Encrypted disk or the Phase 1 application |
| **C3** Audit-client confidential | Any real engagement material | **EU-resident inference, production architecture, RLS, MFA, logging** | Only in the Phase 2 platform — never on a laptop |

The phase table below is the consequence of this classification, not a separate rule.

### The LLM data boundary, by phase

§4.7 stands as the Phase-2 target. Before then:

| Phase | Data | Inference |
|---|---|---|
| **0–1** | Synthetic and firm-anonymised text only | First-party Claude API — no residency requirement yet, and the Batches API halves eval cost |
| **2 onwards** | Real client data | EU-resident inference, no-training and retention terms agreed in writing before the first real engagement |

The `LlmClient` abstraction makes this a configuration switch. Agreeing the provider terms
has lead time, so start that conversation during Phase 1, not on the day Phase 2 begins.
