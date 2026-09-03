import type { CaseMetrics } from "./metrics.ts";
import { hardFails, summarise } from "./metrics.ts";
import type { EditVerdict } from "./edits.ts";
import type { PairwiseResult } from "./blind.ts";

/**
 * The Phase 0 gate (07 §7.8). Six metrics, separate thresholds, and stop rules stated per
 * comparison. M1 never gates.
 */

export interface EditTimings {
  /** Minutes to turn B into C, per case, measured by the editor. */
  minutesPerCase: number[];
  /** The firm's own authoring-plus-review time for the same process, in minutes. */
  firmBaselineMinutes: number | null;
}

export interface GateInput {
  metrics: CaseMetrics[];
  m1: PairwiseResult | null;
  m2: PairwiseResult | null;
  edits: EditVerdict | null;
  timings: EditTimings | null;
  blindingIntegrity: number | null;
}

export type Verdict = "pass" | "iterate" | "stop" | "incomplete";

export interface GateReport {
  verdict: Verdict;
  hardFails: string[];
  lines: string[];
  /** True while the human evidence is missing — synthetic scores alone never decide. */
  humanEvidenceMissing: boolean;
}

const pct = (x: number) => `${(x * 100).toFixed(0)}%`;
const median = (xs: number[]) => {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};

