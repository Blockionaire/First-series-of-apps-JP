/**
 * @audit/domain — the Phase 0 contract.
 *
 * Every schema here is the single definition used for TypeScript types, runtime validation
 * and the model's structured-output schema. Nothing in this package imports anything else.
 *
 * `engagementId` is carried from the start even though Phase 0 has one case per folder:
 * it costs nothing now and avoids a schema migration in Phase 1 (see 07 §7.4).
 */
import { z } from "zod";

/* ── Fixed vocabularies (02 §2.2, §2.3) ───────────────────────────────────── */

/** Assertions per ISA 315 (Revised 2019). Changing this enum rewrites every record. */
export const Assertion = z.enum([
  // classes of transactions and events
  "occurrence",
  "completeness",
  "accuracy",
  "cutoff",
  "classification",
  "presentation",
  // account balances
  "existence",
  "rights_and_obligations",
  "accuracy_valuation_allocation",
]);
export type Assertion = z.infer<typeof Assertion>;

export const InherentRiskFactor = z.enum([
  "complexity",
  "subjectivity",
  "change",
  "uncertainty",
  "susceptibility_to_bias_or_fraud",
]);
export type InherentRiskFactor = z.infer<typeof InherentRiskFactor>;

export const InherentRiskRating = z.enum(["lower", "moderate", "higher"]);
export const ControlType = z.enum(["preventive", "detective"]);
export const ControlNature = z.enum(["manual", "automated", "it_dependent_manual"]);
export const ControlFrequency = z.enum([
  "per_transaction",
  "daily",
  "weekly",
  "monthly",
  "quarterly",
  "annual",
  "event_driven",
]);

/** Data classification (07 §7.2). Recorded on every run so it can be audited later. */
export const DataClass = z.enum(["C0", "C1", "C2", "C3"]);
export type DataClass = z.infer<typeof DataClass>;

/* ── Provenance ───────────────────────────────────────────────────────────── */

export const SourceLocator = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("transcript"),
    segmentId: z.string(),
    charFrom: z.number().int().nonnegative(),
    charTo: z.number().int().nonnegative(),
  }),
  z.object({
    kind: z.literal("note"),
    noteId: z.string(),
    charFrom: z.number().int().nonnegative(),
    charTo: z.number().int().nonnegative(),
  }),
  z.object({
    kind: z.literal("document"),
    documentId: z.string(),
    page: z.number().int().nullable(),
    charFrom: z.number().int().nonnegative(),
    charTo: z.number().int().nonnegative(),
  }),
]);
export type SourceLocator = z.infer<typeof SourceLocator>;

export const EvidenceRef = z.object({
  locator: SourceLocator,
  /** Must occur verbatim in the located span after normalisation. Checked in code. */
  quote: z.string().min(8).max(600),
  /** Who said it — relevant to the reliability of the evidence. */
  speaker: z.string().nullable(),
});
export type EvidenceRef = z.infer<typeof EvidenceRef>;

export const GroundingState = z.enum(["grounded", "needs_source", "human_authored"]);
export type GroundingState = z.infer<typeof GroundingState>;

/** Fields every generated object carries. Nothing consequential is persisted without them. */
export const GroundableBase = z.object({
  id: z.string(),
  engagementId: z.string(),
  evidenceRefs: z.array(EvidenceRef).min(1),
  grounding: GroundingState.default("grounded"),
});

/* ── Ingest ───────────────────────────────────────────────────────────────── */

export const TranscriptSegment = z.object({
  segmentId: z.string(),
  ordinal: z.number().int().nonnegative(),
  speaker: z.string().nullable(),
  speakerRole: z.string().nullable(),
  tStartMs: z.number().int().nullable(),
  tEndMs: z.number().int().nullable(),
  text: z.string(),
});
export type TranscriptSegment = z.infer<typeof TranscriptSegment>;

export const IngestedSource = z.object({
  caseId: z.string(),
  engagementId: z.string(),
  language: z.enum(["nl", "en", "de"]),
  sourceClass: DataClass,
  segments: z.array(TranscriptSegment),
  /** Entity, systems, revenue streams. Short free text; part of the cached prompt prefix. */
  clientProfile: z.string().nullable(),
});
export type IngestedSource = z.infer<typeof IngestedSource>;

