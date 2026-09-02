import type {
  CoverageAssessment, CoverageItemState, FactStatus, MissingFact, ProcessFact,
} from "@audit/domain";
import type { CoverageItem, MethodologyPack, TriggerPredicate } from "@audit/methodology";

/**
 * Deterministic coverage engine. No model call.
 *
 * This is what makes the product an audit instrument rather than a chatbot: the pack
 * decides what must be known, and the mandatory follow-ups do not depend on model
 * initiative (02 §2.4, brief §4).
 */

type StatusMap = Record<string, FactStatus>;

/**
 * Pack patterns are matched case-insensitively. JavaScript has no inline `(?i)` flag, and
 * pack authors write it out of habit, so it is stripped rather than allowed to throw
 * mid-run. `validatePack` rejects a pattern that cannot compile at all.
 */
export function compilePattern(pattern: string): RegExp {
  return new RegExp(pattern.replace(/^\(\?i\)/, ""), "i");
}

function statusesFor(item: CoverageItem, byKey: Map<string, ProcessFact>): StatusMap {
  const out: StatusMap = {};
  for (const key of item.mustKnowFacts) out[key] = byKey.get(key)?.status ?? "unknown";
  return out;
}

export function evaluatePredicate(
  p: TriggerPredicate,
  statuses: StatusMap,
  values: Record<string, string | null>,
): boolean {
  for (const k of p.missing ?? []) if ((statuses[k] ?? "unknown") === "known") return false;
  for (const k of p.present ?? []) if ((statuses[k] ?? "unknown") !== "known") return false;
  for (const [k, want] of Object.entries(p.status ?? {})) {
    if ((statuses[k] ?? "unknown") !== want) return false;
  }
  for (const [k, pattern] of Object.entries(p.valueMatches ?? {})) {
    const v = values[k];
    if (!v || !compilePattern(pattern).test(v)) return false;
  }
  return true;
}

export function evaluateCoverage(
  facts: ProcessFact[],
  pack: MethodologyPack,
  caseId: string,
): CoverageAssessment {
  const byItem = new Map<string, Map<string, ProcessFact>>();
  for (const f of facts) {
    if (!byItem.has(f.coverageItemId)) byItem.set(f.coverageItemId, new Map());
    // last write wins, but a contradictory fact always dominates
    const m = byItem.get(f.coverageItemId)!;
    const existing = m.get(f.factKey);
    if (!existing || existing.status !== "contradictory") m.set(f.factKey, f);
  }

  const items: CoverageItemState[] = [];
  for (const sp of pack.subProcesses) {
    for (const item of sp.coverageItems) {
      const known = byItem.get(item.id) ?? new Map<string, ProcessFact>();
      const statuses = statusesFor(item, known);
      const values: Record<string, string | null> = {};
      for (const key of item.mustKnowFacts) values[key] = known.get(key)?.value ?? null;

      const list = Object.values(statuses);
      const resolved = list.filter((s) => s === "known" || s === "not_applicable").length;
      const hasContradiction = list.includes("contradictory");
      const hasWeak = list.includes("insufficiently_evidenced");

      let state: CoverageItemState["state"];
      let reason: string | null = null;

      const applicable =
        !item.applicabilityWhen || evaluatePredicate(item.applicabilityWhen, statuses, values);

      if (!applicable) {
        state = "not_applicable";
        reason = `Applicability condition for ${item.id} not met on the facts obtained.`;
      } else if (list.length > 0 && list.every((s) => s === "not_applicable")) {
        state = "not_applicable";
        reason =
          known.get(item.mustKnowFacts[0]!)?.value ??
          "All required facts were recorded as not applicable.";
      } else if (resolved === 0) {
        state = "open";
      } else if (resolved === list.length && !hasContradiction && !hasWeak) {
        state = "covered";
      } else {
        state = "partial";
      }

      const flags: CoverageItemState["flags"] = [];
      if (hasContradiction) flags.push("contradiction");
      if (hasWeak) flags.push("weak_evidence");

      items.push({
        coverageItemId: item.id,
        subProcess: sp.id,
        mandatory: item.mandatory,
        state,
        notApplicableReason: reason,
        factStatuses: statuses,
        flags,
      });
    }
  }

  const applicableItems = items.filter((i) => i.state !== "not_applicable");
  const covered = applicableItems.filter((i) => i.state === "covered").length;
  const coveragePct =
    applicableItems.length === 0 ? 100 : Math.round((covered / applicableItems.length) * 1000) / 10;

  return {
    caseId,
    packVersion: pack.version,
    items,
    coveragePct,
    mandatoryOpen: items
      .filter((i) => i.mandatory && (i.state === "open" || i.state === "partial"))
      .map((i) => i.coverageItemId),
  };
}

/**
 * Deterministic follow-ups first. The model may add more (`origin: "model_proposed"`),
 * but a mandatory audit question is never skipped because the model did not think of it.
 */
export function identifyMissingFacts(
  coverage: CoverageAssessment,
  facts: ProcessFact[],
  pack: MethodologyPack,
): MissingFact[] {
  const valueByItemKey = new Map<string, string | null>();
  for (const f of facts) valueByItemKey.set(`${f.coverageItemId}::${f.factKey}`, f.value);

  const out: MissingFact[] = [];
  for (const state of coverage.items) {
    if (state.state === "covered" || state.state === "not_applicable") continue;
    const item = pack.items.get(state.coverageItemId);
    if (!item) continue;

    const values: Record<string, string | null> = {};
    for (const key of item.mustKnowFacts) {
      values[key] = valueByItemKey.get(`${item.id}::${key}`) ?? null;
    }

    let firedForItem = false;
    for (const trigger of item.followUpTriggers) {
      if (!evaluatePredicate(trigger.when, state.factStatuses, values)) continue;
      firedForItem = true;
      out.push({
        coverageItemId: item.id,
        factKey: (trigger.when.missing ?? [])[0] ?? null,
        why: `${item.questionIntent} (${item.standardRef})`,
        question: trigger.ask,
        origin: "deterministic_trigger",
        priority: item.mandatory && trigger.priority !== "mandatory" ? "mandatory" : trigger.priority,
        triggerId: trigger.id,
      });
    }

    // A mandatory item with unresolved facts always produces a question, trigger or not.
    if (!firedForItem && item.mandatory) {
      const unresolved = item.mustKnowFacts.filter(
        (k) => state.factStatuses[k] !== "known" && state.factStatuses[k] !== "not_applicable",
      );
      if (unresolved.length > 0) {
        out.push({
          coverageItemId: item.id,
          factKey: unresolved[0]!,
          why: `Mandatory coverage item ${item.id} is unresolved (${item.standardRef}).`,
          question: item.questionIntent,
          origin: "deterministic_trigger",
          priority: "mandatory",
          triggerId: null,
        });
      }
    }
  }

  const order = { mandatory: 0, high: 1, medium: 2, low: 3 } as const;
  return out.sort((a, b) => order[a.priority] - order[b.priority]);
}
