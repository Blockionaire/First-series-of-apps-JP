import { z } from "zod";

/**
 * M4 — the B→C edit taxonomy (07 §7.8).
 *
 * Classifying edits, rather than counting them, is what distinguishes "the engine needs
 * polishing" from "the engine is fundamentally wrong". The editor logs one row per change
 * while producing variant C; roughly 15 minutes per case.
 */
export const EditCategory = z.enum([
  "stylistic",
  "conciseness",
  "clarification",
  "structural",
  "missing_content_addition",
  "risk_control_correction",
  "methodology_correction",
  "unsupported_claim_correction",
  "deletion_irrelevant",
]);
export type EditCategory = z.infer<typeof EditCategory>;

export const EditSeverity = z.enum(["trivial", "moderate", "material"]);

export const EditRecord = z.object({
  caseId: z.string(),
  location: z.string(),
  category: EditCategory,
  severity: EditSeverity,
  note: z.string().default(""),
});
export type EditRecord = z.infer<typeof EditRecord>;

const POLISH: EditCategory[] = ["stylistic", "conciseness", "clarification", "structural"];
const FUNDAMENTAL: EditCategory[] = [
  "methodology_correction",
  "risk_control_correction",
  "missing_content_addition",
];

export interface EditVerdict {
  total: number;
  byCategory: Record<string, number>;
  materialTotal: number;
  materialPerCase: number;
  materialUnsupportedClaims: number;
  materialMethodologyOrControl: number;
  polishShare: number;
  fundamentalShare: number;
  /** 07 §7.8 M4 */
  signal: "polish" | "mixed" | "fundamental";
  hardFail: boolean;
  notes: string[];
}

export function verdictOf(edits: EditRecord[], caseCount: number): EditVerdict {
  const byCategory: Record<string, number> = {};
  for (const e of edits) byCategory[e.category] = (byCategory[e.category] ?? 0) + 1;

  const material = edits.filter((e) => e.severity === "material");
  const materialUnsupported = material.filter((e) => e.category === "unsupported_claim_correction").length;
  const materialMethod = material.filter(
    (e) => e.category === "methodology_correction" || e.category === "risk_control_correction",
  ).length;

  const share = (cats: EditCategory[]) =>
    edits.length === 0 ? 0 : edits.filter((e) => cats.includes(e.category)).length / edits.length;

  const polishShare = share(POLISH);
  const fundamentalShare = share(FUNDAMENTAL);
  const materialPerCase = caseCount === 0 ? 0 : material.length / caseCount;

  const notes: string[] = [];
  if (materialUnsupported > 0) notes.push(`${materialUnsupported} material unsupported-claim corrections — hard fail (M5)`);
  if (materialPerCase > 3) notes.push(`${materialPerCase.toFixed(1)} material edits per case exceeds the threshold of 3`);
  if (materialMethod / Math.max(caseCount, 1) > 2) notes.push("material methodology/control corrections exceed 2 per case");
  if (materialPerCase > 6) notes.push("more than 6 material edits per case — do not proceed to Phase 1 regardless of M2");

  const signal: EditVerdict["signal"] =
    fundamentalShare >= 0.4 || materialPerCase > 6 ? "fundamental" : polishShare >= 0.6 ? "polish" : "mixed";

  return {
    total: edits.length,
    byCategory,
    materialTotal: material.length,
    materialPerCase,
    materialUnsupportedClaims: materialUnsupported,
    materialMethodologyOrControl: materialMethod,
    polishShare,
    fundamentalShare,
    signal,
    hardFail: materialUnsupported > 0,
    notes,
  };
}