export const RawInput = z.object({
  caseId: z.string(),
  engagementId: z.string(),
  language: z.enum(["nl", "en", "de"]).default("en"),
  sourceClass: DataClass.default("C0"),
  format: z.enum(["plaintext", "vtt"]).default("plaintext"),
  content: z.string(),
  clientProfile: z.string().nullable().default(null),
});
export type RawInput = z.infer<typeof RawInput>;

/* ── Facts and coverage ───────────────────────────────────────────────────── */

/** The five states the brief requires the system to distinguish. */
export const FactStatus = z.enum([
  "known",
  "unknown",
  "contradictory",
  "insufficiently_evidenced",
  "not_applicable",
]);
export type FactStatus = z.infer<typeof FactStatus>;

export const ProcessFact = GroundableBase.extend({
  coverageItemId: z.string(),
  factKey: z.string(),
  value: z.string().nullable(),
  status: FactStatus,
  conflictingValues: z
    .array(z.object({ value: z.string(), ref: EvidenceRef }))
    .default([]),
  actors: z.array(z.string()).default([]),
  systems: z.array(z.string()).default([]),
  certainty: z.enum(["stated", "implied", "assumed"]),
});
export type ProcessFact = z.infer<typeof ProcessFact>;

export const CoverageState = z.enum(["open", "partial", "covered", "not_applicable"]);
export type CoverageState = z.infer<typeof CoverageState>;

export const CoverageItemState = z.object({
  coverageItemId: z.string(),
  subProcess: z.string(),
  mandatory: z.boolean(),
  state: CoverageState,
  /** Required when not_applicable — the reason itself becomes documentation. */
  notApplicableReason: z.string().nullable(),
  factStatuses: z.record(z.string(), FactStatus),
  flags: z.array(z.enum(["contradiction", "weak_evidence"])).default([]),
});
export type CoverageItemState = z.infer<typeof CoverageItemState>;

export const CoverageAssessment = z.object({
  caseId: z.string(),
  packVersion: z.string(),
  items: z.array(CoverageItemState),
  coveragePct: z.number().min(0).max(100),
  mandatoryOpen: z.array(z.string()),
});
export type CoverageAssessment = z.infer<typeof CoverageAssessment>;

export const MissingFact = z.object({
  coverageItemId: z.string(),
  factKey: z.string().nullable(),
  why: z.string(),
  question: z.string(),
  origin: z.enum(["deterministic_trigger", "model_proposed"]),
  priority: z.enum(["mandatory", "high", "medium", "low"]),
  triggerId: z.string().nullable().default(null),
});
export type MissingFact = z.infer<typeof MissingFact>;

/* ── Generated audit content ──────────────────────────────────────────────── */

export const NarrativeBlock = GroundableBase.extend({
  subProcess: z.string(),
  heading: z.string(),
  body: z.string(),
  /** "Not obtained" is first-class output — an incomplete walkthrough must look incomplete. */
  openPoints: z.array(z.string()).default([]),
});
export type NarrativeBlock = z.infer<typeof NarrativeBlock>;

export const FlowStep = GroundableBase.extend({
  seq: z.number().int(),
  subProcess: z.string(),
  actor: z.string(),
  system: z.string().nullable(),
  action: z.string(),
  input: z.string().nullable(),
  output: z.string().nullable(),
  isDecision: z.boolean().default(false),
  controlIds: z.array(z.string()).default([]),
});
export type FlowStep = z.infer<typeof FlowStep>;

export const Risk = GroundableBase.extend({
  libraryRef: z.string().nullable(),
  /** Required when libraryRef is null; enforced by the validator, not by the prompt. */
  newRiskJustification: z.string().nullable(),
  title: z.string(),
  description: z.string(),
  subProcess: z.string(),
  assertions: z.array(Assertion).min(1),
  inherentRiskFactors: z.array(InherentRiskFactor).min(1),
  inherentRiskRating: InherentRiskRating,
  /** Proposal only. Whether a risk is significant is the auditor's conclusion. */
  significantRiskCandidate: z.boolean(),
  fraudRelated: z.boolean(),
  drivers: z.array(z.string()).default([]),
});
export type Risk = z.infer<typeof Risk>;

