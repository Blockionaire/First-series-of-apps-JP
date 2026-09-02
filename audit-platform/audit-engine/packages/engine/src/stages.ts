import { createHash } from "node:crypto";
import type {
  Control, ControlGap, EvidenceRef, FlowStep, IngestedSource, NarrativeBlock, ProcessFact, Risk,
} from "@audit/domain";
import { EngineContext, hash } from "./context.ts";
import { renderSourceForPrompt } from "./ingest.ts";
import { STANDING_RULES, packPrompt, profilePrompt, RESTATED_RULE } from "./prompts/system.ts";
import {
  DraftControls, DraftFacts, DraftFlow, DraftGaps, DraftNarrative, DraftRisks, type DraftRef,
} from "./prompts/schemas.ts";
import type { z } from "zod";

/* ── helpers ──────────────────────────────────────────────────────────────── */

type Ref = z.infer<typeof DraftRef>;

function stableId(kind: string, ...parts: (string | number)[]): string {
  const h = createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 10);
  return `${kind}_${h}`;
}

/**
 * Locate the quote inside the cited segment so the reference carries a char range.
 * If the quote is not found the range is 0..0 — the grounding validator will catch it.
 * The engine never silently repairs a bad citation.
 */
function toEvidenceRef(ref: Ref, src: IngestedSource): EvidenceRef {
  const seg = src.segments.find((s) => s.segmentId === ref.segmentId);
  const idx = seg ? seg.text.toLowerCase().indexOf(ref.quote.toLowerCase().trim()) : -1;
  return {
    locator: {
      kind: "transcript",
      segmentId: ref.segmentId,
      charFrom: idx >= 0 ? idx : 0,
      charTo: idx >= 0 ? idx + ref.quote.trim().length : 0,
    },
    quote: ref.quote.trim().slice(0, 600),
    speaker: ref.speaker ?? seg?.speaker ?? null,
  };
}

function systemBlocks(ctx: EngineContext): string[] {
  // Order is most-stable first; the cache breakpoint goes after the last block.
  return [STANDING_RULES, packPrompt(ctx.pack), profilePrompt(ctx.clientProfile)];
}

async function run<T extends z.ZodTypeAny>(
  ctx: EngineContext,
  stage: string,
  model: "reasoning" | "extraction" | "cheap",
  effort: "low" | "medium" | "high",
  schema: T,
  task: string,
  evidence: string[],
): Promise<z.infer<T>> {
  const system = systemBlocks(ctx);
  const userBlocks = [...evidence, task, RESTATED_RULE];
  const result = await ctx.llm.generate({
    model, effort, schema, systemBlocks: system, userBlocks,
  });
  ctx.record(stage, hash(system.join("\n") + task), hash(userBlocks.join("\n")), result);
  return result.value;
}

/* ── S3 extractFacts ──────────────────────────────────────────────────────── */

export async function extractFacts(src: IngestedSource, ctx: EngineContext): Promise<ProcessFact[]> {
  const out = await run(
    ctx, "extractFacts", "extraction", "medium", DraftFacts,
    `TASK. Read the evidence and extract the coverage-item facts listed in the methodology pack.

For every fact you can address, return one object with the coverage item id, the fact key, the value in one short sentence, and a status:
- known: stated or clearly implied, with a quote that supports it
- contradictory: the evidence says two incompatible things; put both in conflictingValues
- insufficiently_evidenced: mentioned but too vague to rely on
- not_applicable: the evidence establishes the fact does not apply to this entity
Do not return "unknown" facts — omit them entirely; their absence is what drives follow-up questions.

Return facts only. No narrative, no risks, no controls.`,
    [`<evidence kind="transcript">\n${renderSourceForPrompt(src)}\n</evidence>`],
  );

  return out.facts.map((f) => ({
    id: stableId("fact", f.coverageItemId, f.factKey),
    engagementId: src.engagementId,
    coverageItemId: f.coverageItemId,
    factKey: f.factKey,
    value: f.value,
    status: f.status,
    conflictingValues: f.conflictingValues.map((c) => ({
      value: c.value,
      ref: toEvidenceRef({ segmentId: c.segmentId, quote: c.quote, speaker: null }, src),
    })),
    actors: f.actors,
    systems: f.systems,
    certainty: f.certainty,
    evidenceRefs: f.refs.map((r) => toEvidenceRef(r, src)),
    grounding: "grounded" as const,
  }));
}

