import type { SeedPodcast, SeedResearch, SeedSignal } from "./types";

export const podcasts: SeedPodcast[] = [
  {
    slug: "ep-14-afm-thematic-review",
    episodeNo: 14,
    title: "Inside the AFM's thematic review — what the six firms were asked",
    guest: "Annelies Hartman, former AFM supervision officer",
    description:
      "The Dutch regulator's AI review is the first of its kind in Europe. A former insider walks through the request list, why licensed-seats-versus-documented-use is the question that stings, and how to rehearse the October interviews.",
    durationMin: 43,
    publishedAt: "2026-07-02",
  },
  {
    slug: "ep-13-evidence-after-generative",
    episodeNo: 13,
    title: "Evidence after generative AI: repricing the hierarchy",
    guest: "Prof. Henrik Dalgaard, Copenhagen Business School",
    description:
      "When any document can be fabricated for nothing, what still counts as good evidence? Provenance over appearance, volume as a defence, and why confirmation platforms are quietly becoming the profession's most important infrastructure.",
    durationMin: 51,
    publishedAt: "2026-06-18",
  },
  {
    slug: "ep-12-copilot-90-days",
    episodeNo: 12,
    title: "Ninety days of Copilot: three firms report",
    guest: "Panel — quality leads from three European mid-tier firms",
    description:
      "The adoption numbers nobody publishes, the scenario-training effect, the permissions audit nobody expected, and why documentation drafting stalled at all three firms for the same reason.",
    durationMin: 58,
    publishedAt: "2026-06-04",
  },
  {
    slug: "ep-11-ai-act-audit-partner",
    episodeNo: 11,
    title: "The AI Act for audit partners — the 40-minute version",
    guest: "Dr. Lena Osterberg, technology counsel",
    description:
      "Deployer obligations, Annex III drift, Article 25's provider trap, and the four artefacts every firm should have before 2 August. The episode to forward to the partner who keeps saying it's a client problem.",
    durationMin: 42,
    publishedAt: "2026-05-21",
  },
  {
    slug: "ep-10-prompt-libraries-methodology",
    episodeNo: 10,
    title: "Prompt libraries are methodology — treat them that way",
    guest: "Marieke van Dijk, Editor, STAI",
    description:
      "Our editor on why freehand prompting is unreviewed procedure design, what the ISA 230 file actually needs to capture, and how the best quality teams are versioning their prompt canon like audit programmes.",
    durationMin: 38,
    publishedAt: "2026-05-07",
  },
  {
    slug: "ep-09-csrd-reading-machine",
    episodeNo: 9,
    title: "CSRD assurance and the reading machine",
    guest: "Ines Ferreira, sustainability assurance director",
    description:
      "Four hundred policy documents per engagement and a limited-assurance budget. Where extraction-with-citation works, why materiality scoring doesn't, and the AI-procedures memo format her team uses.",
    durationMin: 47,
    publishedAt: "2026-04-23",
  },
  {
    slug: "ep-08-junior-problem",
    episodeNo: 8,
    title: "The junior problem, with the partner running the teaching hospital",
    guest: "Stefan Brandt, training partner",
    description:
      "His firm built a synthetic client with seeded frauds so associates learn by hand what AI does on live files. What it costs, what it teaches, and whether verification is a trainable skill or a temperament.",
    durationMin: 49,
    publishedAt: "2026-04-09",
  },
  {
    slug: "ep-07-scepticism-by-design",
    episodeNo: 7,
    title: "Scepticism by design: the guess box and other machines",
    guest: "Dr. Priya Raghavan, human-factors researcher",
    description:
      "Automation bias survives every warning ever issued about it. What aviation actually did instead, why judgement-before-generation works, and how to sample the accepted rather than the rejected.",
    durationMin: 54,
    publishedAt: "2026-03-26",
  },
];

