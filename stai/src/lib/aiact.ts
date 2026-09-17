/**
 * The AI Act, reduced to what an audit firm has to do about it.
 *
 * This is reference content, kept in code rather than the CMS because the
 * page's structure is bespoke. Every obligation cites its article so a reader
 * can verify us — which is the entire point of publishing it.
 */

export type Obligation = {
  article: string;
  duty: string;
  meaning: string;
  owner: string;
};

export const DEPLOYER_OBLIGATIONS: Obligation[] = [
  {
    article: "Art. 26(1)",
    duty: "Use high-risk systems per their instructions",
    meaning:
      "Whatever the provider's documentation says about intended purpose and limits is now binding on you. Using a tool outside its stated purpose transfers risk onto the firm.",
    owner: "Tool owner named in the use-register",
  },
  {
    article: "Art. 26(2)",
    duty: "Assign human oversight to competent, trained, supported people",
    meaning:
      "Oversight has to be a named role with the authority and the standing to overrule the system — not a line in a policy saying output is reviewed.",
    owner: "Engagement partner / quality function",
  },
  {
    article: "Art. 26(4)",
    duty: "Ensure input data is relevant and sufficiently representative",
    meaning:
      "The population you feed the tool is your responsibility. For audit that maps directly onto extract completeness — the same evidence you already need for IPE.",
    owner: "Engagement team",
  },
  {
    article: "Art. 26(5)",
    duty: "Monitor operation and suspend use where risk emerges",
    meaning:
      "Monitoring must have teeth. A drift signal that triggers nothing is disclosure, not control — ESMA's first model-governance fine turned on exactly this.",
    owner: "Quality function",
  },
  {
    article: "Art. 26(6)",
    duty: "Retain automatically generated logs for at least six months",
    meaning:
      "Log retention where the logs are under your control. Audit files outlive this by a decade, so align retention with the file, not the minimum.",
    owner: "IT / firm operations",
  },
  {
    article: "Art. 26(7)",
    duty: "Inform workers before putting a high-risk system into use at work",
    meaning:
      "Applies to staff scheduling, evaluation and allocation tools — an Annex III(4) area firms routinely forget is in scope for their own HR systems.",
    owner: "HR / people function",
  },
  {
    article: "Art. 4",
    duty: "Ensure a sufficient level of AI literacy among staff",
    meaning:
      "Applies to everyone using AI on your behalf, not only high-risk uses. Nobody has defined 'sufficient' — so define it yourself, in writing, and evidence it.",
    owner: "Learning & development",
  },
  {
    article: "Art. 50",
    duty: "Disclose AI-generated content and AI interaction where required",
    meaning:
      "Relevant wherever AI-drafted material reaches a third party. Firms letting AI draft client-facing documents without a disclosure policy are accruing quiet exposure.",
    owner: "Engagement partner",
  },
];

export const ARTEFACTS: { name: string; why: string; effort: string }[] = [
  {
    name: "AI use-register",
    why: "Every AI tool in the practice, its use cases, its classification, and the partner who owns it. This is the document every supervisory conversation starts from.",
    effort: "Days — the honest version, including tools staff adopted unofficially, is the valuable one.",
  },
  {
    name: "Classification memo per system",
    why: "Prohibited / high-risk / limited / minimal, with the Annex III walk-through shown and borderline calls argued both ways.",
    effort: "Half a day per system, less once the first is written.",
  },
  {
    name: "Deployer-controls mapping",
    why: "Article 26 duties mapped onto existing ISQM 1 components, so oversight lives inside quality management rather than beside it.",
    effort: "A week, and it makes the ISQM 1 evidence stronger too.",
  },
  {
    name: "Authorisation matrix",
    why: "Who may use what, on which tasks, at which seniority. Writing the first draft is the moment governance becomes real — because the current answer is usually 'everyone, everything'.",
    effort: "A day, plus the argument.",
  },
  {
    name: "AI literacy evidence",
    why: "Article 4 records: who was trained, on what, when, and how competence was checked. Attendance alone is weak; measured capability is the defensible version.",
    effort: "Ongoing — start the record now, backdate nothing.",
  },
  {
    name: "Client-impact screen",
    why: "Added to acceptance and continuance: does this entity deploy Annex III systems material to the financial statements?",
    effort: "One question, added once.",
  },
];

export const MILESTONES: { date: string; iso: string; label: string; detail: string; past: boolean }[] = [
  {
    date: "01 AUG 2024",
    iso: "2024-08-01",
    label: "Act enters into force",
    detail: "The twenty-day clock from publication expires; the phased application schedule begins.",
    past: true,
  },
  {
    date: "02 FEB 2025",
    iso: "2025-02-02",
    label: "Prohibitions apply",
    detail: "Article 5 prohibited practices become enforceable, along with the Article 4 AI-literacy duty.",
    past: true,
  },
  {
    date: "02 AUG 2025",
    iso: "2025-08-02",
    label: "GPAI obligations begin",
    detail: "General-purpose AI model rules apply; national competent authorities are designated; penalty regimes take effect.",
    past: true,
  },
  {
    date: "02 AUG 2026",
    iso: "2026-08-02",
    label: "The main body applies",
    detail:
      "High-risk obligations under Annex III, transparency duties under Article 50, and enforcement by market-surveillance authorities. This is the date that matters to your firm.",
    past: false,
  },
  {
    date: "02 AUG 2027",
    iso: "2027-08-02",
    label: "Annex I high-risk and legacy GPAI",
    detail:
      "High-risk systems embedded in regulated products, plus the compliance deadline for GPAI models placed on the market before August 2025.",
    past: false,
  },
];

export const PENALTIES: { breach: string; cap: string }[] = [
  { breach: "Prohibited practices (Art. 5)", cap: "Up to €35m or 7% of global annual turnover" },
  { breach: "Most other obligations, including deployer duties", cap: "Up to €15m or 3% of global annual turnover" },
  { breach: "Supplying incorrect or misleading information to authorities", cap: "Up to €7.5m or 1% of global annual turnover" },
];
