import { describe, it, expect } from "vitest";
import {
  assignRaters, m1, m2, blindingIntegrity, criterionProfile,
  type Rating, type Rater, type BlindCase, type Assignment,
} from "./blind.ts";
import { gateReport } from "./gate.ts";
import { verdictOf, type EditRecord } from "./edits.ts";

const cases: BlindCase[] = [
  { caseId: "r-01", firm: "alpha" }, { caseId: "r-02", firm: "alpha" },
  { caseId: "r-03", firm: "beta" }, { caseId: "r-04", firm: "beta" },
  { caseId: "r-05", firm: "gamma" }, { caseId: "r-06", firm: "gamma" },
];
const raters: Rater[] = [
  { raterId: "a1", firm: "alpha", level: "manager" }, { raterId: "a2", firm: "alpha", level: "senior" },
  { raterId: "b1", firm: "beta", level: "manager" }, { raterId: "b2", firm: "beta", level: "senior" },
  { raterId: "g1", firm: "gamma", level: "manager" }, { raterId: "g2", firm: "gamma", level: "senior" },
];

describe("rater assignment", () => {
  const assignments = assignRaters(cases, raters);

  it("gives each rater three cases", () => {
    for (const r of raters) {
      expect(assignments.filter((a) => a.raterId === r.raterId)).toHaveLength(3);
    }
  });

  it("never assigns a rater a case from their own firm", () => {
    for (const a of assignments) {
      const rater = raters.find((r) => r.raterId === a.raterId)!;
      const c = cases.find((x) => x.caseId === a.caseId)!;
      expect(c.firm).not.toBe(rater.firm);
    }
  });

  it("spreads the load so every case is rated", () => {
    const counts = cases.map((c) => assignments.filter((a) => a.caseId === c.caseId).length);
    expect(Math.min(...counts)).toBeGreaterThanOrEqual(2);
    expect(counts.reduce((a, b) => a + b, 0)).toBe(18);
  });

  it("randomises labels per rater and case, and is reproducible", () => {
    const again = assignRaters(cases, raters);
    expect(again).toEqual(assignments);
    const mappings = new Set(assignments.map((a) => `${a.labels.A}${a.labels.B}${a.labels.C}`));
    expect(mappings.size).toBeGreaterThan(1);
    for (const a of assignments) {
      expect(new Set(Object.values(a.labels)).size).toBe(3);
    }
  });
});

/** Build ratings where each variant gets a fixed rank, whatever label it was shown under. */
function ratingsWithRanks(
  assignments: Assignment[],
  rank: { A: 1 | 2 | 3; B: 1 | 2 | 3; C: 1 | 2 | 3 },
): Rating[] {
  const base = { completeness: 4, auditRelevance: 4, clarity: 4, conciseness: 4, traceability: 4, reviewEffortMinutes: 30 };
  return assignments.flatMap((a) =>
    (["A", "B", "C"] as const).map((v) => ({
      raterId: a.raterId, caseId: a.caseId, label: a.labels[v], rank: rank[v], ...base,
    })),
  );
}

describe("M1 and M2 are derived separately from the same rankings", () => {
  const assignments = assignRaters(cases, raters);

  it("reports the success case the plan describes: A beats B, C beats A", () => {
    // rank 1 = preferred. C first, A second, B third.
    const ratings = ratingsWithRanks(assignments, { C: 1, A: 2, B: 3 });
    const one = m1(ratings, assignments);
    const two = m2(ratings, assignments);
    expect(one.atOrAboveShare).toBe(0);      // raw output loses — diagnostic only
    expect(two.atOrAboveShare).toBe(1);      // reviewed output wins — the gate
    expect(two.strictlyAboveShare).toBe(1);
    expect(two.judgements).toBe(18);
  });

  it("counts a tie as at-or-above but not strictly above", () => {
    const ratings = ratingsWithRanks(assignments, { A: 1, C: 1, B: 3 });
    const two = m2(ratings, assignments);
    expect(two.atOrAboveShare).toBe(1);
    expect(two.strictlyAboveShare).toBe(0);
  });

  it("profiles each variant by criterion", () => {
    const ratings = ratingsWithRanks(assignments, { C: 1, A: 2, B: 3 });
    const profile = criterionProfile(ratings, assignments);
    expect(profile.map((p) => p.variant)).toEqual(["A", "B", "C"]);
    for (const p of profile) expect(p.n).toBe(18);
  });
});

