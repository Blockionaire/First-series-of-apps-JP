import type { SeedArticle } from "./types";

export const articles1: SeedArticle[] = [
  {
    slug: "eu-ai-act-reaches-the-audit-file",
    title: "The EU AI Act reaches the audit file",
    dek: "On 2 August 2026 the Act's obligations for general-purpose and high-risk AI become enforceable. For audit firms, the exposure is not hypothetical — it is already sitting in your methodology, your tooling, and your clients' control environments.",
    category: "Regulation",
    tags: ["EU AI Act", "enforcement", "deployer obligations", "risk"],
    author: "Marieke van Dijk",
    authorRole: "Editor, STAI",
    publishedAt: "2026-06-29",
    readingMin: 9,
    featured: 1,
    urgency: 3,
    premium: false,
    body: `The countdown that matters to this profession is not the one on vendor marketing sites. It is Article 113's schedule: on **2 August 2026**, the EU AI Act's obligations for general-purpose AI models with systemic risk and for most high-risk systems become enforceable, with national market-surveillance authorities empowered to act and fines that scale to 7% of global turnover for prohibited practices and 3% for most other breaches.

Audit firms have spent two years treating the Act as a client advisory opportunity. That was the comfortable reading. The uncomfortable one: audit firms are themselves **deployers** under Article 3(4) the moment a manager runs an LLM over journal-entry populations, and they inherit deployer obligations under Article 26 — human oversight, input-data relevance, monitoring, and log retention — for any high-risk use.

## Where the Act actually touches the audit

Three contact points deserve partner-level attention now, not in Q4.

**1. Your own tooling.** Most audit uses of AI — summarising PBC documents, drafting memos, generating test scripts — are not "high-risk" under Annex III. But two things pull firm tooling into scope faster than expected. First, employment-related uses: any AI used in staff evaluation or scheduling decisions sits squarely in Annex III(4). Second, creditworthiness-adjacent analytics offered to financial-sector clients can drift into Annex III(5)(b). The classification memo is now a standing document every firm needs, reviewed each time a tool's use widens.

**2. Your clients' control environments.** From FY2026 audits onward, a client running high-risk AI in credit decisioning, insurance pricing, or HR has a new compliance layer with direct financial-statement consequences: provisions for remediation, contingent liabilities for penalties, and going-concern colour where a core model faces a corrective order. ISA 250 (laws and regulations) is the hook; the Act is the regulation. Audit programmes that don't ask "which of your models are Annex III systems, and where is your conformity documentation?" are already incomplete.

**3. Transparency duties you can't delegate.** Article 50 requires that AI-generated content presented to third parties be identifiable as such in certain contexts. Firms that let AI draft client-facing reports without disclosure policies are accumulating a quiet inventory of exposure — less because regulators will chase individual memos, and more because the first litigation discovery request will ask for exactly this.

## The enforcement asymmetry

National authorities will not descend on mid-tier firms in August. Enforcement will start with model providers and conspicuous high-risk deployers. But professional regulators move on a different axis: the AFM, BaFin and FRC have all signalled that **firm-level AI governance will be read through ISQM 1**. A quality-management system that cannot inventory the firm's AI use, name an accountable owner, and evidence oversight will be a finding — Act or no Act.

> The deadline is not the moment risk begins. It is the moment "we were still assessing it" stops being an acceptable answer.

## What good looks like by 2 August

The firms in decent shape share four artefacts, none of which took more than a quarter to build:

- A **use-register**: every AI tool in the practice, its use cases, its classification under the Act, and the partner who owns it.
- A **deployer-controls memo** mapping Article 26 duties to existing ISQM 1 components, so oversight lives inside quality management rather than beside it.
- **Engagement-level prompts and outputs retained** like any other working paper — because they are working papers.
- A **client-impact screen** added to acceptance and continuance: does this entity deploy Annex III systems material to the financial statements?

None of this is transformative. All of it is auditable. That is the point: the Act rewards firms that treat AI the way they already treat any other source of engagement risk — with an inventory, an owner, and evidence. The ones scrambling in July 2026 are not short of technology. They are short of documentation.`,
  },
  {
    slug: "isa-240-synthetic-evidence",
    title: "ISA 240 in the age of synthetic evidence",
    dek: "When any invoice, contract or bank confirmation can be generated in seconds, the fraud triangle gets a fourth side. What generative documents do to the auditor's evidence hierarchy — and the procedures that still hold.",
    category: "Analysis",
    tags: ["ISA 240", "fraud", "evidence", "deepfakes"],
    author: "Jonas Keller",
    authorRole: "Contributing Analyst",
    publishedAt: "2026-06-22",
    readingMin: 8,
    featured: 2,
    urgency: 3,
    premium: false,
    body: `The audit profession's evidence hierarchy was built on a quiet assumption: forging documents is costly. Not impossible — every fraud file has its doctored invoice — but costly enough that fabrication left traces. Inconsistent fonts. Arithmetic that didn't foot. A supplier that didn't exist on any register.

Generative AI removes the cost. A plausible invoice, complete with a real supplier's letterhead, VAT number and consistent line-item arithmetic, is now a thirty-second exercise. So is a full email thread negotiating it, a delivery note, and a photograph of goods on a loading dock that never existed. The unit economics of fabrication have collapsed, and ISA 240's presumption of fraud risk in revenue recognition now lives in a world where the *supporting evidence itself* is the cheapest part of the scheme.

## What actually changes

It is worth being precise, because panic is not analysis. Three shifts matter:

**Document inspection loses seniority.** In the classic hierarchy, externally generated documents outranked internal ones. That ordering assumed external documents were hard to counterfeit. Inspection of a PDF invoice — external or not — should now be treated as weak evidence when the item is material or the risk is elevated. The document proves someone produced a document. Nothing more.

**Provenance outranks appearance.** The question shifts from "does this document look right?" to "how did it arrive?" Evidence obtained *directly by the auditor from the source* — bank confirmations through controlled platforms, direct API access to a supplier portal, data pulled by the audit team from the client's production system rather than exported by the client — carries the weight that inspection used to.

**Volume becomes a defence.** A fabricated invoice is cheap; a fabricated *population* that stays internally consistent across ledgers, VAT filings, bank flows and counterparty records is still expensive. Full-population journal testing, three-way matching at scale, and cross-source reconciliation raise the cost of fraud back to where the hierarchy assumed it was. This is the strongest argument yet that analytics is not an efficiency play but an assurance play.

## Procedures that hold

- **Confirmation over inspection**, and confirmation through channels the client cannot mediate. If the client forwards the confirmation, it is not a confirmation.
- **Metadata and file forensics** on high-risk documents: creation timestamps, software fingerprints, PDF object structure. Imperfect — sophisticated fraudsters clean metadata — but cheap and occasionally decisive.
- **Cross-population consistency tests.** Fabricated evidence tends to be locally perfect and globally inconsistent. The supplier whose invoices are flawless but who never appears in the client's email archive, badge logs or payment-timing patterns is the modern red flag.
- **Unpredictability, taken seriously.** ISA 240 has always required an element of unpredictability. Rotating which population gets full-forensic treatment is now among the highest-yield uses of the requirement.

## The scepticism point

The deeper risk is not that auditors will be fooled by synthetic documents. It is that auditors will *know* documents are unreliable and keep inspecting them anyway, because the methodology, the budget and the file structure expect it. Professional scepticism that does not reprice evidence is theatre.

The firms adapting fastest have made one structural change: evidence-type risk is now assessed alongside assertion risk during planning. For each significant class of transactions, the file answers a new question — *if management wanted to deceive us here, what would fabrication cost them?* Where the answer is "an afternoon with a chatbot," the response is not deeper inspection. It is different evidence.`,
  },
  {
    slug: "csrd-assurance-ai-toolkit",
    title: "What CSRD assurance teams actually need from AI",
    dek: "Sustainability assurance is drowning in unstructured evidence — policies, meeting minutes, supplier declarations, emissions workings. A field guide to the AI workflows that survive contact with a real ESRS engagement.",
    category: "Practice",
    tags: ["CSRD", "ESRS", "sustainability assurance", "limited assurance"],
    author: "Sofia Lindqvist",
    authorRole: "Senior Correspondent",
    publishedAt: "2026-06-15",
    readingMin: 7,
    featured: 3,
    urgency: 2,
    premium: false,
    body: `The first full CSRD assurance cycles have settled one argument: the binding constraint in sustainability assurance is not carbon accounting expertise. It is **reading capacity**. A single ESRS engagement can involve four hundred policy documents, board minutes spread over three governance layers, thousands of supplier self-declarations, and emissions workings that mix spreadsheets with utility PDFs in five languages. Limited assurance was supposed to be lighter than reasonable assurance; nobody told the evidence base.

This is the most natural large-language-model territory in the entire profession, and also the place where sloppy deployment gets found first, because ESRS datapoints are specific and checkable.

## The three workflows that work

**1. Datapoint extraction with mandatory citation.** The core CSRD task is mapping claims in the sustainability statement to ESRS disclosure requirements and then to evidence. LLMs are strong at "find every statement in this policy pack relevant to ESRS E1-9 and quote it verbatim with document and page." The discipline that makes it assurance-grade: the model must return **quotes, not summaries**, and a human traces each quote before it enters the file. Extraction without citation is note-taking; extraction with citation is a reviewable procedure.

**2. Consistency sweeps.** Sustainability statements fail most often on internal consistency — a net-zero commitment in the strategy section that doesn't match the transition-plan capex table, a headcount figure that disagrees with the annual report thirty pages away. Feeding the full statement plus the financial statements to a long-context model with the single instruction to *find contradictions* reliably surfaces issues that sampling misses. Teams report this one procedure pays for the entire tooling budget.

**3. Supplier-declaration triage.** Thousands of near-identical declarations are a classification problem: complete/incomplete, consistent/anomalous, standard-wording/deviated. Using a model to cluster and flag — with every flagged item reviewed by a person — converts an unsampleable population into a risk-ranked worklist. This is the limited-assurance mindset executed properly: plausibility at population scale.

## The two that don't

**Materiality assessment.** Double materiality is a judgement anchored in stakeholder dialogue and business-model understanding. Models can structure the workshop inputs; letting them *score* impact materiality produces confident nonsense wearing a matrix. Every team that tried it has walked it back.

**Emissions recalculation.** Scope 3 workings live in spreadsheets whose logic is positional, not semantic. LLMs misread spreadsheet structure often enough that recalculation belongs to deterministic tools — the model's role is reading the *methodology description* and flagging where the described method and the spreadsheet diverge.

## The file problem

One unresolved tension: limited-assurance files are thin by design, and AI procedures generate voluminous intermediate output. The emerging good practice is a single **AI-procedures memo** per engagement — tools used, populations touched, prompts retained by reference, human review recorded — rather than filing every model interaction. Regulators have not blessed this format. They have also not offered a better one, and inspection season will force the issue within two cycles.

CSRD assurance is where the profession's AI habits are being formed under the least legacy constraint. The teams treating it as a laboratory — citation discipline, population-scale consistency checks, human sign-off at every gate — are building the methodology the financial-statement audit will import next.`,
  },
  {
    slug: "copilot-audit-room-90-day-field-report",
    title: "Copilot in the audit room: a 90-day field report",
    dek: "We followed three mid-tier European firms through their first full quarter of Microsoft 365 Copilot deployment on live engagements. What stuck, what stalled, and the number that surprised everyone.",
    category: "Practice",
    tags: ["Copilot", "adoption", "mid-tier", "field report"],
    author: "Tom Verhagen",
    authorRole: "Practice Editor",
    publishedAt: "2026-06-08",
    readingMin: 8,
    featured: 4,
    urgency: 2,
    premium: false,
    body: `Between March and June we tracked Copilot deployments at three mid-tier firms — Dutch, German and Danish, between 180 and 900 audit staff — with access to their usage telemetry and permission to interview teams mid-engagement. The findings are more textured than either the vendor pitch or the sceptic's shrug.

## The number first

Across the three firms, **weekly active use settled at 34–41%** of licensed audit staff after ninety days — but among staff who received *scenario-based training* (not feature tours), it settled at **78%**. No other variable — seniority, engagement size, industry — came close to explaining adoption. The gap between "here is what Copilot does" and "here is how you draft a going-concern memo section with it" is the entire game. Firms buying licences without building scenarios are renting shelfware.

## Where the hours actually went

The time savings concentrated in four places, none of them the headline use cases:

- **Meeting synthesis.** Teams stopped assigning a junior to minute internal planning meetings. Recorded, transcribed, summarised, filed. Modest per meeting; enormous across a season.
- **PBC chase drafting.** The unglamorous email loop — "following up on items 3, 7 and 12 from our request list" — went from fifteen minutes to one. Client-response latency dropped because the chasers went out same-day.
- **First-draft memos from templates.** Not free-form drafting: teams that fed Copilot the firm's memo template plus the engagement facts got usable first drafts. Teams that prompted cold got generic essays they rewrote from scratch.
- **Excel explanation, not Excel automation.** Juniors used Copilot to *understand* inherited workbooks ("explain what this SUMIFS chain does") far more than to build new ones. Nobody predicted this; every training lead has now added it.

## What stalled

**Direct documentation drafting into the audit file** stalled at all three firms, for the same reason: review anxiety. Managers reported spending as long verifying AI-drafted workpaper narratives as writing them, because errors in an audit file are career events. Where AI drafting worked, it worked *outside* the file — briefing notes, client communications, internal summaries — with humans transcribing conclusions in.

**Data analytics stayed in specialist hands.** The promise that Copilot would let any senior interrogate the GL in natural language met the reality of data quality. Two firms concluded the bottleneck was never query syntax — it was extract hygiene, and Copilot doesn't fix your ETL.

## The governance dividend

An unexpected second-order effect: deploying Copilot forced all three firms to finally sort out **information architecture** — access rights, retention, the sprawl of engagement folders — because Copilot surfaces whatever the user can technically reach. One national quality lead called it "the audit of our own permissions we'd deferred for a decade." Two firms found client data accessible to staff who should never have had it. The remediation was worth the licence cost alone.

## What we'd tell a managing partner

Ninety days is enough to see the shape: Copilot is not an audit tool, it is an *office* tool that audit teams sit inside. It compresses the connective tissue of an engagement — meetings, chasing, drafting, understanding — by something like 4–6 hours per person per week when adoption is real. It does not touch the judgment core, and firms that market it as if it does are writing cheques their files can't cash. Train on scenarios, fix your permissions first, and measure weekly active use — not licences — or you are measuring nothing.`,
  },
  {
    slug: "prompt-is-the-new-working-paper",
    title: "The prompt is the new working paper",
    dek: "If an AI output influenced an audit conclusion, the prompt that produced it is audit documentation under ISA 230 — reperformable, reviewable, retained. Most firms haven't noticed yet. Inspectors have.",
    category: "Analysis",
    tags: ["ISA 230", "documentation", "prompts", "inspection"],
    author: "Marieke van Dijk",
    authorRole: "Editor, STAI",
    publishedAt: "2026-05-27",
    readingMin: 7,
    featured: 0,
    urgency: 3,
    premium: false,
    body: `ISA 230 asks for documentation sufficient for an experienced auditor, with no previous connection to the engagement, to understand the procedures performed, the evidence obtained, and the conclusions reached. For fifty years the profession has known exactly what that means for a spreadsheet: keep the workings.

Now consider a manager who pastes a lease population into a model with the instruction *"identify agreements with embedded purchase options or renewal incentives that could affect classification under IFRS 16"* and receives a list of seven contracts, which she then tests. What is the working paper? Not just the seven contracts. The **prompt is the procedure design**, the model and its version are the **tool configuration**, and the response is **evidence generated by the procedure**. An experienced auditor cannot understand what was done — cannot assess whether the *other* ninety-three contracts were adequately screened — without the prompt.

## The inspection vanguard

This is not theoretical. Inspection teams in two jurisdictions have begun asking, on engagements where firms disclosed AI use, for precisely this chain: what was asked, of which system, on what data, and how the output was corroborated. One firm's response — that prompts were "ephemeral, like a conversation with a colleague" — reportedly did not land well. A conversation with a colleague who screened your lease population would appear in the file too, as a memo of work performed.

The "colleague" framing fails on a second axis: the colleague is consistent and can be interviewed. The model is stochastic and updates monthly. Reperformance — the quiet backbone of ISA 230 — is only possible if the prompt, the data scope, and the model version are captured. Without them, the procedure is unrepeatable by construction.

## What retention actually requires

The good news: the discipline is light once it is habitual. The emerging standard among quality-forward firms:

1. **Prompts used in substantive or risk-assessment procedures are filed** — verbatim, with the model name and date. A screenshot suffices; a text file is better.
2. **Data scope is stated.** "Full FY25 journal population, extracted 14-Jan" — because the output's meaning depends entirely on what the model saw.
3. **Corroboration is documented separately.** The model's output is never the evidence; it is the pointer to evidence. The file shows what a human did with the pointer.
4. **Conversational use is memo-ised.** Exploratory chats that shaped a risk assessment get summarised the way a brainstorming meeting does — ISA 315 already has the furniture for this.

## The deeper shift

Something larger hides in this. Prompt-writing is procedure design, and procedure design has always been the province of seniors — reviewed, standardised, methodology-controlled. Firms are discovering that their staff have been *designing procedures freehand*, in production, unreviewed, hundreds of times a week.

The mature response is not prohibition. It is the same move the profession made with analytics a decade ago: **libraries**. Vetted prompts, versioned centrally, parameterised for the engagement, with the methodology team owning the canon. The prompt library stops being a productivity convenience and becomes what it was always going to be — a component of the firm's system of quality management. Firms that grasp this are not writing better prompts. They are writing fewer, better-reviewed ones, and filing every single one that touches a conclusion.`,
  },
  {
    slug: "compliance-stack-converges-nis2-dora-aiact",
    title: "NIS2, DORA, AI Act: the compliance stack converges",
    dek: "Three regimes, one client conversation. Why the entities you audit are about to rationalise their control frameworks — and why the audit plan should get there first.",
    category: "Regulation",
    tags: ["NIS2", "DORA", "EU AI Act", "ICT risk", "controls"],
    author: "Jonas Keller",
    authorRole: "Contributing Analyst",
    publishedAt: "2026-05-19",
    readingMin: 6,
    featured: 0,
    urgency: 2,
    premium: false,
    body: `European entities of any scale now sit under three overlapping technology-risk regimes: NIS2 for cyber resilience across essential and important entities, DORA for financial-sector ICT risk, and from August 2026 the AI Act for algorithmic systems. Each arrived with its own vocabulary, its own registers, its own incident-reporting clocks. Compliance teams are exhausted, and boards are asking the obvious question: *why are we running three frameworks for one technology estate?*

The convergence is already happening client-side. It should be happening in the audit plan.

## The common skeleton

Strip the branding and the three regimes share a skeleton: **inventory** (know your systems), **accountable ownership** (a named function with board access), **third-party risk** (your vendors are your risk), **incident response** (detect, classify, report on a clock), and **evidence of testing**. An entity that builds these once, as enterprise capabilities, satisfies most of all three. An entity that builds them three times builds them badly three times.

For the auditor, this convergence is a gift wearing a compliance costume. The same skeleton is the scaffolding of ITGC work: the inventory maps to the system-understanding requirements of ISA 315; third-party risk maps to service-organisation considerations; incident logs are a fraud-risk and going-concern input. A client's DORA register of ICT third parties is, read correctly, a pre-built map of the audit's service-organisation scope.

## Where the AI Act adds genuinely new surface

Two elements don't exist in the older regimes. First, the **fundamental-rights layer**: high-risk classification triggers obligations (human oversight, bias monitoring) whose failure modes are legal and reputational rather than operational. Contingent-liability antennae should be up. Second, **provider-versus-deployer asymmetry**: an entity fine-tuning a foundation model for credit scoring may cross from deployer to provider under Article 25, inheriting conformity-assessment duties it has not budgeted for. Finance teams routinely misclassify this; the provision, when it lands, is material.

## The audit-plan move

The efficient play for FY2026 planning: **one technology-risk understanding, three regulatory overlays.** Teams that interrogate the client's estate once — systems, vendors, models, incidents — and then map findings to each regime's requirements are cutting interview hours by a third and, more importantly, spotting the gaps *between* regimes where exposures hide: the AI vendor that is nobody's "critical ICT third party" but everybody's single point of failure.

The firms selling this as an advisory bundle have noticed. The audit side should not arrive at the client's Q3 board meeting to discover the control environment was redesigned in response to three regulators while the audit plan still describes last year's.`,
  },
  {
    slug: "vendor-due-diligence-ai-tools-12-questions",
    title: "Vendor due diligence for AI tools: the twelve questions",
    dek: "Every firm is being pitched audit-AI tooling weekly. A procurement instrument for separating engineered products from wrapped demos — with the answers that should end the meeting.",
    category: "Tools",
    tags: ["procurement", "vendor risk", "tooling", "due diligence"],
    author: "Tom Verhagen",
    authorRole: "Practice Editor",
    publishedAt: "2026-05-12",
    readingMin: 7,
    featured: 0,
    urgency: 2,
    premium: true,
    body: `The audit-tech vendor market has tripled in eighteen months, and the demos are indistinguishable: every product summarises documents, flags anomalies, and drafts memos in a tasteful interface. Due diligence has to reach beneath the demo, because the differences that matter — data handling, model governance, failure behaviour — are precisely the ones a demo conceals.

Twelve questions, with the answers that should end the meeting.

## Data and confidentiality

**1. Where does client data physically go, and where is it processed?** Acceptable: named EU regions, no cross-border processing, contractual data-residency commitments. Meeting-ender: "We use leading cloud providers" without a region commitment.

**2. Is our data used to train or improve any model?** The only acceptable answer is an unqualified *no*, in the contract, covering "improvement," "fine-tuning," "evaluation" and "analytics" — vendors hide training in soft synonyms.

**3. What is the retention and deletion story, and can you evidence deletion?** Look for: configurable retention, deletion certificates, and an honest answer about backups. "Deleted immediately" with no backup caveat means they haven't thought about it.

**4. Can the tool run with zero data leaving our tenant?** For firms with intelligence-sensitive clients, private-deployment or in-tenant options are the difference between usable and not. Many vendors now offer this; the ones that can't should say so plainly.

## Model governance

**5. Which underlying models, and what happens when they change?** You are buying a supply chain. The vendor should name their model providers, pin versions, test before upgrading, and notify you of model changes — because a silent model swap invalidates your own tool-risk assessment.

**6. What are the measured failure rates on tasks like ours?** Engineered products have evaluation suites and will show you numbers, including bad ones. Wrapped demos have testimonials.

**7. How does the product behave when it doesn't know?** Ask for a live demonstration on an ambiguous document. You want visible uncertainty — flags, confidence tiers, refusal — not fluent guessing.

**8. What logging exists for our reperformance needs?** The tool must retain the prompt/input/output chain per engagement, exportable, because your file needs it under ISA 230. A vendor who hasn't heard this question before hasn't sold to serious firms.

## Commercial and continuity

**9. What is the exit story?** Data export formats, notice periods, and what dies when the subscription does. Audit files outlive vendor relationships by a decade.

**10. Who else in our tier uses this in production — not pilot?** Pilots are free marketing; production references from firms your size, under your regulator, are the only reference that counts.

**11. What is your incident history and disclosure commitment?** Past incidents disclosed candidly are a good sign. "We've never had an incident" from a three-year-old company is a claim about their detection, not their security.

**12. Show us the SOC 2 Type II / ISAE 3000 report — not the badge.** Read the carve-outs and the complementary user-entity controls. The auditor knows how to read an assurance report; be the buyer who actually does.

## The pattern

Strong vendors answer all twelve in writing without legal review, because they've been asked before. The correlation is nearly perfect: friction on these questions predicts friction in production. Procurement is a risk-assessment procedure — run it like one.`,
  },
  {
    slug: "journal-entry-testing-llms",
    title: "Journal entry testing with LLMs: what works, what doesn't",
    dek: "Full-population journal testing is the profession's analytics success story. Adding language models to the pipeline helps in two places, hurts in one, and changes the documentation everywhere.",
    category: "Tools",
    tags: ["JET", "analytics", "journal entries", "ISA 240"],
    author: "Sofia Lindqvist",
    authorRole: "Senior Correspondent",
    publishedAt: "2026-05-05",
    readingMin: 7,
    featured: 0,
    urgency: 2,
    premium: false,
    body: `Journal-entry testing went full-population years before generative AI arrived: deterministic rules — postings by unexpected users, round amounts, period-end clusters, unusual account pairings — score every line, and humans investigate the tail. It works, it is defensible, and every methodology team knows its weakness: the rules only find what the rules describe.

Language models change the pipeline in two places, and pretending they replace it is how firms get findings.

## Where they help

**Narrative fields were dark data; now they aren't.** Every JET pipeline has quietly ignored the description field, the approval-comment thread, the attachment names — free text that deterministic rules can't score. LLMs read it. Classifying descriptions against their account codings ("consulting accrual" posted to revenue), flagging language anomalies (descriptions that switch language or template mid-series), and matching narratives to supporting-document titles adds a genuinely new signal channel. Teams running narrative scoring report it surfaces a different population than the amount-and-timing rules — which is exactly the point.

**Triage explanation, not triage decision.** The high-scoring tail of a JET run lands as a spreadsheet of context-free rows. Models that assemble the *dossier* for each flagged entry — the posting, its approver chain, the counter-entries, the relevant description history, prior-year analogues — cut investigation time per item dramatically. The model doesn't decide; it *briefs*. Investigators clear or escalate faster because they start informed.

## Where they hurt

**Letting the model do the scoring.** The temptation is obvious: skip the rule library, ask the model to "review these journals for fraud indicators." The result is unfit for purpose on three grounds. It is **unstable** — the same population scored twice yields different flags, which is fatal for reperformance. It is **unbounded** — you cannot state what the procedure covered, so you cannot state what it assured. And it is **capacity-limited** — context windows sample the population whether you admit it or not, quietly converting a full-population procedure into an undisclosed sample. The deterministic layer is not legacy; it is what makes the procedure a procedure.

## The documentation consequence

A hybrid pipeline needs its documentation upgraded in one specific way: the file must distinguish **deterministic coverage** (rules, thresholds, full population, repeatable) from **probabilistic enrichment** (model, version, prompt retained, output corroborated). The clean pattern emerging:

| Layer | Coverage claim | Reperformance |
| --- | --- | --- |
| Rule scoring | Full population, stated criteria | Re-run, identical results |
| LLM narrative scoring | Full population, stated prompt | Re-run, materially similar flags, variance noted |
| LLM triage briefs | Flagged items only | Briefs retained; conclusions human |

That middle row is the frontier. Auditors are learning to write coverage claims for procedures that are repeatable in substance but not bit-identical — the language feels uncomfortable for a profession raised on tick-and-tie, and the firms that draft it well are lending their wording to everyone else through inspection findings and methodology alerts.

The summary for the busy partner: keep the rules, read the narratives, brief the tail, and never let a stochastic system own a coverage claim.`,
  },
];
