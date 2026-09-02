import { describe, it, expect } from "vitest";
import { loadPack, REVENUE_PACK_DIR } from "@audit/methodology";
import type { ProcessFact, IngestedSource } from "@audit/domain";
import { ingest } from "./ingest.ts";
import { validateGrounding, normalise, type GroundableEntry } from "./grounding.ts";
import { evaluateCoverage, identifyMissingFacts, evaluatePredicate } from "./coverage.ts";

const pack = loadPack(REVENUE_PACK_DIR);

const TRANSCRIPT = `Auditor (audit senior): Can you walk me through how an order becomes an invoice?
Controller (financial controller): Orders come in by email and we type them into Exact. The price comes from the contract price list.
Auditor: Can anyone change that price on the order?
Controller: Sales can override it, yes. There is no approval on that at the moment.
Auditor: And who posts journals to revenue?
Controller: Only me and the CFO.`;

function src(): IngestedSource {
  return ingest({
    caseId: "t1", engagementId: "eng1", language: "en", sourceClass: "C0",
    format: "plaintext", content: TRANSCRIPT, clientProfile: null,
  });
}

function fact(p: Partial<ProcessFact> & Pick<ProcessFact, "coverageItemId" | "factKey" | "status">): ProcessFact {
  const s = src();
  const seg = s.segments[1]!;
  return {
    id: `fact_${p.coverageItemId}_${p.factKey}`,
    engagementId: "eng1",
    value: p.value ?? "something",
    conflictingValues: [],
    actors: [], systems: [], certainty: "stated",
    evidenceRefs: [
      {
        locator: { kind: "transcript", segmentId: seg.segmentId, charFrom: 0, charTo: 20 },
        quote: seg.text.slice(0, 30),
        speaker: seg.speaker,
      },
    ],
    grounding: "grounded",
    ...p,
  } as ProcessFact;
}

describe("ingest", () => {
  it("splits speaker turns into addressable segments", () => {
    const s = src();
    expect(s.segments.length).toBe(6);
    expect(s.segments[0]!.speaker).toBe("Auditor");
    expect(s.segments[0]!.speakerRole).toBe("audit senior");
    expect(s.segments[1]!.text).toContain("Exact");
  });

  it("produces stable segment ids for identical input", () => {
    expect(src().segments.map((x) => x.segmentId)).toEqual(src().segments.map((x) => x.segmentId));
  });
});

describe("grounding validator", () => {
  const s = src();

  it("accepts an object whose quote occurs in the cited segment", () => {
    const entries: GroundableEntry[] = [{ kind: "fact", obj: fact({ coverageItemId: "R2.2", factKey: "price_source", status: "known" }) as never }];
    const report = validateGrounding(entries, s);
    expect(report.grounded).toBe(1);
    expect(report.needsSource).toHaveLength(0);
    expect(report.integrityOk).toBe(true);
  });

  it("flags a quote that does not occur in the cited segment", () => {
    const f = fact({ coverageItemId: "R2.2", factKey: "price_source", status: "known" });
    f.evidenceRefs[0]!.quote = "the CFO approves every invoice personally";
    const report = validateGrounding([{ kind: "fact", obj: f as never }], s);
    expect(report.grounded).toBe(0);
    expect(report.needsSource[0]!.reason).toBe("quote_not_found");
    expect(f.grounding).toBe("needs_source");
  });

  it("treats an unknown segment as an integrity failure", () => {
    const f = fact({ coverageItemId: "R2.2", factKey: "price_source", status: "known" });
    (f.evidenceRefs[0]!.locator as { segmentId: string }).segmentId = "seg_9999_deadbeef";
    const report = validateGrounding([{ kind: "fact", obj: f as never }], s);
    expect(report.integrityOk).toBe(false);
    expect(report.needsSource[0]!.reason).toBe("ref_unresolvable");
  });

  it("refuses an object from another engagement", () => {
    const f = fact({ coverageItemId: "R2.2", factKey: "price_source", status: "known" });
    f.engagementId = "eng2";
    const report = validateGrounding([{ kind: "fact", obj: f as never }], s);
    expect(report.integrityOk).toBe(false);
    expect(report.needsSource[0]!.reason).toBe("ref_outside_engagement");
  });

  it("requires a justification for a risk with no library reference", () => {
    const r = { ...fact({ coverageItemId: "R2.2", factKey: "x", status: "known" }), libraryRef: null, newRiskJustification: null };
    const report = validateGrounding([{ kind: "risk", obj: r as never }], s);
    expect(report.needsSource[0]!.reason).toBe("missing_new_risk_justification");
  });

  it("rejects an unknown library reference", () => {
    const r = { ...fact({ coverageItemId: "R2.2", factKey: "x", status: "known" }), libraryRef: "RSK-REV-999", newRiskJustification: null };
    const report = validateGrounding([{ kind: "risk", obj: r as never }], s, { knownRiskIds: new Set(pack.risks.keys()) });
    expect(report.needsSource[0]!.reason).toBe("unknown_library_ref");
  });

  it("never drops an object — a failure is flagged, not removed", () => {
    const good = fact({ coverageItemId: "R2.2", factKey: "price_source", status: "known" });
    const bad = fact({ coverageItemId: "R5.3", factKey: "quantity_source", status: "known" });
    bad.evidenceRefs = [];
    const report = validateGrounding(
      [{ kind: "fact", obj: good as never }, { kind: "fact", obj: bad as never }], s,
    );
    expect(report.total).toBe(2);
    expect(report.grounded).toBe(1);
    expect(report.needsSource).toHaveLength(1);
  });

  it("normalises punctuation and case before comparing", () => {
    expect(normalise("The  price — comes from “contract”.")).toBe("the price comes from contract");
  });
});

