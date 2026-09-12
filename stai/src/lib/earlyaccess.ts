/**
 * STAI+ early access.
 *
 * A waitlist, not a product. Payments are frozen, so the paid tier exists on
 * the site only to test whether anyone wants it — and the interest question is
 * the whole point of collecting anything at all.
 *
 * Options describe capabilities the product already has or has concretely
 * planned. Nothing here promises something that has not been built or scoped.
 */
export const EARLY_ACCESS_INTERESTS: { id: string; label: string; blurb: string }[] = [
  {
    id: "brief",
    label: "Weekly Audit AI Brief",
    blurb: "One dispatch a week: the regulatory moves and standards signals that matter, read in four minutes.",
  },
  {
    id: "prompts",
    label: "Full prompt library",
    blurb: "Every vetted, guardrailed prompt — not just the open selection.",
  },
  {
    id: "ask_pro",
    label: "Ask STAI Pro",
    blurb: "Unlimited grounded questions, saved answers, and working-paper export.",
  },
  {
    id: "implementation",
    label: "Practical implementation guides",
    blurb: "Step-by-step guides for the artefacts firms actually have to produce.",
  },
  {
    id: "tool_intel",
    label: "AI tool intelligence & reviews",
    blurb: "Independent assessment of audit AI tooling — what it does, how it fails.",
  },
  {
    id: "templates",
    label: "Templates & resources",
    blurb: "Reusable registers, memos and checklists that drop into your file.",
  },
];

const VALID = new Set(EARLY_ACCESS_INTERESTS.map((i) => i.id));
export const isInterest = (id: string) => VALID.has(id);
export const interestLabel = (id: string) =>
  EARLY_ACCESS_INTERESTS.find((i) => i.id === id)?.label ?? id;

export const EARLY_ACCESS_ROLES = [
  "Audit partner",
  "Quality / compliance lead",
  "Methodology / technical",
  "Manager / senior",
  "Innovation or technology lead",
  "Learning & development",
  "Other",
] as const;
