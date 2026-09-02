import type {
  Control, ControlGap, CoverageAssessment, FlowStep, GroundingReport, MissingFact,
  NarrativeBlock, Risk, WorkingPaper,
} from "@audit/domain";
import type { EngineContext } from "./context.ts";

export interface EnginePartials {
  narrative: NarrativeBlock[];
  flow: FlowStep[];
  risks: Risk[];
  controls: Control[];
  gaps: ControlGap[];
  coverage: CoverageAssessment;
  openItems: MissingFact[];
  grounding: GroundingReport;
}

/**
 * Deterministic. No model call.
 *
 * Objects flagged `needs_source` are carried into the working paper and rendered as
 * flagged — never dropped, never presented as supported (07 §7.8 M5).
 */
export function assembleOutputs(parts: EnginePartials, ctx: EngineContext): WorkingPaper {
  const all = [
    ...parts.narrative.map((o) => ({ kind: "narrative", o })),
    ...parts.flow.map((o) => ({ kind: "flow", o })),
    ...parts.risks.map((o) => ({ kind: "risk", o })),
    ...parts.controls.map((o) => ({ kind: "control", o })),
    ...parts.gaps.map((o) => ({ kind: "gap", o })),
  ];

  return {
    caseId: ctx.caseId,
    engagementId: ctx.engagementId,
    packVersion: ctx.pack.version,
    runId: ctx.runId,
    generatedAt: new Date().toISOString(),
    narrative: [...parts.narrative].sort((a, b) => a.subProcess.localeCompare(b.subProcess, undefined, { numeric: true })),
    flow: [...parts.flow].sort((a, b) => a.seq - b.seq),
    risks: parts.risks,
    controls: parts.controls,
    gaps: parts.gaps,
    coverage: parts.coverage,
    openItems: parts.openItems,
    grounding: parts.grounding,
    provenanceIndex: all.map(({ kind, o }) => ({ objectId: o.id, kind, refs: o.evidenceRefs })),
  };
}

/** Objects an auditor must resolve before the paper could be approved. */
export function unresolved(wp: WorkingPaper): string[] {
  return wp.provenanceIndex
    .filter((p) => wp.grounding.needsSource.some((n) => n.objectId === p.objectId))
    .map((p) => p.objectId);
}