export const research: SeedResearch[] = [
  {
    slug: "llm-financial-misstatement-detection-2026",
    title: "Large Language Models for Financial Misstatement Detection: Field Evidence",
    source: "Journal of Accounting Research (forthcoming)",
    authors: "Chen, Novak & Willems",
    year: 2026,
    topic: "Analytics",
    summary:
      "Field study across 214 European engagements measuring LLM narrative screening of journal populations against deterministic rules alone. Hybrid pipelines flagged a materially different population, catching 31% of seeded misstatements the rules missed — while pure-LLM scoring proved unstable across runs, with only 62% flag overlap on identical data.",
    takeaway:
      "Keep the deterministic layer; add narrative screening; never let the stochastic layer own the coverage claim. The 62% run-to-run overlap is the number to quote when someone proposes replacing the rule library.",
  },
  {
    slug: "automation-bias-audit-review-2025",
    title: "Automation Bias in Audit Review: An Eye-Tracking Study",
    source: "The Accounting Review",
    authors: "Raghavan, Meyer & Skov",
    year: 2025,
    topic: "Behavioural",
    summary:
      "Eye-tracking of 96 experienced reviewers evaluating workpaper conclusions with and without AI-draft anchoring. Reviewers shown AI drafts first spent 41% less fixation time on source evidence and were 2.3× less likely to detect the seeded error. A forced independent-judgement step before display eliminated most of the effect.",
    takeaway:
      "The strongest empirical support yet for judgement-before-generation workflow design. If your tooling shows the AI answer first, this paper says your review process degrades measurably.",
  },
  {
    slug: "deepfake-documents-fraud-cost-2025",
    title: "The Collapsing Cost of Document Fraud: Generative Models and Audit Evidence",
    source: "European Accounting Review",
    authors: "Lindgren & Fontaine",
    year: 2025,
    topic: "Fraud",
    summary:
      "Experimental study generating synthetic invoices, contracts and confirmations, then measuring detection rates by auditors, forensic specialists and automated tools. Experienced auditors detected 24% of synthetic documents by inspection; document-forensics tooling reached 71%; cross-population consistency analysis reached 89%.",
    takeaway:
      "Inspection alone is no longer a defensible primary procedure for fraud-relevant documents. Consistency analysis across populations — the fabricator's blind spot — is where detection actually lives.",
  },
  {
    slug: "ai-disclosure-annual-reports-2026",
    title: "AI Risk Disclosure in European Annual Reports: The First AI Act Reporting Season",
    source: "Accounting in Europe",
    authors: "Kowalski, van der Berg & Ricci",
    year: 2026,
    topic: "Regulation",
    summary:
      "Content analysis of 480 STOXX Europe 600 annual reports. 71% now mention AI risk, but only 18% disclose Annex III system inventories and 9% quantify exposure. Firms audited by networks with published AI methodologies disclosed significantly more — an auditor-effect on disclosure quality.",
    takeaway:
      "The auditor-effect finding is the headline: audit methodology is already shaping client AI disclosure. Expect the 18% inventory-disclosure figure to become a regulator benchmark within two seasons.",
  },
  {
    slug: "isqm1-ai-governance-survey-2026",
    title: "Quality Management Systems and AI Governance: Survey Evidence from 340 European Firms",
    source: "International Journal of Auditing",
    authors: "Dubois, Anders & Petkova",
    year: 2026,
    topic: "Quality Management",
    summary:
      "Survey of quality leaders across 340 firms in 14 jurisdictions. 84% report AI use in engagements; 31% maintain a use-register; 12% test AI-output review controls within ISQM 1 monitoring. The register-to-monitoring gap correlates strongly with firm size — and inversely with recent inspection findings.",
    takeaway:
      "The 84/31/12 cascade is the state of the profession in three numbers: nearly everyone uses it, a third can list where, almost nobody tests the controls they claim. Position your firm on the cascade honestly.",
  },
  {
    slug: "genai-audit-efficiency-meta-2025",
    title: "Does Generative AI Make Audits Faster? A Multi-Firm Time-Tracking Analysis",
    source: "Auditing: A Journal of Practice & Theory",
    authors: "O'Sullivan, Bakker & Lindqvist",
    year: 2025,
    topic: "Economics",
    summary:
      "Time-tracking data from 1,900 engagements across six firms, two seasons. Mean hours fell 6.2% on AI-enabled engagements — but the reduction concentrated in administrative and communication tasks (−19%), while documentation review hours rose 8%. Net partner and manager hours were flat.",
    takeaway:
      "AI compresses the connective tissue, not the judgement core — and review hours go up before they come down. Budget accordingly, and distrust any business case built on linear hour reduction.",
  },
  {
    slug: "esrs-nlp-consistency-2026",
    title: "Machine-Assisted Consistency Checking of ESRS Sustainability Statements",
    source: "Journal of Business Ethics (special issue)",
    authors: "Weber, Nilsen & Okafor",
    year: 2026,
    topic: "Sustainability",
    summary:
      "Applied long-context models to 62 published CSRD sustainability statements plus paired financial statements, hunting contradictions. Models surfaced a median of 11 hard inconsistencies per statement — cross-document numeric conflicts dominating — of which human experts confirmed 78% as genuine reporting errors.",
    takeaway:
      "A median of eleven confirmed-mostly-genuine contradictions per published statement is an assurance gap in plain sight. The consistency sweep is the cheapest high-yield procedure in the CSRD toolkit — this paper is the citation for putting it in the work programme.",
  },
  {
    slug: "verification-skill-training-2026",
    title: "Training Verification Skill: Seeded-Error Streams and Novice Auditor Development",
    source: "Behavioral Research in Accounting",
    authors: "Brandt, Kessler & Yamamoto",
    year: 2026,
    topic: "Talent",
    summary:
      "Longitudinal study of 210 associates reviewing AI output through tooling that seeded known errors at controlled rates. Catch rates rose from 43% to 81% over 16 weeks with feedback; a control group without seeded streams improved only marginally. Skill transferred to un-seeded live work with modest decay.",
    takeaway:
      "Verification is trainable like simulator hours — but only with a controlled error supply and feedback. This is the evidence base for the instrumented-AI training route, and for measuring catch rates as a competence metric.",
  },
];