/* ── S4 narrative and flow ────────────────────────────────────────────────── */

export async function generateNarrative(
  facts: ProcessFact[], src: IngestedSource, ctx: EngineContext,
): Promise<NarrativeBlock[]> {
  const out = await run(
    ctx, "generateNarrative", "reasoning", "high", DraftNarrative,
    `TASK. Write the process narrative, one block per sub-process for which there are facts.

Each block: a heading, and a body of 80-200 words describing what happens, who does it, in which system, and what happens when it goes wrong. Past tense, specific, no hedging. Where an auditor would expect information that the evidence does not provide, list it in openPoints rather than glossing over it.

Do not write about sub-processes with no facts. Do not repeat the transcript; describe the process.`,
    [
      `<evidence kind="process_facts">\n${JSON.stringify(facts.map(({ coverageItemId, factKey, value, status, actors, systems }) => ({ coverageItemId, factKey, value, status, actors, systems })), null, 1)}\n</evidence>`,
      `<evidence kind="transcript">\n${renderSourceForPrompt(src)}\n</evidence>`,
    ],
  );

  return out.blocks.map((b, i) => ({
    id: stableId("narr", b.subProcess, String(i)),
    engagementId: src.engagementId,
    subProcess: b.subProcess,
    heading: b.heading,
    body: b.body,
    openPoints: b.openPoints,
    evidenceRefs: b.refs.map((r) => toEvidenceRef(r, src)),
    grounding: "grounded" as const,
  }));
}

export async function generateFlow(
  facts: ProcessFact[], src: IngestedSource, ctx: EngineContext,
): Promise<FlowStep[]> {
  const out = await run(
    ctx, "generateFlow", "reasoning", "medium", DraftFlow,
    `TASK. Produce the flow of transactions from initiation to recording in the general ledger, as ordered steps.

One step per action: who does it, in which system, what goes in, what comes out. Mark decision points. Cover the path an ordinary sale takes; do not invent steps the evidence does not support.`,
    [
      `<evidence kind="process_facts">\n${JSON.stringify(facts.map(({ coverageItemId, factKey, value, actors, systems }) => ({ coverageItemId, factKey, value, actors, systems })), null, 1)}\n</evidence>`,
      `<evidence kind="transcript">\n${renderSourceForPrompt(src)}\n</evidence>`,
    ],
  );

  return out.steps.map((s) => ({
    id: stableId("flow", String(s.seq), s.action),
    engagementId: src.engagementId,
    seq: s.seq,
    subProcess: s.subProcess,
    actor: s.actor,
    system: s.system,
    action: s.action,
    input: s.input,
    output: s.output,
    isDecision: s.isDecision,
    controlIds: [],
    evidenceRefs: s.refs.map((r) => toEvidenceRef(r, src)),
    grounding: "grounded" as const,
  }));
}

/* ── S5 risks ─────────────────────────────────────────────────────────────── */

export async function identifyRisks(
  facts: ProcessFact[], src: IngestedSource, ctx: EngineContext,
): Promise<Risk[]> {
  const out = await run(
    ctx, "identifyRisks", "reasoning", "high", DraftRisks,
    `TASK. Identify the risks of material misstatement at assertion level arising from this process.

For each: use a risk library id where one fits, otherwise set libraryRef to null and explain in newRiskJustification why no library entry applies. State the assertions affected, the inherent risk factors, where it sits on the spectrum, whether it is fraud-related, and — most important — the DRIVERS: what about THIS entity, in the evidence, makes the risk real. A risk with no entity-specific driver is a textbook risk and should not be reported.

significantRiskCandidate is a proposal for the auditor to decide, never a conclusion.`,
    [
      `<evidence kind="process_facts">\n${JSON.stringify(facts.map(({ coverageItemId, factKey, value, status }) => ({ coverageItemId, factKey, value, status })), null, 1)}\n</evidence>`,
      `<evidence kind="transcript">\n${renderSourceForPrompt(src)}\n</evidence>`,
    ],
  );

  return out.risks.map((r) => ({
    id: stableId("risk", r.libraryRef ?? r.title, r.subProcess),
    engagementId: src.engagementId,
    libraryRef: r.libraryRef,
    newRiskJustification: r.newRiskJustification,
    title: r.title,
    description: r.description,
    subProcess: r.subProcess,
    assertions: r.assertions,
    inherentRiskFactors: r.inherentRiskFactors,
    inherentRiskRating: r.inherentRiskRating,
    significantRiskCandidate: r.significantRiskCandidate,
    fraudRelated: r.fraudRelated,
    drivers: r.drivers,
    evidenceRefs: r.refs.map((x) => toEvidenceRef(x, src)),
    grounding: "grounded" as const,
  }));
}

