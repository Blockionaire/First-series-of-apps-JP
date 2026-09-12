/**
 * The prompts that stay behind the STAI+ gate.
 *
 * Selection rule: keep the deepest, most specialised instruments — the ones a
 * practitioner reaches for on a hard engagement — and open everything that
 * demonstrates the library's quality. 11 of 31 premium.
 *
 * Hard constraint: EVERY category must retain at least one free prompt. A
 * category that is entirely locked reads as an empty shelf to the specialist
 * who filters to it, and they leave.
 */
export const PREMIUM_PROMPT_SLUGS = [
  // Fraud & Forensics
  "synthetic-document-screen",
  "whistleblower-triage",
  // Fieldwork & Analytics
  "flagged-item-dossier",
  "estimate-challenger-isa540",
  // CSRD & ESG
  "sustainability-consistency-sweep",
  "double-materiality-workshop-prep",
  // Financial Reporting
  "accounting-policy-plain-rewrite",
  // Tax
  "pillar-two-exposure-scan",
  // Standards Research
  "model-output-challenge-protocol",
  "inspection-finding-decoder",
  // Client Communication
  "board-ai-briefing",
] as const;
