import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { RunManifest } from "@audit/domain";

/**
 * Model cost per pipeline stage and per complete case, read from the run manifests.
 * Required from the first live API run onward; under the mock client the figures are zero
 * and the command still works, so the reporting is in place before it is needed.
 */

export interface StageCost {
  stage: string;
  runs: number;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  costUsd: number;
  meanLatencyMs: number;
}

export interface CaseCost {
  caseId: string;
  runs: number;
  costUsd: number;
  meanCostPerRunUsd: number;
  meanLatencyMs: number;
}

export interface CostReport {
  manifests: number;
  byStage: StageCost[];
  byCase: CaseCost[];
  totalUsd: number;
  cacheHitRate: number;
}

export function loadManifests(outDir: string): RunManifest[] {
  if (!existsSync(outDir)) return [];
  const out: RunManifest[] = [];
  for (const caseDir of readdirSync(outDir, { withFileTypes: true }).filter((d) => d.isDirectory())) {
    const base = join(outDir, caseDir.name);
    for (const runDir of readdirSync(base, { withFileTypes: true }).filter((d) => d.isDirectory())) {
      const f = join(base, runDir.name, "run.json");
      if (existsSync(f)) out.push(JSON.parse(readFileSync(f, "utf8")) as RunManifest);
    }
  }
  return out;
}

export function costReport(manifests: RunManifest[]): CostReport {
  const stages = new Map<string, StageCost>();
  const cases = new Map<string, CaseCost>();
  let cacheRead = 0, cacheEligible = 0;

  for (const m of manifests) {
    const c = cases.get(m.caseId) ?? {
      caseId: m.caseId, runs: 0, costUsd: 0, meanCostPerRunUsd: 0, meanLatencyMs: 0,
    };
    c.runs++;
    c.costUsd += m.totalCostUsd;
    c.meanLatencyMs += m.totalLatencyMs;
    cases.set(m.caseId, c);

    for (const s of m.stages) {
      const acc = stages.get(s.stage) ?? {
        stage: s.stage, runs: 0, model: s.model, inputTokens: 0, outputTokens: 0,
        cacheReadTokens: 0, costUsd: 0, meanLatencyMs: 0,
      };
      acc.runs++;
      acc.model = s.model;
      acc.inputTokens += s.inputTokens;
      acc.outputTokens += s.outputTokens;
      acc.cacheReadTokens += s.cacheReadTokens;
      acc.costUsd += s.costUsd;
      acc.meanLatencyMs += s.latencyMs;
      stages.set(s.stage, acc);

      cacheRead += s.cacheReadTokens;
      cacheEligible += s.cacheReadTokens + s.inputTokens;
    }
  }

  for (const s of stages.values()) s.meanLatencyMs = Math.round(s.meanLatencyMs / Math.max(s.runs, 1));
  for (const c of cases.values()) {
    c.meanCostPerRunUsd = c.costUsd / Math.max(c.runs, 1);
    c.meanLatencyMs = Math.round(c.meanLatencyMs / Math.max(c.runs, 1));
  }

  return {
    manifests: manifests.length,
    byStage: [...stages.values()].sort((a, b) => b.costUsd - a.costUsd),
    byCase: [...cases.values()].sort((a, b) => a.caseId.localeCompare(b.caseId)),
    totalUsd: manifests.reduce((n, m) => n + m.totalCostUsd, 0),
    // Below 90% on suite runs means a silent cache invalidator, and it shows up
    // directly in the phase budget (06 §6.4).
    cacheHitRate: cacheEligible === 0 ? 0 : cacheRead / cacheEligible,
  };
}
