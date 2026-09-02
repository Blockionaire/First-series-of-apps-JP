import type { CoverageAssessment, MissingFact, Risk, Control, GroundingReport } from "@audit/domain";
import type { AnswerKey } from "./corpus.ts";

/**
 * M6 — automatic metrics (07 §7.8). Matching is deliberately conservative: a library id
 * match is exact; a free-text match requires a strong token overlap. A generous matcher
 * would flatter the engine and corrupt the experiment.
 */

const STOP = new Set(["the","a","an","of","to","and","or","is","are","in","on","for","by","not","that","with","as","at","be","it"]);

export function tokens(s: string): Set<string> {
  return new Set(
    s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/)
      .filter((w) => w.length > 2 && !STOP.has(w)),
  );
}

export function similarity(a: string, b: string): number {
  const ta = tokens(a), tb = tokens(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared++;
  return shared / Math.min(ta.size, tb.size);
}

export const MATCH_THRESHOLD = 0.6;

export interface RecallResult {
  expected: number;
  found: number;
  recall: number;
  missed: string[];
}

export function recallOf(
  expected: { libraryRef: string | null; title: string }[],
  produced: { libraryRef: string | null; title: string }[],
): RecallResult {
  const missed: string[] = [];
  let found = 0;
  for (const e of expected) {
    const hit = produced.some(
      (p) =>
        (e.libraryRef && p.libraryRef === e.libraryRef) ||
        similarity(e.title, p.title) >= MATCH_THRESHOLD,
    );
    if (hit) found++;
    else missed.push(e.libraryRef ?? e.title);
  }
  return {
    expected: expected.length,
    found,
    recall: expected.length === 0 ? 1 : found / expected.length,
    missed,
  };
}

export interface CaseMetrics {
  caseId: string;
  groundingIntegrityOk: boolean;
  groundedShare: number;
  needsSourceCount: number;
  mandatoryOpen: number;
  coveragePct: number;
  coverageRecall: number;
  riskRecallVsFirm: number;
  riskRecallVsExpert: number;
  controlRecall: number;
  missingFactDetection: number;
  riskCount: number;
  controlCount: number;
}

export function scoreCase(args: {
  caseId: string;
  key: AnswerKey;
  risks: Risk[];
  controls: Control[];
  coverage: CoverageAssessment;
  missing: MissingFact[];
  grounding: GroundingReport;
}): CaseMetrics {
  const { key, risks, controls, coverage, missing, grounding } = args;

  const firmRisks = key.risks.filter((r) => r.source !== "sme_addition");
  const allRisks = key.risks;

  const coveredNow = new Set(
    coverage.items.filter((i) => i.state === "covered").map((i) => i.coverageItemId),
  );
  const coverageRecall =
    key.coveredItems.length === 0
      ? 1
      : key.coveredItems.filter((i) => coveredNow.has(i)).length / key.coveredItems.length;

  const missingKeys = new Set(missing.map((m) => `${m.coverageItemId}::${m.factKey ?? ""}`));
  const missingItems = new Set(missing.map((m) => m.coverageItemId));
  const detected =
    key.expectedMissing.length === 0
      ? 1
      : key.expectedMissing.filter((e) => missingKeys.has(e) || missingItems.has(e.split("::")[0]!))
          .length / key.expectedMissing.length;

  return {
    caseId: args.caseId,
    groundingIntegrityOk: grounding.integrityOk,
    groundedShare: grounding.total === 0 ? 1 : grounding.grounded / grounding.total,
    needsSourceCount: grounding.needsSource.length,
    mandatoryOpen: coverage.mandatoryOpen.length,
    coveragePct: coverage.coveragePct,
    coverageRecall,
    riskRecallVsFirm: recallOf(firmRisks, risks).recall,
    riskRecallVsExpert: recallOf(allRisks, risks).recall,
    controlRecall: recallOf(key.controls, controls).recall,
    missingFactDetection: detected,
    riskCount: risks.length,
    controlCount: controls.length,
  };
}

/** Suite-level roll-up with spread, because a mean alone hides run-to-run variance. */
export function summarise(all: CaseMetrics[]) {
  const mean = (f: (m: CaseMetrics) => number) =>
    all.length === 0 ? 0 : all.reduce((n, m) => n + f(m), 0) / all.length;
  const sd = (f: (m: CaseMetrics) => number) => {
    if (all.length < 2) return 0;
    const mu = mean(f);
    return Math.sqrt(all.reduce((n, m) => n + (f(m) - mu) ** 2, 0) / (all.length - 1));
  };
  return {
    cases: all.length,
    groundingIntegrityOk: all.every((m) => m.groundingIntegrityOk),
    groundedShare: mean((m) => m.groundedShare),
    coverageRecall: { mean: mean((m) => m.coverageRecall), sd: sd((m) => m.coverageRecall) },
    riskRecallVsFirm: { mean: mean((m) => m.riskRecallVsFirm), sd: sd((m) => m.riskRecallVsFirm) },
    riskRecallVsExpert: { mean: mean((m) => m.riskRecallVsExpert), sd: sd((m) => m.riskRecallVsExpert) },
    controlRecall: { mean: mean((m) => m.controlRecall), sd: sd((m) => m.controlRecall) },
    missingFactDetection: { mean: mean((m) => m.missingFactDetection), sd: sd((m) => m.missingFactDetection) },
  };
}

/** 07 §7.8 hard fails. Any true value blocks the gate regardless of everything else. */
export function hardFails(all: CaseMetrics[]): string[] {
  const fails: string[] = [];
  if (all.some((m) => !m.groundingIntegrityOk)) fails.push("cross-case reference leakage detected");
  if (all.some((m) => m.groundedShare < 1)) fails.push("objects flagged needs_source in output");
  return fails;
}