describe("coverage engine", () => {
  it("marks an item covered only when every required fact is resolved", () => {
    const item = pack.items.get("R11.1")!;
    const facts = item.mustKnowFacts.map((k) => fact({ coverageItemId: "R11.1", factKey: k, status: "known" }));
    const cov = evaluateCoverage(facts, pack, "t1");
    expect(cov.items.find((i) => i.coverageItemId === "R11.1")!.state).toBe("covered");
  });

  it("caps an item at partial when a fact is contradictory", () => {
    const item = pack.items.get("R5.3")!;
    const facts = item.mustKnowFacts.map((k, i) =>
      fact({ coverageItemId: "R5.3", factKey: k, status: i === 0 ? "contradictory" : "known" }),
    );
    const state = evaluateCoverage(facts, pack, "t1").items.find((i) => i.coverageItemId === "R5.3")!;
    expect(state.state).toBe("partial");
    expect(state.flags).toContain("contradiction");
  });

  it("reports every mandatory item as open when nothing was extracted", () => {
    const cov = evaluateCoverage([], pack, "t1");
    expect(cov.mandatoryOpen.length).toBe(10);
    expect(cov.coveragePct).toBe(0);
  });

  it("evaluates predicates as a conjunction", () => {
    const statuses = { a: "known", b: "unknown" } as const;
    expect(evaluatePredicate({ present: ["a"], missing: ["b"] }, statuses, { a: "x", b: null })).toBe(true);
    expect(evaluatePredicate({ present: ["a", "b"] }, statuses, { a: "x", b: null })).toBe(false);
  });

  it("tolerates the (?i) prefix pack authors write out of habit", () => {
    const statuses = { a: "known" } as const;
    // JavaScript has no inline flag; an unstripped (?i) would throw mid-run.
    expect(evaluatePredicate({ valueMatches: { a: "(?i)^Over.?time$" } }, statuses, { a: "over time" })).toBe(true);
    expect(evaluatePredicate({ valueMatches: { a: "^point in time$" } }, statuses, { a: "over time" })).toBe(false);
  });
});

describe("deterministic follow-ups", () => {
  it("fires the override trigger when the consequence of an override is unknown", () => {
    const facts = [
      fact({ coverageItemId: "R5.3", factKey: "who_can_override_price", status: "known", value: "sales" }),
    ];
    const cov = evaluateCoverage(facts, pack, "t1");
    const missing = identifyMissingFacts(cov, facts, pack);
    expect(missing.some((m) => m.triggerId === "R5.3.T2")).toBe(true);
  });

  it("always produces a question for an unresolved mandatory item", () => {
    const cov = evaluateCoverage([], pack, "t1");
    const missing = identifyMissingFacts(cov, [], pack);
    for (const id of ["R1.3", "R4.1", "R6.1", "R6.5", "R9.1", "R11.1", "R11.2", "R11.3"]) {
      expect(missing.some((m) => m.coverageItemId === id && m.priority === "mandatory")).toBe(true);
    }
  });

  it("orders mandatory questions first", () => {
    const facts = [fact({ coverageItemId: "R2.2", factKey: "discount_authority", status: "known" })];
    const cov = evaluateCoverage(facts, pack, "t1");
    const missing = identifyMissingFacts(cov, facts, pack);
    expect(missing[0]!.priority).toBe("mandatory");
  });
});