/* ── S6 controls and gaps ─────────────────────────────────────────────────── */

export async function identifyControls(
  facts: ProcessFact[], risks: Risk[], src: IngestedSource, ctx: EngineContext,
): Promise<Control[]> {
  const byTitle = new Map(risks.map((r) => [r.title.toLowerCase(), r.id]));
  const out = await run(
    ctx, "identifyControls", "reasoning", "high", DraftControls,
    `TASK. Identify the controls the entity has that address the risks listed.

For each control: who performs it, on what information, how often, and what happens when it finds an exception. Classify type, nature and frequency. Record the information produced by the entity that the control relies on (ipeUsed) and what evidence exists that it operated. Link it to the risks it addresses by their exact titles.

keyControlCandidate is a proposal only. Set it true only where the control addresses an assessed risk, is precise enough to detect a material misstatement, and there is evidence it operated.`,
    [
      `<evidence kind="risks">\n${JSON.stringify(risks.map(({ title, subProcess, assertions }) => ({ title, subProcess, assertions })), null, 1)}\n</evidence>`,
      `<evidence kind="process_facts">\n${JSON.stringify(facts.map(({ coverageItemId, factKey, value }) => ({ coverageItemId, factKey, value })), null, 1)}\n</evidence>`,
      `<evidence kind="transcript">\n${renderSourceForPrompt(src)}\n</evidence>`,
    ],
  );

  return out.controls.map((c) => ({
    id: stableId("ctl", c.libraryRef ?? c.title, c.subProcess),
    engagementId: src.engagementId,
    libraryRef: c.libraryRef,
    title: c.title,
    description: c.description,
    subProcess: c.subProcess,
    addressesRiskIds: c.addressesRiskTitles
      .map((t) => byTitle.get(t.toLowerCase()))
      .filter((x): x is string => Boolean(x)),
    assertions: c.assertions,
    controlType: c.controlType,
    controlNature: c.controlNature,
    frequency: c.frequency,
    ownerRole: c.ownerRole,
    ipeUsed: c.ipeUsed,
    evidenceOfOperation: c.evidenceOfOperation,
    keyControlCandidate: c.keyControlCandidate,
    evidenceRefs: c.refs.map((x) => toEvidenceRef(x, src)),
    grounding: "grounded" as const,
  }));
}

export async function identifyGaps(
  risks: Risk[], controls: Control[], src: IngestedSource, ctx: EngineContext,
): Promise<ControlGap[]> {
  const byTitle = new Map(risks.map((r) => [r.title.toLowerCase(), r.id]));
  const out = await run(
    ctx, "identifyGaps", "reasoning", "high", DraftGaps,
    `TASK. Identify where the controls described do not adequately address the risks identified.

Four kinds of gap: no control at all; a control that exists but is not precise enough; a control that operates but leaves no evidence; and information an auditor needs that was not obtained. The last kind matters as much as the others — an unanswered question is a gap in the understanding, and saying so is more useful than assuming.

State the potential impact in terms an auditor would put in a management letter.`,
    [
      `<evidence kind="risks">\n${JSON.stringify(risks.map(({ title, assertions, inherentRiskRating }) => ({ title, assertions, inherentRiskRating })), null, 1)}\n</evidence>`,
      `<evidence kind="controls">\n${JSON.stringify(controls.map(({ title, description, addressesRiskIds, evidenceOfOperation }) => ({ title, description, addressesRiskIds, evidenceOfOperation })), null, 1)}\n</evidence>`,
      `<evidence kind="transcript">\n${renderSourceForPrompt(src)}\n</evidence>`,
    ],
  );

  return out.gaps.map((g, i) => ({
    id: stableId("gap", g.riskTitle, String(i)),
    engagementId: src.engagementId,
    riskId: byTitle.get(g.riskTitle.toLowerCase()) ?? g.riskTitle,
    description: g.description,
    gapType: g.gapType,
    potentialImpact: g.potentialImpact,
    evidenceRefs: g.refs.map((x) => toEvidenceRef(x, src)),
    grounding: "grounded" as const,
  }));
}
