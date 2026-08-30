import type { SeedPrompt } from "./types";

const p = (
  slug: string,
  title: string,
  category: string,
  description: string,
  body: string,
  variables: string[],
  premium = true,
  uses = 0,
  modelNote = "Tuned for Claude and GPT-class models; works in Copilot with the M365 context attached."
): SeedPrompt => ({ slug, title, category, description, body, variables, modelNote, premium, uses });

export const prompts: SeedPrompt[] = [
  // ——— Risk & Planning ———
  p(
    "engagement-risk-brainstorm",
    "Engagement risk brainstorm (ISA 315)",
    "Risk & Planning",
    "Structured identification of risks of material misstatement for a specific entity, with assertions, magnitude/likelihood, and the audit response each risk demands.",
    `You are assisting an audit team with risk identification under ISA 315 (Revised 2019). You are a challenger, not a checklist.

Entity: {{client_description}}
Industry: {{industry}}
Key developments this year: {{developments}}

Task:
1. Identify 8–12 candidate risks of material misstatement. For each: the account balance / class of transactions / disclosure affected, the relevant assertion(s), and the misstatement mechanism (how, concretely, the numbers would end up wrong).
2. Classify each as inherent-risk driver: complexity, subjectivity, change, uncertainty, or management-bias susceptibility.
3. Rate likelihood and magnitude (low/medium/high) with one sentence of reasoning each — never bare ratings.
4. Flag any candidates for significant risk, and say what makes them qualitatively different.
5. End with three questions the engagement team should ask management that they probably haven't.

Rules: ground every risk in the entity facts above, not generic industry lists. If information is missing that would change the assessment, name it explicitly in a "what we'd need to know" section. Do not invent facts.`,
    ["client_description", "industry", "developments"],
    false,
    412
  ),
  p(
    "materiality-memo-drafter",
    "Materiality determination memo",
    "Risk & Planning",
    "Drafts the planning materiality memo: benchmark selection with reasoning, percentage justification, performance materiality, and clearly trivial threshold.",
    `Draft a planning materiality memo for the audit file.

Entity: {{entity_name}}, {{entity_context}}
Financial data (current year, prior year): {{financial_data}}
Users of the financial statements: {{fs_users}}

Structure:
1. Benchmark selection — evaluate at least three candidate benchmarks (e.g. PBT, revenue, total assets, net assets) against the primary users' focus; recommend one with explicit reasoning, including why the others were rejected.
2. Percentage applied — propose a percentage within the customary range for the chosen benchmark, justified by entity-specific risk factors (listed), not boilerplate.
3. Performance materiality — propose a haircut with reasoning tied to expected misstatement history and control environment.
4. Clearly trivial threshold — propose and justify.
5. Normalisation — identify any items that should be normalised out of the benchmark (non-recurring, volatile) and show the calculation both ways.

Write in the firm's neutral memo voice: first person plural, no hedging fog, every number traceable to the data provided. Where the data provided is insufficient for a judgement, write "[TEAM INPUT REQUIRED: …]" rather than inventing.`,
    ["entity_name", "entity_context", "financial_data", "fs_users"],
    false,
    287
  ),
  p(
    "going-concern-indicator-sweep",
    "Going concern indicator sweep",
    "Risk & Planning",
    "Runs a disciplined sweep of going-concern indicators across financial, operating and other categories, then drafts the evaluation section for the file.",
    `Act as an experienced audit manager evaluating going concern under ISA 570 (Revised).

Entity facts: {{entity_facts}}
Draft financials summary: {{financials}}
Management's assessment (if any): {{mgmt_assessment}}

1. Sweep for events/conditions in three categories — financial (net liability positions, refinancing walls, covenant headroom, negative operating cash flow), operating (management departures, market loss, supply dependencies), other (regulatory, legal, uninsured exposure). For each indicator found: cite the specific fact, quantify where possible.
2. Assess aggregation: do individually minor indicators combine into material uncertainty?
3. Challenge management's assessment: list every assumption in it that an experienced sceptic would test, and the evidence that would test it.
4. Conclude on the spectrum: no significant doubt / events identified but no material uncertainty / material uncertainty / going concern basis inappropriate — with the reporting consequence of each and your recommended landing point.
5. Draft the file conclusion paragraph (neutral, evidence-referenced).

Never soften: if the facts given point to material uncertainty, say so plainly.`,
    ["entity_facts", "financials", "mgmt_assessment"],
    true,
    198
  ),
  p(
    "analytical-review-expectations",
    "Substantive analytics: expectation builder",
    "Risk & Planning",
    "Builds independent expectations for substantive analytical procedures — the discipline ISA 520 actually requires — before you look at the client's number.",
    `You are supporting a substantive analytical procedure under ISA 520. The critical discipline: form the expectation BEFORE examining the recorded amount.

Account/balance: {{account}}
Entity and driver data: {{driver_data}}
Prior-year figures and context: {{prior_year}}

1. Identify the plausible drivers of this balance and state the expected relationship (direction, elasticity) for each.
2. Build a quantified expectation from the driver data — show the arithmetic explicitly, state every assumption.
3. Define the threshold: what difference from expectation would require investigation, anchored to performance materiality of {{performance_materiality}}?
4. List the data reliability conditions: which inputs to your expectation come from audited/tested sources and which are unverified, and what that means for the evidence weight this procedure can carry.
5. Only now: compare to the recorded amount of {{recorded_amount}} (if provided). Quantify the difference, judge it against the threshold, and draft the investigation plan for any excess.

If driver data is too thin to build a precise expectation, say the procedure cannot carry substantive weight and recommend the alternative.`,
    ["account", "driver_data", "prior_year", "performance_materiality", "recorded_amount"],
    true,
    156
  ),

  // ——— Fraud & Forensics ———
  p(
    "fraud-brainstorm-facilitator",
    "Fraud brainstorming session facilitator (ISA 240)",
    "Fraud & Forensics",
    "Runs the engagement-team fraud discussion: entity-specific fraud scenarios by scheme type, management-override vectors, and the unpredictable procedures to spring.",
    `Facilitate the ISA 240 engagement team fraud discussion for:

Entity: {{entity_description}}
Known pressures/incentives: {{pressures}}
Key management and governance structure: {{management_structure}}

Produce:
1. Six entity-specific fraud scenarios — two fraudulent financial reporting, two misappropriation, two management override. For each: who, what motive, which accounts, what the paper trail would look like, and crucially what would make it INVISIBLE to standard procedures.
2. Revenue recognition: apply the ISA 240 presumption concretely — which revenue streams here are most manipulable and by what mechanism?
3. Journal entry risk profile: which JE characteristics (user, timing, account pairing, description patterns) would this entity's highest-risk entries carry? Output as testable criteria.
4. Three unpredictable procedures tailored to the scenarios — genuinely unpredictable (vary location, timing, population), not last year's surprise repeated.
5. The uncomfortable question: if management here wanted to deceive this specific audit team, what would they exploit about our approach?

Tone: candid, specific, no reassurance. This document sharpens scepticism; it does not manage anxiety.`,
    ["entity_description", "pressures", "management_structure"],
    false,
    334
  ),
  p(
    "synthetic-document-screen",
    "Synthetic document risk screen",
    "Fraud & Forensics",
    "Assesses which evidence in a procedure is vulnerable to AI fabrication and recommends provenance-based substitutes. Built for the post-generative evidence hierarchy.",
    `You are advising on evidence reliability in an environment where documents can be synthetically generated at negligible cost.

Procedure and evidence currently relied on: {{procedure_description}}
Risk level and materiality context: {{risk_context}}

1. For each evidence item, score fabrication cost for a motivated insider: TRIVIAL (single generated document), MODERATE (must stay consistent across 2–3 sources), EXPENSIVE (requires corrupting external systems or many mutually-reconciling records).
2. For every TRIVIAL item supporting a material assertion: propose a provenance-based substitute or supplement — auditor-obtained confirmation through a controlled channel, direct system extraction, cross-population consistency testing.
3. Design two consistency tests that exploit the fabricator's weakness: local perfection, global inconsistency (e.g. flawless invoices from a supplier absent from email archives, payment-timing patterns, or logistics records).
4. Note metadata/forensic checks worth their cost on the top-risk items, and their limits.
5. Summarise as a revised evidence plan table: assertion | old evidence | vulnerability | new/added evidence | residual risk.

Do not catastrophise: where inspection remains adequate (low risk, immaterial, corroborated), say so.`,
    ["procedure_description", "risk_context"],
    true,
    121
  ),
  p(
    "whistleblower-triage",
    "Whistleblower allegation triage memo",
    "Fraud & Forensics",
    "Structures the team's response when an allegation lands mid-audit: credibility factors, audit-response mapping, escalation and documentation trail.",
    `An allegation has been received during the audit. Structure the team's triage under ISA 240/250 discipline.

Allegation (as received, anonymised): {{allegation}}
Entity context: {{entity_context}}
Current audit phase: {{audit_phase}}

Produce a triage memo:
1. Restate the allegation as testable propositions — separate facts alleged from inferences.
2. Credibility assessment factors: specificity, internal consistency, corroborability, alleger's apparent knowledge — assessed without assuming good or bad faith.
3. Financial statement linkage: which assertions, balances or disclosures would be affected if true; materiality ceiling of the exposure.
4. Immediate audit response options, mapped to phase: procedures to add/modify now, evidence to preserve, and what NOT to do (tipping-off risks, scope-of-competence limits — we are auditors, not investigators).
5. Escalation matrix: engagement partner, EQR, legal, TCWG — who is informed when, per standards and firm policy placeholders.
6. Documentation trail: what this memo, and subsequent steps, must capture to survive hindsight review.

Mark clearly: [LEGAL COUNSEL REQUIRED] wherever the response depends on legal advice rather than audit judgement.`,
    ["allegation", "entity_context", "audit_phase"],
    true,
    88
  ),

  // ——— Fieldwork & Analytics ———
  p(
    "je-narrative-anomaly-screen",
    "Journal entry narrative anomaly screen",
    "Fieldwork & Analytics",
    "Scores journal-entry description fields against their account codings — the free-text signal channel deterministic JET rules can't read.",
    `You will screen journal entry narrative fields for anomalies. This SUPPLEMENTS deterministic JET rules; it does not replace them.

Journal entries (id, date, user, accounts, amount, description):
{{journal_data}}

For each entry, assess:
1. Narrative-coding coherence: does the description plausibly match the accounts posted? Flag mismatches (e.g. "consulting accrual" posted to revenue).
2. Language anomalies: template breaks, language switches mid-series, unusually vague descriptions on large amounts ("adjustment", "per mgmt"), copy-paste artefacts.
3. Authority hints: descriptions referencing instructions ("per JW", "as discussed") on entries posted by users whose profile suggests they shouldn't receive such instructions.

Output a table: entry id | flag (Y/N) | category | one-line reason. Then a summary: flag rate, dominant patterns, and the 5 entries most warranting human investigation, ranked, with reasoning.

Rules: you see only what is provided — never infer unposted context. An unflagged entry is "no narrative anomaly detected", NOT "entry is legitimate". State this limitation in the output footer verbatim.`,
    ["journal_data"],
    true,
    243
  ),
  p(
    "flagged-item-dossier",
    "Flagged-item investigation dossier",
    "Fieldwork & Analytics",
    "Assembles the full context briefing for a flagged transaction so the investigator starts informed: counter-entries, approver chain, history, analogues.",
    `Assemble an investigation dossier for a flagged item. You brief; the human decides.

Flagged item: {{flagged_item}}
Related data provided (ledger extracts, approvals, correspondence): {{related_data}}

Dossier structure:
1. THE ITEM — restated plainly: what moved, from where to where, when, booked by whom.
2. THE CHAIN — approver sequence and timing; anything unusual in the sequence (self-approval, after-the-fact approval, approval velocity).
3. THE COUNTERPARTS — the other side(s) of the entry and where the amount ultimately rests now.
4. THE HISTORY — prior similar entries in the data provided: frequency, amounts, seasonality; is this item routine or novel against that base?
5. OPEN THREADS — every question the data provided cannot answer, phrased as a specific request ("obtain approval workflow log for 14–16 March").
6. NEUTRAL SUMMARY — three sentences max, no conclusion about propriety.

Hard rules: distinguish DATA (quoted/traceable to input) from INFERENCE (yours) with [D]/[I] tags on every substantive claim. No opinion on whether the item is erroneous or fraudulent — that judgement is reserved to the engagement team.`,
    ["flagged_item", "related_data"],
    true,
    167
  ),
  p(
    "ipe-reliability-assessment",
    "IPE reliability assessment (reports used as evidence)",
    "Fieldwork & Analytics",
    "Works through completeness and accuracy of information produced by the entity — the perennial inspection finding — for any system report the team relies on.",
    `Assess the reliability of information produced by the entity (IPE) that the team intends to use as evidence.

Report/data relied upon: {{report_description}}
Source system and process: {{system_description}}
What the team uses it for: {{intended_use}}

Work through:
1. Evidence role: is this IPE supporting a control test, a substantive procedure, or risk assessment? State the reliability bar accordingly.
2. Completeness threats: how could records be missing from this report? For each threat, a testing response (reconciliation to GL/subledger, sequence checks, cutoff probes).
3. Accuracy threats: parameters (date ranges, filters, status codes), logic (formulas, joins), and manual touches (exports edited in Excel). For each: a specific test.
4. Parameter evidence: what proves the report was run with the stated parameters on the stated population? (Screenshot discipline, system logs, re-running in the auditor's presence.)
5. Conclusion template: draft the file paragraph concluding on C&A, with [EVIDENCE REF] placeholders the team fills.

If the report has been manually manipulated post-extraction, say plainly that the manipulated artefact cannot be relied on without testing the manipulation itself.`,
    ["report_description", "system_description", "intended_use"],
    false,
    276
  ),
  p(
    "estimate-challenger-isa540",
    "Accounting estimate challenger (ISA 540)",
    "Fieldwork & Analytics",
    "Builds the challenge file for a management estimate: assumption inventory, sensitivity ranking, contrary evidence, and management-bias indicators.",
    `Challenge a management accounting estimate under ISA 540 (Revised). Your stance: professional scepticism, not hostility — every challenge must be answerable by evidence.

Estimate: {{estimate_description}}
Management's method, assumptions and data: {{mgmt_method}}
Relevant environment facts: {{environment}}

1. ASSUMPTION INVENTORY — extract every assumption (explicit and buried); for each, tag: source (mgmt judgement / external data / historical), and sensitivity (does a plausible change move the estimate materially?).
2. THE BIG THREE — identify the three assumptions where estimation uncertainty concentrates; for each, state the plausible alternative range and the estimate's movement across it.
3. CONTRARY EVIDENCE SWEEP — from the environment facts, list everything that cuts AGAINST management's assumptions. If you find none, say "no contrary indicators in data provided" — never fabricate balance.
4. BIAS INDICATORS — direction of every judgement call vs. management's incentive; consistent directionality is the finding.
5. RETROSPECTIVE — what does the outcome of prior-period estimates (if provided) say about management's estimation track record?
6. CHALLENGE AGENDA — seven specific questions for the estimate owner, ordered to open informationally and close on the hardest point.`,
    ["estimate_description", "mgmt_method", "environment"],
    true,
    203
  ),

  // ——— CSRD & ESG ———
  p(
    "esrs-datapoint-extractor",
    "ESRS datapoint extraction with citations",
    "CSRD & ESG",
    "Pulls every statement relevant to a named ESRS disclosure requirement out of a policy pack — verbatim quotes with document and location, never summaries.",
    `Extract evidence relevant to a specific ESRS disclosure requirement from the documents provided.

Target disclosure requirement: {{esrs_requirement}} (e.g. ESRS E1-9)
Documents: {{documents}}

Rules of engagement — these make the output assurance-grade:
1. QUOTES ONLY. Return verbatim quotes with [document name, section/page]. Summaries and paraphrases are prohibited; if you cannot quote it, it is not evidence.
2. For each quote: one line stating which element of the disclosure requirement it addresses (metric, target, policy, action, methodology).
3. COVERAGE MAP — after extraction, table the disclosure requirement's elements vs. quotes found; empty rows are the deliverable, marked "NO EVIDENCE LOCATED IN PACK".
4. CONFLICTS — where two quotes are inconsistent with each other, pair them explicitly and flag.
5. NEAR-MISSES — statements that gesture at the requirement but lack the specifics (no baseline year, no scope boundary, no quantification); quote and state what is missing.

Close with the mandatory footer: "Extraction performed by AI on the documents listed; completeness not assured; every quote requires human trace to source before reliance."`,
    ["esrs_requirement", "documents"],
    false,
    189
  ),
  p(
    "sustainability-consistency-sweep",
    "Sustainability statement consistency sweep",
    "CSRD & ESG",
    "Hunts contradictions inside a sustainability statement and between it and the financial statements — the highest-yield single procedure in CSRD assurance.",
    `Perform a consistency sweep across the reporting package provided. Your only task is finding CONTRADICTIONS — not assessing quality, completeness or compliance.

Sustainability statement: {{sustainability_statement}}
Financial statements / annual report extracts: {{financial_statements}}

Hunt in four lanes:
1. INTERNAL-NARRATIVE: commitments vs. plans (net-zero pledge vs. transition capex table), figures repeated in different sections, scope boundaries that shift between chapters.
2. CROSS-DOCUMENT NUMERIC: headcount, revenue splits, segment definitions, capex, provisions — any figure appearing in both documents.
3. NARRATIVE-VS-ACCOUNTING: claimed actions with accounting shadows (a "major efficiency programme" with no restructuring provision; "divested carbon-intensive operations" with no disposal in the FS).
4. TEMPORAL: baseline years, target years, and progress claims that don't arithmetic against each other.

For every finding: quote both passages verbatim with locations, state the contradiction in one sentence, and rate: HARD (numbers/facts directly conflict) or SOFT (tension requiring explanation).

Output findings ranked hard-first. If a lane yields nothing, report "no contradictions detected in [lane]" — a clean lane is a result.`,
    ["sustainability_statement", "financial_statements"],
    true,
    145
  ),
  p(
    "double-materiality-workshop-prep",
    "Double materiality workshop preparation pack",
    "CSRD & ESG",
    "Structures the inputs for a double-materiality assessment — stakeholder map, IRO long-list, scoring scaffold — while leaving the judgement where it belongs.",
    `Prepare the input pack for a double materiality assessment workshop. You structure inputs; the assessment itself is a human judgement you must NOT pre-empt.

Entity: {{entity_description}}
Value chain sketch: {{value_chain}}
Sector: {{sector}}

Produce:
1. STAKEHOLDER MAP — affected stakeholders and users of the statement, by value-chain stage; note silent stakeholders (those affected but unrepresented in the entity's usual dialogue).
2. IRO LONG-LIST — candidate impacts, risks and opportunities per ESRS topic (E1–E5, S1–S4, G1), each tagged: value-chain location, time horizon, and whether impact-material, financially-material, or candidate-both. Sector-specific, not generic: a {{sector}} entity's S2 issues are not boilerplate.
3. SCORING SCAFFOLD — for the workshop: severity (scale/scope/irremediability) and likelihood dimensions per candidate, with entity-specific anchoring questions the facilitator can read out.
4. EVIDENCE GAPS — for each candidate-material IRO: what data the entity would need to substantiate scoring, and whether it plausibly exists.
5. CHALLENGE SHEET — five questions a sceptical assurance provider will later ask about this assessment's process; the workshop should answer them pre-emptively.

Do not output materiality conclusions. Where you are tempted to, write "[WORKSHOP JUDGEMENT]".`,
    ["entity_description", "value_chain", "sector"],
    true,
    97
  ),

  // ——— Financial Reporting ———
  p(
    "ifrs16-lease-screener",
    "IFRS 16 lease population screener",
    "Financial Reporting",
    "Screens contract populations for classification-sensitive features: embedded options, variable payments, renewal incentives, identified-asset questions.",
    `Screen the following agreements for IFRS 16 classification-sensitive features.

Contracts/extracts: {{contracts}}

For each agreement, extract and table:
1. Identified asset? (substitution rights that are substantive?)
2. Term analysis: non-cancellable period, extension/termination options, and the economic incentives bearing on "reasonably certain" (below-market renewals, leasehold improvements, relocation costs mentioned).
3. Payment structure: fixed, in-substance fixed (disguised as variable?), variable-linked-to-index vs. variable-linked-to-usage — flag the classification consequence of each.
4. Embedded elements: purchase options, residual value guarantees, non-lease components bundled in.
5. RED FLAGS — anything drafted to sit near a classification boundary.

Output: table (agreement | feature | verbatim clause quote | classification sensitivity | recommended follow-up), then a summary ranking the agreements by judgement-intensity.

Quote clauses verbatim — the team must trace every flag to contract language. If an extract is too partial to assess, mark "INSUFFICIENT EXTRACT" rather than guessing. Note explicitly: this is a screening aid; classification conclusions are the engagement team's.`,
    ["contracts"],
    true,
    134
  ),
  p(
    "disclosure-checklist-gap-scan",
    "Disclosure gap scan against requirements list",
    "Financial Reporting",
    "Compares a draft note against the disclosure requirements you paste in, and reports required items with no corresponding disclosure — the reverse of a tick-box review.",
    `Scan draft financial statement disclosures for gaps against the requirements provided.

Requirements (paste the relevant standard's disclosure paragraphs or your checklist section): {{requirements}}
Draft note(s): {{draft_notes}}

Method — run in this order:
1. REQUIREMENT DECOMPOSITION: split the pasted requirements into atomic disclosure items (one assertion each).
2. MATCHING: for each atomic item, find the passage in the draft that addresses it; quote it. Grade: MET / PARTIAL (element missing — say which) / ABSENT.
3. THE GAP REPORT: list ABSENT and PARTIAL items ranked by likely materiality to users, each with a one-line drafting suggestion.
4. SURPLUS SCAN: disclosure in the draft with no anchor in the requirements pasted — possibly required elsewhere, possibly clutter; list neutrally.
5. INTERNAL CONSISTENCY: figures in the note vs. any cross-references in the draft; flag mismatches.

Limits, stated in output: you assess only against the requirements pasted, not the full standard; applicability judgements (e.g. exemptions) belong to the team.`,
    ["requirements", "draft_notes"],
    false,
    221
  ),
  p(
    "accounting-policy-plain-rewrite",
    "Accounting policy note: plain-language rewrite",
    "Financial Reporting",
    "Rewrites boilerplate policy notes into entity-specific plain language that would survive an 'uninformative disclosure' regulator review.",
    `Rewrite the accounting policy note below to be entity-specific and informative — regulators increasingly cite boilerplate policy disclosure as a deficiency.

Current note: {{current_note}}
Entity specifics (products, revenue models, judgements actually made): {{entity_specifics}}

Rewrite rules:
1. Kill every sentence that merely restates the standard ("Revenue is recognised when control transfers…") unless anchored to THIS entity's transactions in the same sentence.
2. Surface the actual judgements: where the entity chose among acceptable treatments, name the choice and the rationale in one plain sentence.
3. Quantify anchors where the specifics allow (typical contract lengths, principal vs. agent conclusions per revenue stream, warranty periods).
4. Plain language: a credit analyst who is not an IFRS specialist should understand every sentence. Target reading level: professional but jargon-lite. Keep defined terms only where the standard's term is load-bearing.
5. Preserve technical accuracy absolutely — plain never means loose.

Output: the rewritten note, then a change log (what was cut and why, what was added and its source in the entity specifics), then any [TEAM INPUT REQUIRED] items where entity facts were missing.`,
    ["current_note", "entity_specifics"],
    true,
    76
  ),

  // ——— Tax ———
  p(
    "pillar-two-exposure-scan",
    "Pillar Two exposure quick-scan",
    "Tax",
    "First-pass scan of a group structure for GloBE exposure: covered status, safe-harbour eligibility, jurisdictional ETR pressure points, and data readiness.",
    `Perform a first-pass Pillar Two (GloBE) exposure scan. This is orientation, not advice — output feeds a specialist review.

Group structure and financials by jurisdiction: {{group_data}}
Consolidated revenue (4-year): {{revenue_history}}

1. COVERAGE: does the group meet the €750m threshold test on the data given? Show the year-by-year test.
2. JURISDICTION HEAT MAP: for each jurisdiction — headline rate, obvious ETR-depressors visible in the data (incentives, IP regimes, loss positions), and a LOW/WATCH/HIGH top-up-tax pressure rating with one-line reasoning.
3. SAFE HARBOURS: transitional CbCR safe-harbour eligibility per jurisdiction on the data given (de minimis, simplified ETR, routine profits) — show which test each jurisdiction passes or fails.
4. DATA READINESS: the GloBE data points the scan could NOT find in the input — the gap list IS the finding for most groups.
5. AUDIT ANGLE: where Pillar Two creates financial-statement risk now (current/deferred tax, disclosure of known exposure, IAS 12 exception application).

Footer: "Quick-scan on data provided; jurisdictional rules change frequently; specialist confirmation required before reliance." `,
    ["group_data", "revenue_history"],
    true,
    92
  ),
  p(
    "tax-provision-analytic",
    "Tax provision reasonableness analytic",
    "Tax",
    "Builds the effective-tax-rate bridge and challenges every reconciling item in the tax provision before the tax specialist review.",
    `Analyse the reasonableness of the income tax provision.

Pre-tax income and provision detail: {{provision_data}}
Applicable statutory rates: {{rates}}
Prior year ETR and reconciliation: {{prior_year}}

1. Build the ETR bridge: statutory rate → effective rate, itemising every reconciling item from the data (permanent differences, rate differentials, credits, prior-year true-ups, valuation allowance movements).
2. Challenge each reconciling item: is its size plausible against the underlying driver (e.g. does the non-deductible expense add-back trace to identifiable P&L lines)? Tag each: TRACED / PLAUSIBLE / UNEXPLAINED.
3. Year-over-year: which reconciling items moved materially vs. prior year, and does the data offer a reason?
4. Deferred tax sense-check: do movements in the largest temporary differences correspond to visible balance sheet movements?
5. The specialist handoff: list the UNEXPLAINED items and judgement-heavy positions (uncertain tax positions, valuation allowances) as specific questions for the tax specialist, ordered by monetary exposure.

Show all arithmetic. An unexplained reconciling item above {{threshold}} is a headline finding, not a footnote.`,
    ["provision_data", "rates", "prior_year", "threshold"],
    true,
    68
  ),

  // ——— Memos & Documentation ———
  p(
    "technical-memo-drafter",
    "Technical accounting memo drafter",
    "Memos & Documentation",
    "Drafts the issue-analysis-conclusion memo for a technical accounting question, with the counter-position argued honestly before the conclusion.",
    `Draft a technical accounting memo in the profession's standard structure.

Issue: {{issue}}
Relevant facts: {{facts}}
Applicable framework and provisions (paste the actual text where possible): {{guidance}}

Structure:
1. ISSUE — one paragraph, framed as the specific accounting question, not the business situation.
2. BACKGROUND — the facts that bear on the analysis; nothing decorative.
3. GUIDANCE — the provisions applied, quoted precisely from what was pasted. Where you reference guidance NOT pasted in, tag it [VERIFY CITATION] — you may misremember standards.
4. ANALYSIS — apply guidance to facts step by step. Then, mandatorily: THE COUNTER-POSITION — the strongest honest argument for the opposite conclusion, argued properly for a full paragraph, not straw-manned. Then why it fails (or, if it doesn't cleanly fail, say so and characterise the judgement).
5. CONCLUSION — the accounting answer, its financial statement effect, and disclosure consequences.
6. OPEN ITEMS — facts assumed, evidence to obtain, [TEAM INPUT REQUIRED] markers.

Voice: first-person plural, definite where the analysis is definite, honest about judgement where it isn't. No hedging fog ("it could be argued that…") outside the counter-position section.`,
    ["issue", "facts", "guidance"],
    false,
    358
  ),
  p(
    "review-note-responder",
    "Review note response drafter",
    "Memos & Documentation",
    "Turns a reviewer's clearance notes into disciplined responses: what was done, what changed in the file, or the professional pushback where the note misses.",
    `Draft responses to engagement file review notes.

Review notes: {{review_notes}}
Team's underlying position/context per point: {{context}}

For each note, produce a response in one of exactly three modes:
1. ACTIONED — what was done, what changed in the file, workpaper reference placeholder [WP-REF]. State the change concretely ("expanded sample by 12 items covering the Q4 population"), never "noted and addressed".
2. CLARIFIED — where the note stems from something the file already contains: point to it precisely and politely; then add the sentence that should be added to the file so the NEXT reviewer doesn't stumble on the same point (if a good reviewer missed it, the file was unclear).
3. PUSHBACK — where the note is wrong or disproportionate: the professional counter-argument, grounded in standards or the risk assessment, respectful and firm. Never absorb unnecessary work silently — and never dodge necessary work politely.

Choose the mode honestly per note. End with a summary table: note # | mode | file impact. Flag any note whose resolution requires partner-level judgement as [ESCALATE].`,
    ["review_notes", "context"],
    true,
    182
  ),
  p(
    "ai-procedures-memo",
    "AI-assisted procedures memo (ISA 230 discipline)",
    "Memos & Documentation",
    "The engagement-level record of AI use: tools, versions, prompts by reference, populations touched, human review evidenced. The memo inspectors now ask for.",
    `Draft the engagement's AI-assisted procedures memo — the single document recording AI use on this file with ISA 230 discipline.

AI uses on this engagement (tool, task, phase): {{ai_uses}}
Firm policy references: {{policy_refs}}

For each AI use, record:
1. TOOL & VERSION — product, underlying model where known, version/date. A tool whose version is unknown gets flagged: [VERSION UNKNOWN — GOVERNANCE GAP].
2. PROCEDURE ROLE — risk assessment / substantive / control testing / administrative; administrative uses may be summarised, evidential uses may not.
3. DATA SCOPE — the population the tool saw, extraction date, completeness anchor ("full FY25 GL, reconciled to TB at [WP-REF]").
4. PROMPT RETENTION — where the verbatim prompt is filed [WP-REF placeholder]; conversational uses summarised as a memo the way a discussion would be.
5. HUMAN REVIEW — who reviewed output, against what, and the disposition (accepted / modified / rejected) with the corroborating evidence reference.
6. RELIANCE STATEMENT — one sentence per use: what the audit conclusion does and does not rest on from this output.

Close with the completeness assertion for the engagement partner's sign-off, and a gap list of any AI use known but not documented above.`,
    ["ai_uses", "policy_refs"],
    false,
    294
  ),

  // ——— Client Communication ———
  p(
    "pbc-chaser-sequence",
    "PBC chaser sequence (firm, not shrill)",
    "Client Communication",
    "Generates the escalating request-list follow-up sequence: friendly nudge to partner-escalation, each referencing exactly what's outstanding and its deadline consequence.",
    `Draft a PBC follow-up email sequence for outstanding items.

Outstanding items (ref, description, original due date, days late): {{outstanding_items}}
Client contact and relationship context: {{client_context}}
Reporting deadline and dependency: {{deadline_context}}

Produce four escalating emails:
1. NUDGE (day 1 overdue) — warm, specific, assumes good faith; lists items with refs; offers to help unblock ("if the fixed asset register is easier as a system export, that works for us").
2. FIRM (day 5) — still courteous; introduces the consequence chain: which audit areas are blocked and what that does to the timeline; proposes a specific call slot.
3. ESCALATION (day 10) — addressed to the contact, cc line suggested to their supervisor; plain statement that the reporting deadline of {{deadline_context}} is now at risk; requests a committed date per item.
4. PARTNER-TO-CFO (day 15) — drafted for the engagement partner's voice: brief, grave, relationship-preserving; frames the fee/timeline consequence factually and requests intervention.

Every email: subject line, items table, single clear ask. Tone discipline: never sarcastic, never apologetic. The sequence should feel like a well-run process, not a mood.`,
    ["outstanding_items", "client_context", "deadline_context"],
    false,
    401
  ),
  p(
    "tcwg-communication-drafter",
    "TCWG communication drafter (ISA 260/265)",
    "Client Communication",
    "Drafts the those-charged-with-governance letter: scope, independence, findings, deficiencies — in language a non-executive can act on.",
    `Draft the communication to those charged with governance.

Engagement facts and findings: {{findings}}
Deficiencies identified (with evidence): {{deficiencies}}
Independence matters: {{independence}}

Requirements:
1. Structure: responsibilities recap (two sentences, not two pages) / scope and timing / significant findings / deficiencies / independence confirmation / appendices.
2. SIGNIFICANT FINDINGS section: qualitative aspects of accounting practices (name the aggressive-vs-conservative lean where findings support it), difficulties encountered, significant matters discussed with management, written representations requested.
3. DEFICIENCIES (ISA 265): for each — what the control should do, what we found, the possible effect (quantified where evidence allows), and a recommendation. Severity-tag: significant deficiency vs. other. The "possible effect" sentence must be concrete enough that an audit committee member can gauge whether to lose sleep.
4. Voice: for intelligent non-specialists. Every finding answers "so what?" in its first two sentences. No standard-paragraph padding the committee has read forty times.
5. Flag [PARTNER JUDGEMENT] on any characterisation that could strain the management relationship — the partner calibrates those sentences personally.`,
    ["findings", "deficiencies", "independence"],
    true,
    117
  ),
  p(
    "audit-kickoff-brief",
    "Client audit kick-off brief",
    "Client Communication",
    "The pre-fieldwork briefing pack for the client: what's changing this year, what we need, key dates, and what AI-assisted procedures mean for their data.",
    `Draft the client-facing audit kick-off brief.

Engagement scope and team: {{engagement_details}}
Changes this year (standards, scope, approach, tooling): {{changes}}
Key dates: {{key_dates}}

Sections:
1. THIS YEAR AT A GLANCE — scope, team contacts with roles, the three most important dates.
2. WHAT'S DIFFERENT — every change that touches the client, translated to consequences for THEM ("we will test journals across the full year population — expect our data request in week one, format specification attached").
3. AI-ASSISTED PROCEDURES DISCLOSURE — if the approach uses AI tooling: plain-language description of what tools touch their data, data handling and residency assurances, and what it does NOT mean (no reduction in professional judgement or partner responsibility). Honest, unpromotional.
4. YOUR PREPARATION CHECKLIST — the PBC headline items with owners and dates, formatted to forward internally.
5. WORKING AGREEMENTS — response-time expectations both directions, escalation contacts, the meeting cadence.

Tone: organised, warm, senior. The brief should make the client feel the audit is run by people who plan — because the brief IS the evidence of that.`,
    ["engagement_details", "changes", "key_dates"],
    true,
    73
  ),

  // ——— Standards Research ———
  p(
    "standard-applicability-analyser",
    "Standard applicability analyser",
    "Standards Research",
    "Works out which requirements of a pasted standard actually apply to a specific situation — with the conditions-tree made explicit.",
    `Analyse which requirements of the pasted standard text apply to the situation described.

Standard text (paste the actual paragraphs): {{standard_text}}
Situation: {{situation}}

Method:
1. CONDITIONS TREE — decompose the pasted text into its conditional structure: which requirements are unconditional, which trigger on circumstances, which are scoped out by exemptions. Present as an indented tree with paragraph references.
2. FACT MAPPING — walk the situation through the tree node by node: condition met / not met / INDETERMINATE on facts given. Quote the standard's words at each decision point.
3. RESULT — the requirements that apply, ranked: unambiguous / conditional-on-open-facts / judgement-dependent.
4. OPEN FACTS — for every INDETERMINATE node: the specific factual question that resolves it, phrased as something the team can actually go ask.
5. TRAP CHECK — requirements that practitioners commonly miss in this area IF they are visible in the pasted text (cross-references, transitional provisions, disclosure hooks in measurement paragraphs).

Hard rule: analyse ONLY the pasted text. Where the answer depends on paragraphs not pasted, output [OUTSIDE PASTED SCOPE: paragraph reference if known] rather than reciting from memory — misremembered standards are worse than none.`,
    ["standard_text", "situation"],
    false,
    246
  ),
  p(
    "isa-delta-briefing",
    "Revised standard delta briefing",
    "Standards Research",
    "Compares old and new versions of a standard you paste in and produces the team briefing: what actually changed, what it means for procedures, what to update in templates.",
    `Produce a delta briefing between two versions of a standard or firm methodology text.

Previous version text: {{old_text}}
Revised version text: {{new_text}}
Audience: {{audience}} (e.g. "audit seniors", "EQR partners")

1. SUBSTANTIVE DELTAS — changes that alter what practitioners must DO: new requirements, removed requirements, threshold/scope changes, strengthened verbs ("should" → "shall"). For each: old text quote, new text quote, one-sentence practical consequence.
2. COSMETIC DELTAS — restructuring and re-wording without practical effect: list briefly, so readers stop worrying about them.
3. THE HIT LIST — for the stated audience: templates, checklists, and work programmes that need updating, inferred from the substantive deltas.
4. TRANSITION — effective dates and transitional provisions if present in the pasted texts; if absent, flag as [CONFIRM EFFECTIVE DATE].
5. THE ONE-PARAGRAPH VERSION — if the audience reads nothing else, this paragraph.

Rule: every claimed delta must be demonstrated by paired quotes. No delta without evidence; no reliance on your memory of either standard.`,
    ["old_text", "new_text", "audience"],
    true,
    159
  ),
  p(
    "inspection-finding-decoder",
    "Inspection finding decoder & remediation planner",
    "Standards Research",
    "Translates a regulator's inspection finding into root causes and a remediation plan that addresses the cause rather than the symptom.",
    `Decode an inspection finding and draft the remediation plan.

Finding text (as issued): {{finding_text}}
Engagement/firm context: {{context}}

1. TRANSLATION — what the finding actually alleges, in plain terms: the requirement invoked, the gap asserted, and the evidence the inspector apparently weighed.
2. ROOT-CAUSE CANDIDATES — at least three candidate causes at different depths: execution (person didn't do X), design (methodology never required X clearly), environment (budget/timeline/culture made X unlikely). Inspectors increasingly grade remediation on root-cause honesty.
3. SYMPTOM-VS-CAUSE TEST — for each candidate remediation action, ask: would this have prevented the finding, or only its detection? Discard detection-only actions or label them as such.
4. REMEDIATION PLAN — actions with owner-role, artefact produced, and how effectiveness will be MEASURED (not "reinforce awareness" — measurable change).
5. READ-ACROSS — where else in the practice the same root cause plausibly operates; the read-across paragraph is what distinguishes a mature response.
6. RESPONSE DRAFT — the formal reply to the regulator: accepts what the evidence supports, contests precisely where contestable, commits only to what the plan can deliver.`,
    ["finding_text", "context"],
    true,
    104
  ),
  p(
    "ai-act-classification-memo",
    "EU AI Act system classification memo",
    "Standards Research",
    "Classifies a specific AI system under the Act — prohibited/high-risk/limited/minimal — with the Annex III walk-through and the deployer-obligation consequences.",
    `Draft an EU AI Act classification memo for a specific AI system. Enforcement context: obligations apply from 2 August 2026.

System description (what it does, who uses it, what decisions it feeds): {{system_description}}
Organisation's role (developer, procurer, user; any fine-tuning or substantial modification): {{org_role}}

1. ROLE DETERMINATION — provider, deployer, importer or distributor under Art. 3, on the facts given; flag if fine-tuning/modification could trigger provider obligations via Art. 25.
2. PROHIBITION SCREEN — Art. 5 practices: walk each briefly; conclude clearly.
3. HIGH-RISK WALK — Annex III category by category: for each plausibly-relevant category, quote the category language, apply the facts, conclude IN/OUT/BORDERLINE with reasoning. Borderline calls get both readings argued.
4. TRANSPARENCY LAYER — Art. 50 duties that apply regardless of risk class (AI-generated content disclosure, chatbot identification).
5. OBLIGATIONS TABLE — given the classification: the concrete duties (Art. 26 deployer duties: oversight, input relevance, monitoring, logs) with an owner-role suggestion per duty.
6. REVIEW TRIGGERS — the use-changes that would reopen this classification ("if the tool's output begins informing employment decisions, re-classify immediately").

Footer: [LEGAL REVIEW REQUIRED — this memo structures the analysis; it is not legal advice.]`,
    ["system_description", "org_role"],
    false,
    312
  ),
  p(
    "model-output-challenge-protocol",
    "Model output challenge protocol",
    "Standards Research",
    "The structured second-look for any material AI output: independent expectation, variance hunt, provenance check, acceptance record. Scepticism as a procedure.",
    `Run a structured challenge of an AI output before it influences an audit conclusion. You are the red team; the output under challenge is below.

Output under challenge: {{ai_output}}
The prompt/task that produced it: {{original_task}}
Source data it was given: {{source_data}}

Protocol:
1. INDEPENDENT EXPECTATION — before engaging with the output's content: from the source data and task alone, what SHOULD the answer roughly look like (direction, magnitude, key items that must appear)?
2. VARIANCE HUNT — compare expectation to output: what appears that shouldn't, what's missing that should appear, what's surprisingly convenient?
3. CLAIM AUDIT — sample the output's five most decision-relevant claims; trace each to the source data. Tag: VERIFIED (quote the source) / UNVERIFIABLE FROM DATA GIVEN / CONTRADICTED (quote the contradiction).
4. FAILURE-MODE SCREEN — check for the classic patterns: fabricated specifics (references, numbers with no source), scope silently narrowed, instructions followed too literally, population sampled when it claimed completeness.
5. DISPOSITION — recommend: ACCEPT / ACCEPT WITH CORRECTIONS (listed) / REJECT AND REDO (with the improved prompt).
6. RECORD — three-line acceptance record for the file: challenged by, method, disposition.

Rule: if fewer than four of the five sampled claims verify, the disposition cannot be ACCEPT.`,
    ["ai_output", "original_task", "source_data"],
    true,
    228
  ),
  p(
    "board-ai-briefing",
    "Board briefing: AI in this year's audit",
    "Client Communication",
    "A one-page briefing for a client's audit committee on how AI was used in their audit — honest, specific, and reassuring for the right reasons.",
    `Draft a one-page audit committee briefing on AI use in the audit.

AI uses on this engagement: {{ai_uses}}
Firm safeguards (policy, review, data handling): {{safeguards}}

Requirements:
1. WHAT WE USED AND WHERE — each use in one plain sentence pairing the task with the safeguard ("We used AI-assisted screening across your full journal population — 100% coverage rather than a sample — with every flagged item investigated by a senior team member").
2. WHAT IT MEANS FOR YOU — the genuine benefits, stated without inflation: coverage, consistency, earlier issue identification. No claims about "better judgement" — judgement is ours, not the tool's.
3. WHAT DID NOT CHANGE — the paragraph that matters most: partner responsibility, professional scepticism, your data's confidentiality (state residency and no-training commitments plainly), and the fact that no conclusion rests on unreviewed machine output.
4. YOUR QUESTIONS ANSWERED — pre-empt the three questions committees actually ask: Is our data training someone's model? What happens when the AI is wrong? Are you cheaper now? Answer the third one honestly.
5. Length discipline: one page. If it doesn't fit, it isn't a briefing.

Tone: confident, concrete, unpromotional. The committee should conclude the firm is thoughtful — because the document demonstrates thought, not because it claims it.`,
    ["ai_uses", "safeguards"],
    true,
    143
  ),
];
