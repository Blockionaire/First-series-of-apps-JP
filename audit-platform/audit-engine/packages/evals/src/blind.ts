import { createHash } from "node:crypto";
import { z } from "zod";

/**
 * The blind preference test (07 §7.9).
 *
 * A = the firm's original working paper · B = raw engine output · C = engine output after
 * an auditor's review pass. B vs A measures the engine (M1, diagnostic). C vs A measures the
 * product (M2, the gate). They are never collapsed into one number.
 */

export const DocumentVariant = z.enum(["A", "B", "C"]);
export type DocumentVariant = z.infer<typeof DocumentVariant>;

export const Rater = z.object({
  raterId: z.string(),
  firm: z.string(),
  level: z.enum(["senior", "manager", "director"]),
});
export type Rater = z.infer<typeof Rater>;

export const BlindCase = z.object({
  caseId: z.string(),
  /** The firm whose working paper is variant A — its own people must not rate it. */
  firm: z.string(),
});
export type BlindCase = z.infer<typeof BlindCase>;

/** Deterministic shuffle, so an assignment can be reproduced and audited. */
function seededOrder<T>(items: T[], seed: string): T[] {
  return items
    .map((item, i) => ({
      item,
      k: createHash("sha256").update(`${seed}:${i}`).digest("hex"),
    }))
    .sort((a, b) => a.k.localeCompare(b.k))
    .map((x) => x.item);
}

export interface Assignment {
  raterId: string;
  caseId: string;
  /** Which physical label each variant is presented under, for this rater and case. */
  labels: Record<DocumentVariant, "1" | "2" | "3">;
}

/**
 * Each rater takes `casesPerRater` cases, never one from their own firm, with the label
 * mapping randomised per rater and case. Six raters × 3 cases over 6 cases gives three
 * independent ratings per case.
 */
export function assignRaters(
  cases: BlindCase[],
  raters: Rater[],
  seed = "phase0",
  casesPerRater = 3,
): Assignment[] {
  const load = new Map(cases.map((c) => [c.caseId, 0]));
  const out: Assignment[] = [];

  for (const rater of seededOrder(raters, `${seed}:raters`)) {
    const eligible = seededOrder(
      cases.filter((c) => c.firm !== rater.firm),
      `${seed}:${rater.raterId}`,
    ).sort((a, b) => (load.get(a.caseId)! - load.get(b.caseId)!));

    for (const c of eligible.slice(0, casesPerRater)) {
      load.set(c.caseId, load.get(c.caseId)! + 1);
      const order = seededOrder<DocumentVariant>(["A", "B", "C"], `${seed}:${rater.raterId}:${c.caseId}`);
      const labels = {} as Record<DocumentVariant, "1" | "2" | "3">;
      order.forEach((variant, i) => { labels[variant] = String(i + 1) as "1" | "2" | "3"; });
      out.push({ raterId: rater.raterId, caseId: c.caseId, labels });
    }
  }
  return out;
}

/* ── Collected ratings ────────────────────────────────────────────────────── */

export const Rating = z.object({
  raterId: z.string(),
  caseId: z.string(),
  /** The label the rater saw; de-blinded through the assignment. */
  label: z.enum(["1", "2", "3"]),
  /** 1 = would rather start from this one. */
  rank: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  completeness: z.number().min(1).max(7),
  auditRelevance: z.number().min(1).max(7),
  clarity: z.number().min(1).max(7),
  conciseness: z.number().min(1).max(7),
  traceability: z.number().min(1).max(7),
  /** "How many minutes of your time to make this file-ready?" — a number, not a scale. */
  reviewEffortMinutes: z.number().nonnegative(),
});
export type Rating = z.infer<typeof Rating>;

/** Asked once, at the very end, after all scoring. */
export const BlindingGuess = z.object({
  raterId: z.string(),
  caseId: z.string(),
  guessedAiLabels: z.array(z.enum(["1", "2", "3"])),
});
export type BlindingGuess = z.infer<typeof BlindingGuess>;

/* ── Derivation ───────────────────────────────────────────────────────────── */

export interface PairwiseResult {
  judgements: number;
  atOrAbove: number;
  strictlyAbove: number;
  atOrAboveShare: number;
  strictlyAboveShare: number;
}

function pairwise(
  ratings: Rating[],
  assignments: Assignment[],
  challenger: DocumentVariant,
): PairwiseResult {
  let judgements = 0, atOrAbove = 0, strictlyAbove = 0;

  for (const a of assignments) {
    const forPair = ratings.filter((r) => r.raterId === a.raterId && r.caseId === a.caseId);
    const rankOf = (v: DocumentVariant) => forPair.find((r) => r.label === a.labels[v])?.rank;
    const base = rankOf("A"), chal = rankOf(challenger);
    if (base === undefined || chal === undefined) continue;
    judgements++;
    if (chal <= base) atOrAbove++;
    if (chal < base) strictlyAbove++;
  }

  return {
    judgements,
    atOrAbove,
    strictlyAbove,
    atOrAboveShare: judgements === 0 ? 0 : atOrAbove / judgements,
    strictlyAboveShare: judgements === 0 ? 0 : strictlyAbove / judgements,
  };
}

/** M1 — raw engine quality. Diagnostic only; never a gate (07 §7.8). */
export const m1 = (r: Rating[], a: Assignment[]) => pairwise(r, a, "B");
/** M2 — AI-assisted final quality. The primary product gate. */
export const m2 = (r: Rating[], a: Assignment[]) => pairwise(r, a, "C");

export function blindingIntegrity(guesses: BlindingGuess[], assignments: Assignment[]): number {
  if (guesses.length === 0) return 0;
  let correct = 0;
  for (const g of guesses) {
    const a = assignments.find((x) => x.raterId === g.raterId && x.caseId === g.caseId);
    if (!a) continue;
    const aiLabels = new Set([a.labels["B"], a.labels["C"]]);
    // "Correct" means they picked at least one genuine AI document and no false positive.
    const picked = new Set(g.guessedAiLabels);
    const anyRight = [...picked].some((l) => aiLabels.has(l));
    const anyWrong = [...picked].some((l) => !aiLabels.has(l));
    if (anyRight && !anyWrong) correct++;
  }
  return correct / guesses.length;
}

export interface CriterionProfile {
  variant: DocumentVariant;
  completeness: number;
  auditRelevance: number;
  clarity: number;
  conciseness: number;
  traceability: number;
  reviewEffortMinutes: number;
  n: number;
}

export function criterionProfile(ratings: Rating[], assignments: Assignment[]): CriterionProfile[] {
  const out: CriterionProfile[] = [];
  for (const variant of ["A", "B", "C"] as const) {
    const rows: Rating[] = [];
    for (const a of assignments) {
      const r = ratings.find(
        (x) => x.raterId === a.raterId && x.caseId === a.caseId && x.label === a.labels[variant],
      );
      if (r) rows.push(r);
    }
    const mean = (f: (r: Rating) => number) =>
      rows.length === 0 ? 0 : rows.reduce((n, r) => n + f(r), 0) / rows.length;
    out.push({
      variant,
      completeness: mean((r) => r.completeness),
      auditRelevance: mean((r) => r.auditRelevance),
      clarity: mean((r) => r.clarity),
      conciseness: mean((r) => r.conciseness),
      traceability: mean((r) => r.traceability),
      reviewEffortMinutes: mean((r) => r.reviewEffortMinutes),
      n: rows.length,
    });
  }
  return out;
}