export function gateReport(input: GateInput): GateReport {
  const lines: string[] = [];
  const fails = [...hardFails(input.metrics)];
  const s = summarise(input.metrics);

  // ── M6, automatic ────────────────────────────────────────────────────────
  lines.push(`M6 automatic (n=${s.cases} cases)`);
  lines.push(`   grounding integrity   ${s.groundingIntegrityOk ? "ok" : "FAILED"}   grounded ${pct(s.groundedShare)}`);
  lines.push(`   coverage recall       ${pct(s.coverageRecall.mean)}  (sd ${pct(s.coverageRecall.sd)})   threshold 85%`);
  lines.push(`   risk recall vs firm   ${pct(s.riskRecallVsFirm.mean)}  (sd ${pct(s.riskRecallVsFirm.sd)})   threshold 85%`);
  lines.push(`   risk recall vs expert ${pct(s.riskRecallVsExpert.mean)}  (sd ${pct(s.riskRecallVsExpert.sd)})   threshold 75%`);
  lines.push(`   control recall        ${pct(s.controlRecall.mean)}  (sd ${pct(s.controlRecall.sd)})   threshold 80%`);
  lines.push(`   missing-fact detect   ${pct(s.missingFactDetection.mean)}  (sd ${pct(s.missingFactDetection.sd)})   threshold 70%`);

  const m6AtThreshold =
    [
      s.coverageRecall.mean >= 0.85,
      s.riskRecallVsFirm.mean >= 0.85,
      s.riskRecallVsExpert.mean >= 0.75,
      s.controlRecall.mean >= 0.8,
      s.missingFactDetection.mean >= 0.7,
    ].filter(Boolean).length;

  // ── M1, diagnostic ───────────────────────────────────────────────────────
  lines.push("");
  if (input.m1) {
    lines.push(`M1 raw engine, B vs A — DIAGNOSTIC, NEVER A GATE`);
    lines.push(`   B at or above A  ${pct(input.m1.atOrAboveShare)}  (n=${input.m1.judgements})`);
    lines.push(
      input.m1.atOrAboveShare >= 0.45 ? "   reading: good raw engine"
      : input.m1.atOrAboveShare >= 0.25 ? "   reading: expected — a raw draft losing to a finished paper is the normal case"
      : "   reading: below the 20% concern threshold — the engine is a weak drafter, so M3 and M4 decide",
    );
  } else lines.push("M1 raw engine, B vs A — not yet measured");

  // ── M2, the gate ─────────────────────────────────────────────────────────
  lines.push("");
  let m2Pass = false, m2Stop = false;
  if (input.m2) {
    m2Pass = input.m2.atOrAboveShare >= 0.7 && input.m2.strictlyAboveShare >= 0.5;
    m2Stop = input.m2.atOrAboveShare < 0.4;
    lines.push(`M2 AI-assisted, C vs A — PRIMARY PRODUCT GATE`);
    lines.push(`   C at or above A  ${pct(input.m2.atOrAboveShare)}   threshold 70%`);
    lines.push(`   C strictly above ${pct(input.m2.strictlyAboveShare)}   threshold 50%   (n=${input.m2.judgements})`);
    lines.push(`   ${m2Pass ? "PASS" : m2Stop ? "STOP — the product hypothesis has failed" : "MARGINAL — iterate"}`);
  } else lines.push("M2 AI-assisted, C vs A — not yet measured");

  // ── M3, editing time ─────────────────────────────────────────────────────
  lines.push("");
  let m3Pass = false;
  if (input.timings && input.timings.minutesPerCase.length > 0) {
    const med = median(input.timings.minutesPerCase);
    const worst = Math.max(...input.timings.minutesPerCase);
    const ratio = input.timings.firmBaselineMinutes ? med / input.timings.firmBaselineMinutes : null;
    m3Pass = med <= 45 && worst <= 90 && (ratio === null || ratio <= 0.4);
    lines.push(`M3 editing time B→C`);
    lines.push(`   median ${med.toFixed(0)} min   worst ${worst.toFixed(0)} min   threshold 45 / 90`);
    if (ratio !== null) lines.push(`   ${pct(ratio)} of the firm's own baseline   threshold 40%`);
    else lines.push(`   firm baseline not recorded — obtain it from the design partner`);
    lines.push(`   ${m3Pass ? "PASS" : "FAIL"}`);
  } else lines.push("M3 editing time B→C — not yet measured");

  // ── M4, edit taxonomy ────────────────────────────────────────────────────
  lines.push("");
  if (input.edits) {
    lines.push(`M4 edit taxonomy — polish versus fundamental`);
    lines.push(`   ${input.edits.total} edits, ${input.edits.materialTotal} material (${input.edits.materialPerCase.toFixed(1)} per case)`);
    lines.push(`   polish share ${pct(input.edits.polishShare)}   fundamental share ${pct(input.edits.fundamentalShare)}`);
    lines.push(`   signal: ${input.edits.signal.toUpperCase()}`);
    for (const n of input.edits.notes) lines.push(`   ! ${n}`);
    if (input.edits.hardFail) fails.push("material unsupported-claim corrections in variant C (M5 human layer)");
  } else lines.push("M4 edit taxonomy — not yet measured");

  // ── blinding integrity ───────────────────────────────────────────────────
  lines.push("");
  if (input.blindingIntegrity !== null) {
    lines.push(`Blinding integrity  ${pct(input.blindingIntegrity)}   must stay below 80%`);
    if (input.blindingIntegrity >= 0.8) {
      fails.push("blinding integrity 80% or above — fix the rendering and re-run, do not report with a caveat");
    }
  } else lines.push("Blinding integrity — not yet measured");

  // ── verdict ──────────────────────────────────────────────────────────────
  const humanEvidenceMissing = !input.m2 || !input.edits || !input.timings;
  let verdict: Verdict;
  if (fails.length > 0) verdict = "stop";
  else if (humanEvidenceMissing) verdict = "incomplete";
  else if (m2Stop) verdict = "stop";
  else if (input.edits && input.edits.materialPerCase > 6) verdict = "iterate";
  else if (m2Pass && m3Pass && input.edits?.signal !== "fundamental" && m6AtThreshold >= 4) verdict = "pass";
  else verdict = "iterate";

  return { verdict, hardFails: fails, lines, humanEvidenceMissing };
}

export const SYNTHETIC_WARNING = [
  "───────────────────────────────────────────────────────────────────────────",
  " Synthetic-case performance is NOT evidence of product quality.",
  " These cases were authored to exercise the engine; the scoring ground truth",
  " and the case itself share an author. They measure progress only.",
  "",
  " The evidence gates are: SME-reviewed cases, real paired cases with the",
  " firm's own working paper, and the blind human evaluation (07 §7.5, §7.9).",
  "───────────────────────────────────────────────────────────────────────────",
].join("\n");
