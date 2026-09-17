export type Programme = {
  id: string;
  name: string;
  tagline: string;
  list: number;
  earlyBird: number;
  format: string;
  audience: string;
  popular?: boolean;
  outcomes: string[];
  modules: string[];
};

// 25% early-bird runs until 31 August 2026.
export const PROGRAMMES: Programme[] = [
  {
    id: "copilot-beginners",
    name: "Copilot Beginners",
    tagline: "From licence to habit in half a day",
    list: 1195,
    earlyBird: 896,
    format: "Half-day, on-site or remote · up to 12 participants",
    audience: "Teams with Copilot seats and single-digit weekly usage",
    outcomes: [
      "Every participant leaves with five working scenarios for their actual role — PBC chasing, meeting synthesis, memo first drafts",
      "The confidentiality rules of the road: what never goes in a prompt, and why",
      "A usage baseline your quality function can measure adoption against",
    ],
    modules: [
      "01 — What Copilot can see (and what that means in an audit firm)",
      "02 — Scenario drills by role: associate / senior / manager",
      "03 — The review habit: verifying before relying",
      "04 — Your first ten prompts, filed properly",
    ],
  },
  {
    id: "copilot-experienced",
    name: "Copilot Experienced",
    tagline: "For teams past the novelty — now make it defensible",
    list: 2245,
    earlyBird: 1684,
    format: "Full day, on-site · up to 12 participants",
    audience: "Teams using Copilot weekly who need consistency, quality and documentation discipline",
    popular: true,
    outcomes: [
      "Advanced engagement workflows: full-population narrative screening, consistency sweeps, estimate challenges",
      "ISA 230-grade documentation habits — prompts filed, review evidenced, versions recorded",
      "A team prompt canon: your ten highest-value workflows, standardised and review-ready",
    ],
    modules: [
      "01 — Beyond drafting: analytical workflows that hold up in review",
      "02 — The documentation layer: what inspectors ask for now",
      "03 — Failure-mode training on seeded errors: catch the machine being wrong",
      "04 — Building the firm canon: from freehand prompting to methodology",
    ],
  },
  {
    id: "full-ai-package",
    name: "Full AI Package",
    tagline: "Firm-wide capability, governance included",
    list: 5625,
    earlyBird: 4219,
    format: "Three sessions over six weeks + governance workshop · up to 24 participants",
    audience: "Firms building an AI practice ahead of the August 2026 enforcement date",
    outcomes: [
      "Both Copilot programmes, sequenced across your teams",
      "AI governance workshop for partners and quality leads: the use-register, authorisation matrix and monitoring plan, drafted in the room",
      "An EU AI Act deployer-obligations mapping for your firm's actual tool inventory",
      "Ninety days of follow-up: usage telemetry review and a written adoption report",
    ],
    modules: [
      "01 — Copilot Beginners cohort(s)",
      "02 — Copilot Experienced cohort(s)",
      "03 — Governance workshop: ISQM 1 meets the AI Act",
      "04 — Telemetry review + adoption report at day 90",
    ],
  },
];