export const Control = GroundableBase.extend({
  libraryRef: z.string().nullable(),
  title: z.string(),
  description: z.string(),
  subProcess: z.string(),
  addressesRiskIds: z.array(z.string()).min(1),
  assertions: z.array(Assertion).min(1),
  controlType: ControlType,
  controlNature: ControlNature,
  frequency: ControlFrequency,
  ownerRole: z.string().nullable(),
  ipeUsed: z.string().nullable(),
  evidenceOfOperation: z.string().nullable(),
  /** Proposal only. Key-control designation is the auditor's decision. */
  keyControlCandidate: z.boolean(),
});
export type Control = z.infer<typeof Control>;

export const ControlGap = GroundableBase.extend({
  riskId: z.string(),
  description: z.string(),
  gapType: z.enum([
    "no_control",
    "control_not_precise",
    "control_undocumented",
    "information_missing",
  ]),
  potentialImpact: z.string(),
});
export type ControlGap = z.infer<typeof ControlGap>;

/* ── Validation and assembly ──────────────────────────────────────────────── */

export const GroundingFailureReason = z.enum([
  "no_ref",
  "ref_unresolvable",
  "quote_not_found",
  "ref_outside_engagement",
  "missing_new_risk_justification",
  "unknown_library_ref",
  "dangling_risk_reference",
]);
export type GroundingFailureReason = z.infer<typeof GroundingFailureReason>;

export const GroundingReport = z.object({
  total: z.number().int(),
  grounded: z.number().int(),
  needsSource: z.array(
    z.object({
      objectId: z.string(),
      kind: z.string(),
      reason: GroundingFailureReason,
      detail: z.string().nullable(),
    }),
  ),
  /** False if any reference pointed outside this case — a hard fail (07 §7.8 M5). */
  integrityOk: z.boolean(),
});
export type GroundingReport = z.infer<typeof GroundingReport>;

export const WorkingPaper = z.object({
  caseId: z.string(),
  engagementId: z.string(),
  packVersion: z.string(),
  runId: z.string(),
  generatedAt: z.string(),
  narrative: z.array(NarrativeBlock),
  flow: z.array(FlowStep),
  risks: z.array(Risk),
  controls: z.array(Control),
  gaps: z.array(ControlGap),
  coverage: CoverageAssessment,
  openItems: z.array(MissingFact),
  grounding: GroundingReport,
  provenanceIndex: z.array(
    z.object({ objectId: z.string(), kind: z.string(), refs: z.array(EvidenceRef) }),
  ),
});
export type WorkingPaper = z.infer<typeof WorkingPaper>;

/* ── Run manifest ─────────────────────────────────────────────────────────── */

export const StageRecord = z.object({
  stage: z.string(),
  model: z.string(),
  promptVersion: z.string(),
  promptHash: z.string(),
  inputHash: z.string(),
  inputTokens: z.number().int(),
  outputTokens: z.number().int(),
  cacheReadTokens: z.number().int(),
  cacheWriteTokens: z.number().int(),
  costUsd: z.number(),
  latencyMs: z.number().int(),
  ok: z.boolean(),
  error: z.string().nullable(),
});
export type StageRecord = z.infer<typeof StageRecord>;

export const RunManifest = z.object({
  runId: z.string(),
  caseId: z.string(),
  engagementId: z.string(),
  packVersion: z.string(),
  schemaVersion: z.string(),
  sourceClass: DataClass,
  startedAt: z.string(),
  finishedAt: z.string().nullable(),
  stages: z.array(StageRecord),
  totalCostUsd: z.number(),
  totalLatencyMs: z.number().int(),
});
export type RunManifest = z.infer<typeof RunManifest>;

export const SCHEMA_VERSION = "0.1.0";

/** Anything the grounding validator can check. */
export type Groundable = {
  id: string;
  engagementId: string;
  evidenceRefs: EvidenceRef[];
  grounding: GroundingState;
};