export const signals: SeedSignal[] = [
  { label: "EU AI ACT — GPAI & high-risk obligations enforceable 02 AUG 2026", detail: "Art. 113 schedule", kind: "reg", publishedAt: "2026-07-07" },
  { label: "AFM opens thematic review of AI use at all six OOB firms", detail: "on-site visits Oct–Nov", kind: "reg", publishedAt: "2026-06-25" },
  { label: "IAASB signals ISA 500 refresh — consultation expected Q4 2026", detail: "evidence & automated tools", kind: "standard", publishedAt: "2026-07-01" },
  { label: "ESMA issues first model-governance fine — €2.4m, CRA sector", detail: "process-first enforcement", kind: "reg", publishedAt: "2026-06-11" },
  { label: "CEAOB workstream on AI inspection convergence confirmed", detail: "2027 programme", kind: "reg", publishedAt: "2026-06-20" },
  { label: "Copilot weekly-active-use at trained mid-tier staff: 78%", detail: "STAI field data, n=3 firms", kind: "market", publishedAt: "2026-06-08" },
  { label: "ESRS consistency sweeps: median 11 hard contradictions per statement", detail: "Weber et al. 2026", kind: "market", publishedAt: "2026-05-30" },
  { label: "Synthetic-document detection by inspection alone: 24%", detail: "Lindgren & Fontaine", kind: "market", publishedAt: "2026-05-15" },
  { label: "STAI training early-bird — 25% off all programmes until 31 AUG", detail: "autumn cohorts", kind: "stai", publishedAt: "2026-07-01" },
  { label: "Founding member window: first 200 subscribers lock €12/mo forever", detail: "live counter on /plus", kind: "stai", publishedAt: "2026-06-15" },
  { label: "BaFin & APAS inspection focus: four-eyes evidence on AI output", detail: "German supervisory practice", kind: "reg", publishedAt: "2026-05-22" },
  { label: "84% of European firms use AI in engagements; 12% test the controls", detail: "Dubois et al., n=340", kind: "market", publishedAt: "2026-05-10" },
];