describe("blinding integrity", () => {
  const assignments = assignRaters(cases, raters);

  it("is high when raters pick the AI documents and nothing else", () => {
    const guesses = assignments.map((a) => ({
      raterId: a.raterId, caseId: a.caseId, guessedAiLabels: [a.labels.B],
    }));
    expect(blindingIntegrity(guesses, assignments)).toBe(1);
  });

  it("is low when raters also finger the firm's own paper", () => {
    const guesses = assignments.map((a) => ({
      raterId: a.raterId, caseId: a.caseId, guessedAiLabels: [a.labels.A],
    }));
    expect(blindingIntegrity(guesses, assignments)).toBe(0);
  });
});

describe("gate report", () => {
  const assignments = assignRaters(cases, raters);
  const metrics = [{
    caseId: "r-01", groundingIntegrityOk: true, groundedShare: 1, needsSourceCount: 0,
    mandatoryOpen: 0, coveragePct: 90, coverageRecall: 0.9, riskRecallVsFirm: 0.9,
    riskRecallVsExpert: 0.8, controlRecall: 0.85, missingFactDetection: 0.8,
    riskCount: 10, controlCount: 8,
  }];
  const edit = (c: EditRecord["category"], s: EditRecord["severity"]): EditRecord =>
    ({ caseId: "r-01", location: "3.1", category: c, severity: s, note: "" });

  it("refuses to conclude while the human evidence is missing", () => {
    const r = gateReport({ metrics, m1: null, m2: null, edits: null, timings: null, blindingIntegrity: null });
    expect(r.verdict).toBe("incomplete");
    expect(r.humanEvidenceMissing).toBe(true);
  });

  it("passes when C beats A and editing is fast, even though B loses to A", () => {
    const ratings = ratingsWithRanks(assignments, { C: 1, A: 2, B: 3 });
    const r = gateReport({
      metrics,
      m1: m1(ratings, assignments),
      m2: m2(ratings, assignments),
      edits: verdictOf([edit("stylistic", "trivial"), edit("clarification", "trivial"), edit("conciseness", "trivial")], 1),
      timings: { minutesPerCase: [30, 35, 40], firmBaselineMinutes: 240 },
      blindingIntegrity: 0.3,
    });
    expect(r.verdict).toBe("pass");
    expect(r.lines.join("\n")).toContain("DIAGNOSTIC, NEVER A GATE");
  });

  it("stops when C cannot beat A", () => {
    const ratings = ratingsWithRanks(assignments, { A: 1, B: 2, C: 3 });
    const r = gateReport({
      metrics,
      m1: m1(ratings, assignments),
      m2: m2(ratings, assignments),
      edits: verdictOf([edit("stylistic", "trivial")], 1),
      timings: { minutesPerCase: [30], firmBaselineMinutes: 240 },
      blindingIntegrity: 0.3,
    });
    expect(r.verdict).toBe("stop");
  });

  it("hard-fails when the blinding collapsed, whatever the preference numbers say", () => {
    const ratings = ratingsWithRanks(assignments, { C: 1, A: 2, B: 3 });
    const r = gateReport({
      metrics,
      m1: m1(ratings, assignments),
      m2: m2(ratings, assignments),
      edits: verdictOf([edit("stylistic", "trivial")], 1),
      timings: { minutesPerCase: [30], firmBaselineMinutes: 240 },
      blindingIntegrity: 0.9,
    });
    expect(r.verdict).toBe("stop");
    expect(r.hardFails.join(" ")).toContain("blinding integrity");
  });
});
