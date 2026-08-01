import { db } from "./db";

/**
 * The peer benchmark.
 *
 * This is the seed of STAI's most defensible asset: the only dataset on how
 * European audit firms actually deploy AI. It grows with every assessment.
 *
 * Honesty rule: a benchmark computed from a handful of responses is noise
 * wearing a percentile. Nothing is shown until MIN_SAMPLE is reached, and the
 * sample size is always displayed alongside the comparison so the reader can
 * judge its weight — exactly what we would demand of anyone else's statistic.
 */
export const MIN_SAMPLE = 25;

export type Benchmark = {
  ready: boolean;
  sample: number;
  cohort: string;
  median: number | null;
  percentile: number | null;
  /** Median score per dimension across the cohort, for the gap read. */
  dimensionMedians: Record<string, number> | null;
};

type Row = { score: number; answers: string; firm_size: string };

export function computeBenchmark(score: number, firmSize: string): Benchmark {
  const d = db();

  // Prefer a same-size cohort; fall back to all firms if it's too thin.
  let rows: Row[] = [];
  let cohort = "";

  if (firmSize) {
    rows = d
      .prepare("SELECT score, answers, firm_size FROM assessments WHERE firm_size = ?")
      .all(firmSize) as Row[];
    cohort = `${firmSize.toLowerCase()} firms`;
  }
  if (rows.length < MIN_SAMPLE) {
    rows = d.prepare("SELECT score, answers, firm_size FROM assessments").all() as Row[];
    cohort = "all European firms assessed";
  }

  const sample = rows.length;
  if (sample < MIN_SAMPLE) {
    return { ready: false, sample, cohort, median: null, percentile: null, dimensionMedians: null };
  }

  const scores = rows.map((r) => r.score).sort((a, b) => a - b);
  const median = scores[Math.floor(scores.length / 2)];
  const below = scores.filter((s) => s < score).length;
  const percentile = Math.round((below / scores.length) * 100);

  // Per-dimension medians: questions are grouped two per dimension, in order.
  const dims = ["Governance", "People", "Practice", "Evidence"];
  const perDim: Record<string, number[]> = { Governance: [], People: [], Practice: [], Evidence: [] };
  for (const r of rows) {
    let answers: number[] = [];
    try {
      answers = JSON.parse(r.answers);
    } catch {
      continue;
    }
    dims.forEach((dim, i) => {
      const pair = (answers[i * 2] ?? 0) + (answers[i * 2 + 1] ?? 0);
      perDim[dim].push(pair);
    });
  }
  const dimensionMedians: Record<string, number> = {};
  for (const dim of dims) {
    const arr = perDim[dim].sort((a, b) => a - b);
    dimensionMedians[dim] = arr.length ? arr[Math.floor(arr.length / 2)] : 0;
  }

  return { ready: true, sample, cohort, median, percentile, dimensionMedians };
}
