/**
 * @audit/engine — the Revenue Audit Intelligence Engine.
 *
 * The public surface below is the whole engine. Every interface — the Phase 0 CLI, the
 * Phase 1 web application, the client questionnaire, the future live cockpit and any
 * future audit-software integration — consumes exactly this and nothing else (07 §7.1).
 */
import type {
  Control, ControlGap, CoverageAssessment, FlowStep, GroundingReport, IngestedSource,
  MissingFact, NarrativeBlock, ProcessFact, RawInput, Risk, WorkingPaper,
} from "@audit/domain";
import { EngineContext } from "./context.ts";
import { ingest as ingestImpl } from "./ingest.ts";
import { evaluateCoverage, identifyMissingFacts } from "./coverage.ts";
import { validateGrounding, type GroundableEntry } from "./grounding.ts";
import { assembleOutputs, type EnginePartials } from "./assemble.ts";
import * as stages from "./stages.ts";

export interface RevenueAuditEngine {
  ingest(input: RawInput): IngestedSource;
  extractFacts(src: IngestedSource, ctx: EngineContext): Promise<ProcessFact[]>;
  evaluateCoverage(facts: ProcessFact[], ctx: EngineContext): CoverageAssessment;
  identifyMissingFacts(cov: CoverageAssessment, facts: ProcessFact[], ctx: EngineContext): MissingFact[];
  generateNarrative(facts: ProcessFact[], src: IngestedSource, ctx: EngineContext): Promise<NarrativeBlock[]>;
  generateFlow(facts: ProcessFact[], src: IngestedSource, ctx: EngineContext): Promise<FlowStep[]>;
  identifyRisks(facts: ProcessFact[], src: IngestedSource, ctx: EngineContext): Promise<Risk[]>;
  identifyControls(facts: ProcessFact[], risks: Risk[], src: IngestedSource, ctx: EngineContext): Promise<Control[]>;
  identifyGaps(risks: Risk[], controls: Control[], src: IngestedSource, ctx: EngineContext): Promise<ControlGap[]>;
  validateGrounding(entries: GroundableEntry[], src: IngestedSource, ctx: EngineContext): GroundingReport;
  assembleOutputs(parts: EnginePartials, ctx: EngineContext): WorkingPaper;
}

export const engine: RevenueAuditEngine = {
  ingest: ingestImpl,
  extractFacts: stages.extractFacts,
  evaluateCoverage: (facts, ctx) => evaluateCoverage(facts, ctx.pack, ctx.caseId),
  identifyMissingFacts: (cov, facts, ctx) => identifyMissingFacts(cov, facts, ctx.pack),
  generateNarrative: stages.generateNarrative,
  generateFlow: stages.generateFlow,
  identifyRisks: stages.identifyRisks,
  identifyControls: stages.identifyControls,
  identifyGaps: stages.identifyGaps,
  validateGrounding: (entries, src, ctx) =>
    validateGrounding(entries, src, {
      knownRiskIds: new Set(ctx.pack.risks.keys()),
      knownControlIds: new Set(ctx.pack.controls.keys()),
      runRiskIds: new Set(
        entries.filter((e) => e.kind === "risk").map((e) => e.obj.id),
      ),
    }),
  assembleOutputs,
};

/** One case, end to end. The CLI is a thin wrapper around this. */
export async function runCase(input: RawInput, ctx: EngineContext): Promise<WorkingPaper> {
  const src = engine.ingest(input);
  const facts = await engine.extractFacts(src, ctx);
  const coverage = engine.evaluateCoverage(facts, ctx);
  const openItems = engine.identifyMissingFacts(coverage, facts, ctx);

  const [narrative, flow] = await Promise.all([
    engine.generateNarrative(facts, src, ctx),
    engine.generateFlow(facts, src, ctx),
  ]);
  const risks = await engine.identifyRisks(facts, src, ctx);
  const controls = await engine.identifyControls(facts, risks, src, ctx);
  const gaps = await engine.identifyGaps(risks, controls, src, ctx);

  const entries: GroundableEntry[] = [
    ...facts.map((o) => ({ kind: "fact", obj: o as never })),
    ...narrative.map((o) => ({ kind: "narrative", obj: o as never })),
    ...flow.map((o) => ({ kind: "flow", obj: o as never })),
    ...risks.map((o) => ({ kind: "risk", obj: o as never })),
    ...controls.map((o) => ({ kind: "control", obj: o as never })),
    ...gaps.map((o) => ({ kind: "gap", obj: o as never })),
  ];
  const grounding = engine.validateGrounding(entries, src, ctx);

  return engine.assembleOutputs(
    { narrative, flow, risks, controls, gaps, coverage, openItems, grounding },
    ctx,
  );
}

export { EngineContext } from "./context.ts";
export { renderSourceForPrompt } from "./ingest.ts";
export { renderWorkingPaper } from "./render.ts";
export { validateGrounding, normalise, type GroundableEntry } from "./grounding.ts";
export { evaluateCoverage, identifyMissingFacts, evaluatePredicate } from "./coverage.ts";
export { assembleOutputs, unresolved, type EnginePartials } from "./assemble.ts";
export { AnthropicLlmClient, MockLlmClient, MODELS, costOf, type LlmClient } from "./llm.ts";
