export type Question = {
  id: string;
  dimension: "Governance" | "People" | "Practice" | "Evidence";
  text: string;
  options: string[]; // index = score 0..3
};

export const QUESTIONS: Question[] = [
  {
    id: "inventory",
    dimension: "Governance",
    text: "Does your firm maintain an inventory of the AI tools in use on engagements?",
    options: [
      "No — we don't have a firm-wide view",
      "Informally — people know roughly what's in use",
      "A register exists but it's periodically updated and incomplete",
      "A live register with named owners per tool, reviewed on a schedule",
    ],
  },
  {
    id: "authorisation",
    dimension: "Governance",
    text: "Who can put a new AI tool into engagement use?",
    options: [
      "Anyone — staff adopt tools as they find them",
      "Team leads decide for their own teams",
      "A defined approval process exists",
      "A defined process including a documented fitness evaluation on firm-representative tasks",
    ],
  },
  {
    id: "training",
    dimension: "People",
    text: "What AI training have client-facing staff actually received?",
    options: [
      "None yet",
      "Self-serve materials or vendor webinars",
      "A one-off firm-wide session",
      "Scenario-based, role-specific training with follow-up and measured adoption",
    ],
  },
  {
    id: "demonstrate",
    dimension: "People",
    text: "Could your quality lead demonstrate, live, how AI was used on a specific engagement?",
    options: [
      "No — we couldn't reconstruct it",
      "With days of preparation",
      "With a few hours' notice",
      "Yes — the records exist to answer it on the spot",
    ],
  },
  {
    id: "embedding",
    dimension: "Practice",
    text: "Where does AI actually sit in your engagements today?",
    options: [
      "Nowhere officially",
      "Individual experiments, person by person",
      "Established pockets in some teams or service lines",
      "Embedded in standard procedures with defined workflows",
    ],
  },
  {
    id: "prompts",
    dimension: "Practice",
    text: "When AI output influences audit work, the prompts that produced it are…",
    options: [
      "Not retained",
      "Sometimes in personal notes",
      "Retained, but inconsistently and without versions",
      "Filed with model and version, like any working paper",
    ],
  },
  {
    id: "review",
    dimension: "Evidence",
    text: "Human review of AI output on engagements is…",
    options: [
      "Assumed to happen",
      "Asserted in a policy",
      "Documented on some engagements",
      "Evidenced consistently — reviewer, basis, and disposition recorded",
    ],
  },
  {
    id: "modelchange",
    dimension: "Evidence",
    text: "If a vendor silently swapped the model behind a tool you rely on, would you know?",
    options: [
      "No",
      "Eventually, through behaviour changes",
      "Yes — contractual notification requirements",
      "Yes — notification plus a re-evaluation gate before continued use",
    ],
  },
];

export type Band = {
  key: string;
  name: string;
  range: [number, number];
  verdict: string;
  moves: string[];
};

export const BANDS: Band[] = [
  {
    key: "observer",
    name: "OBSERVER",
    range: [0, 6],
    verdict:
      "Your firm is watching the shift rather than governing it. That is survivable in 2025; from August 2026 it reads as a finding. The good news: at this stage, a quarter of focused work moves you two bands — the artefacts that matter most are cheap to build and you get to build them right first time.",
    moves: [
      "Build the use-register this month: every AI tool actually in use, its use cases, a named owner. The honest version — including the unapproved tools staff already use — is the valuable one.",
      "Issue interim rules of the road: what may never enter a prompt, and which uses need sign-off. One page, this week, while the full framework is drafted.",
      "Run scenario-based training for one pilot team and measure weekly active use — it becomes your baseline and your board's proof of motion.",
    ],
  },
  {
    key: "explorer",
    name: "EXPLORER",
    range: [7, 12],
    verdict:
      "AI is in the building — in pockets, on individual initiative, ahead of your governance. This is the highest-risk band: real usage without the documentation discipline, which is precisely the gap the AFM's seat-versus-use reconciliation is designed to expose. Your task is not more adoption; it is catching governance up to the adoption you already have.",
    moves: [
      "Reconcile licences against documented use — do the regulator's homework before the regulator does. The gap is your risk register.",
      "Adopt prompt-retention discipline now: anything that touches a conclusion gets filed with model and version. It's a habit, not a project.",
      "Write the authorisation matrix: who may use what, on which tasks, at which seniority. The first draft will expose that the answer today is 'everyone, everything' — that discovery is the point.",
    ],
  },
  {
    key: "operator",
    name: "OPERATOR",
    range: [13, 18],
    verdict:
      "You run AI like a practice, not an experiment — registers, training, retention discipline are recognisably in place. What separates you from the front rank is evidence depth: controls that are claimed but not yet tested, reviews that happen but leave thin trails. Inspectors will find the claims; make sure they find the artefacts.",
    moves: [
      "Put AI-output review into ISQM 1 monitoring: sample accepted outputs, measure acceptance-without-modification rates, and treat >95% as a reviewer red flag.",
      "Add model-change gates to vendor contracts and your own process — notification is not control unless something re-evaluates before continued use.",
      "Map your deployer obligations under Article 26 to existing quality-management components, so August 2026 is a cross-reference exercise, not a scramble.",
    ],
  },
  {
    key: "vanguard",
    name: "VANGUARD",
    range: [19, 24],
    verdict:
      "You are ahead of your regulator and most of your peers — the artefacts exist, the evidence trail is real, and August 2026 is a cross-reference exercise. Your risks are subtler: automation bias hiding inside your own confidence, and a methodology edge that erodes if it isn't measured. The next frontier is proving effectiveness, not asserting maturity.",
    moves: [
      "Instrument verification skill: seeded-error streams for staff who review AI output, with measured catch rates as a competence metric.",
      "Publish internal failure metrics — where your tooling was wrong and what caught it. The firms that measure this will own the quality narrative when disclosure becomes competitive.",
      "Pressure-test scepticism by design: judgement-before-generation workflows on significant estimates, and sample the accepted, not just the rejected.",
    ],
  },
];

export function bandFor(score: number): Band {
  return BANDS.find((b) => score >= b.range[0] && score <= b.range[1]) ?? BANDS[0];
}
