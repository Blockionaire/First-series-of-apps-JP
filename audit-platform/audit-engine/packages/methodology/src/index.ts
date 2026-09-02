/**
 * @audit/methodology — the pack loader and validator.
 *
 * The pack is data, not code (02 §2.4). This package parses it, validates its internal
 * consistency, and exposes lookups. It never calls a model.
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import { z } from "zod";
import { Assertion, InherentRiskFactor, ControlType, ControlNature, ControlFrequency } from "@audit/domain";

/* ── Trigger predicates ───────────────────────────────────────────────────── */

/**
 * A deliberately small, declarative predicate language. No expression evaluation:
 * a pack is reviewed by an auditor, and an auditor must be able to read every rule.
 */
export const TriggerPredicate = z.object({
  /** Fact keys whose status is not `known`. */
  missing: z.array(z.string()).optional(),
  /** Fact keys whose status is `known`. */
  present: z.array(z.string()).optional(),
  /** Explicit status match, e.g. { price_source: "contradictory" }. */
  status: z.record(z.string(), z.string()).optional(),
  /** Case-insensitive regular expression against a known fact's value. */
  valueMatches: z.record(z.string(), z.string()).optional(),
});
export type TriggerPredicate = z.infer<typeof TriggerPredicate>;

export const FollowUpTrigger = z.object({
  id: z.string(),
  when: TriggerPredicate,
  ask: z.string().min(10),
  priority: z.enum(["mandatory", "high", "medium", "low"]),
});
export type FollowUpTrigger = z.infer<typeof FollowUpTrigger>;

/* ── Pack ─────────────────────────────────────────────────────────────────── */

export const CoverageItem = z.object({
  id: z.string(),
  mandatory: z.boolean().default(false),
  questionIntent: z.string().min(10),
  mustKnowFacts: z.array(z.string()).min(1),
  assertions: z.array(Assertion).min(1),
  standardRef: z.string(),
  typicalRisks: z.array(z.string()).default([]),
  typicalControls: z.array(z.string()).default([]),
  followUpTriggers: z.array(FollowUpTrigger).default([]),
  /** When present, the item only applies if the predicate holds against known facts. */
  applicabilityWhen: TriggerPredicate.optional(),
});
export type CoverageItem = z.infer<typeof CoverageItem>;

export const SubProcess = z.object({
  id: z.string(),
  name: z.string(),
  applicability: z.string().default("always"),
  coverageItems: z.array(CoverageItem).min(1),
});
export type SubProcess = z.infer<typeof SubProcess>;

export const PackFile = z.object({
  pack: z.string(),
  version: z.string(),
  frameworks: z.array(z.string()),
  language: z.string().default("en"),
  subProcesses: z.array(SubProcess).min(1),
});

export const RiskLibraryEntry = z.object({
  id: z.string(),
  title: z.string(),
  assertions: z.array(Assertion).min(1),
  inherentRiskFactors: z.array(InherentRiskFactor).min(1),
  subProcess: z.string(),
});
export type RiskLibraryEntry = z.infer<typeof RiskLibraryEntry>;

export const ControlLibraryEntry = z.object({
  id: z.string(),
  title: z.string(),
  controlType: ControlType,
  controlNature: ControlNature,
  frequency: ControlFrequency,
  assertions: z.array(Assertion).min(1),
});
export type ControlLibraryEntry = z.infer<typeof ControlLibraryEntry>;

const LibraryFile = <T extends z.ZodTypeAny>(entry: T) =>
  z.object({ library: z.string(), version: z.string(), entries: z.array(entry).min(1) });

export interface MethodologyPack {
  pack: string;
  version: string;
  frameworks: string[];
  language: string;
  subProcesses: SubProcess[];
  risks: Map<string, RiskLibraryEntry>;
  controls: Map<string, ControlLibraryEntry>;
  /** Flat index of every coverage item, keyed by id. */
  items: Map<string, CoverageItem & { subProcess: string }>;
}

/* ── Loading ──────────────────────────────────────────────────────────────── */

export class PackValidationError extends Error {
  constructor(public readonly problems: string[]) {
    super(`Pack failed validation:\n  - ${problems.join("\n  - ")}`);
    this.name = "PackValidationError";
  }
}

