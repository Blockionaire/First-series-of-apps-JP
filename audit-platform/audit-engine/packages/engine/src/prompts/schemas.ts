import { z } from "zod";
import { Assertion, InherentRiskFactor, ControlType, ControlNature, ControlFrequency, FactStatus } from "@audit/domain";

/**
 * Model-facing "draft" schemas. The model never invents ids, engagement ids or grounding
 * states — the engine assigns those. Keeping the model's surface this narrow is what makes
 * the output checkable.
 */

export const DraftRef = z.object({
  segmentId: z.string(),
  quote: z.string(),
  speaker: z.string().nullable(),
});

export const DraftFact = z.object({
  coverageItemId: z.string(),
  factKey: z.string(),
  value: z.string().nullable(),
  status: FactStatus,
  conflictingValues: z.array(z.object({ value: z.string(), segmentId: z.string(), quote: z.string() })).default([]),
  actors: z.array(z.string()).default([]),
  systems: z.array(z.string()).default([]),
  certainty: z.enum(["stated", "implied", "assumed"]),
  refs: z.array(DraftRef).min(1),
});
export const DraftFacts = z.object({ facts: z.array(DraftFact) });

export const DraftNarrative = z.object({
  blocks: z.array(
    z.object({
      subProcess: z.string(),
      heading: z.string(),
      body: z.string(),
      openPoints: z.array(z.string()).default([]),
      refs: z.array(DraftRef).min(1),
    }),
  ),
});

export const DraftFlow = z.object({
  steps: z.array(
    z.object({
      seq: z.number().int(),
      subProcess: z.string(),
      actor: z.string(),
      system: z.string().nullable(),
      action: z.string(),
      input: z.string().nullable(),
      output: z.string().nullable(),
      isDecision: z.boolean().default(false),
      refs: z.array(DraftRef).min(1),
    }),
  ),
});

export const DraftRisks = z.object({
  risks: z.array(
    z.object({
      libraryRef: z.string().nullable(),
      newRiskJustification: z.string().nullable(),
      title: z.string(),
      description: z.string(),
      subProcess: z.string(),
      assertions: z.array(Assertion).min(1),
      inherentRiskFactors: z.array(InherentRiskFactor).min(1),
      inherentRiskRating: z.enum(["lower", "moderate", "higher"]),
      significantRiskCandidate: z.boolean(),
      fraudRelated: z.boolean(),
      drivers: z.array(z.string()).default([]),
      refs: z.array(DraftRef).min(1),
    }),
  ),
});

export const DraftControls = z.object({
  controls: z.array(
    z.object({
      libraryRef: z.string().nullable(),
      title: z.string(),
      description: z.string(),
      subProcess: z.string(),
      addressesRiskTitles: z.array(z.string()).min(1),
      assertions: z.array(Assertion).min(1),
      controlType: ControlType,
      controlNature: ControlNature,
      frequency: ControlFrequency,
      ownerRole: z.string().nullable(),
      ipeUsed: z.string().nullable(),
      evidenceOfOperation: z.string().nullable(),
      keyControlCandidate: z.boolean(),
      refs: z.array(DraftRef).min(1),
    }),
  ),
});

export const DraftGaps = z.object({
  gaps: z.array(
    z.object({
      riskTitle: z.string(),
      description: z.string(),
      gapType: z.enum(["no_control", "control_not_precise", "control_undocumented", "information_missing"]),
      potentialImpact: z.string(),
      refs: z.array(DraftRef).min(1),
    }),
  ),
});