export function loadPack(dir: string): MethodologyPack {
  for (const f of ["pack.yaml", "risks.yaml", "controls.yaml"]) {
    if (!existsSync(join(dir, f))) throw new Error(`Pack directory ${dir} is missing ${f}`);
  }
  const raw = PackFile.parse(parseYaml(readFileSync(join(dir, "pack.yaml"), "utf8")));
  const risksFile = LibraryFile(RiskLibraryEntry).parse(
    parseYaml(readFileSync(join(dir, "risks.yaml"), "utf8")),
  );
  const controlsFile = LibraryFile(ControlLibraryEntry).parse(
    parseYaml(readFileSync(join(dir, "controls.yaml"), "utf8")),
  );

  const risks = new Map(risksFile.entries.map((e) => [e.id, e]));
  const controls = new Map(controlsFile.entries.map((e) => [e.id, e]));
  const items = new Map<string, CoverageItem & { subProcess: string }>();
  for (const sp of raw.subProcesses) {
    for (const item of sp.coverageItems) items.set(item.id, { ...item, subProcess: sp.id });
  }

  const pack: MethodologyPack = { ...raw, risks, controls, items };
  const problems = validatePack(pack, risksFile.entries.length, controlsFile.entries.length);
  if (problems.length) throw new PackValidationError(problems);
  return pack;
}

/**
 * Internal consistency of the pack. A pack that fails here would silently produce
 * unmeasurable evaluation results, so this runs on every load rather than in a test.
 */
export function validatePack(
  pack: MethodologyPack,
  riskCount: number,
  controlCount: number,
): string[] {
  const problems: string[] = [];
  const seenItems = new Set<string>();
  const seenTriggers = new Set<string>();

  if (pack.risks.size !== riskCount) problems.push("duplicate risk ids in risks.yaml");
  if (pack.controls.size !== controlCount) problems.push("duplicate control ids in controls.yaml");

  for (const sp of pack.subProcesses) {
    for (const item of sp.coverageItems) {
      if (seenItems.has(item.id)) problems.push(`duplicate coverage item id ${item.id}`);
      seenItems.add(item.id);

      if (!item.id.startsWith(sp.id + ".")) {
        problems.push(`coverage item ${item.id} does not belong to sub-process ${sp.id}`);
      }
      for (const r of item.typicalRisks) {
        if (!pack.risks.has(r)) problems.push(`${item.id} references unknown risk ${r}`);
      }
      for (const c of item.typicalControls) {
        if (!pack.controls.has(c)) problems.push(`${item.id} references unknown control ${c}`);
      }

      for (const pattern of Object.values(item.applicabilityWhen?.valueMatches ?? {})) {
        try {
          new RegExp(pattern.replace(/^\(\?i\)/, ""), "i");
        } catch {
          problems.push(`${item.id}.applicabilityWhen has an invalid regular expression: ${pattern}`);
        }
      }

      const facts = new Set(item.mustKnowFacts);
      for (const t of item.followUpTriggers) {
        if (seenTriggers.has(t.id)) problems.push(`duplicate trigger id ${t.id}`);
        seenTriggers.add(t.id);
        if (!t.id.startsWith(item.id + ".")) {
          problems.push(`trigger ${t.id} is not namespaced under ${item.id}`);
        }
        for (const pattern of Object.values(t.when.valueMatches ?? {})) {
          try {
            new RegExp(pattern.replace(/^\(\?i\)/, ""), "i");
          } catch {
            problems.push(`trigger ${t.id} has an invalid regular expression: ${pattern}`);
          }
        }
        for (const key of predicateFactKeys(t.when)) {
          if (!facts.has(key)) {
            problems.push(`trigger ${t.id} refers to fact "${key}" not in ${item.id}.mustKnowFacts`);
          }
        }
      }
    }
  }
  return problems;
}

export function predicateFactKeys(p: TriggerPredicate): string[] {
  return [
    ...(p.missing ?? []),
    ...(p.present ?? []),
    ...Object.keys(p.status ?? {}),
    ...Object.keys(p.valueMatches ?? {}),
  ];
}

/* ── Lookups ──────────────────────────────────────────────────────────────── */

export function allCoverageItems(pack: MethodologyPack): (CoverageItem & { subProcess: string })[] {
  return [...pack.items.values()];
}

export function mandatoryItemIds(pack: MethodologyPack): string[] {
  return allCoverageItems(pack).filter((i) => i.mandatory).map((i) => i.id);
}

export function packStats(pack: MethodologyPack) {
  const items = allCoverageItems(pack);
  return {
    subProcesses: pack.subProcesses.length,
    coverageItems: items.length,
    mandatoryItems: items.filter((i) => i.mandatory).length,
    facts: items.reduce((n, i) => n + i.mustKnowFacts.length, 0),
    triggers: items.reduce((n, i) => n + i.followUpTriggers.length, 0),
    risks: pack.risks.size,
    controls: pack.controls.size,
  };
}

/** Default location of the shipped Revenue pack. */
export const REVENUE_PACK_DIR = new URL("../packs/revenue/v0.1.0/", import.meta.url).pathname;
