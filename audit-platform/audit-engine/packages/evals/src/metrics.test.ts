import { describe, it, expect } from "vitest";
import { recallOf, similarity } from "./metrics.ts";
import { verdictOf, type EditRecord } from "./edits.ts";

describe("matching", () => {
  it("matches on library id exactly", () => {
    const r = recallOf(
      [{ libraryRef: "RSK-REV-021", title: "Unauthorised price overrides" }],
      [{ libraryRef: "RSK-REV-021", title: "completely different wording" }],
    );
    expect(r.recall).toBe(1);
  });

  it("matches free text only on strong overlap", () => {
    expect(similarity("Revenue recorded before delivery", "Revenue recorded before delivery occurs")).toBeGreaterThan(0.6);
    expect(similarity("Revenue recorded before delivery", "Credit limits are not reviewed")).toBeLessThan(0.3);
  });

  it("reports what was missed", () => {
    const r = recallOf(
      [
        { libraryRef: "RSK-REV-002", title: "Revenue before performance" },
        { libraryRef: "RSK-REV-030", title: "Management override via journals" },
      ],
      [{ libraryRef: "RSK-REV-002", title: "Revenue before performance" }],
    );
    expect(r.recall).toBe(0.5);
    expect(r.missed).toEqual(["RSK-REV-030"]);
  });
});

describe("edit taxonomy (M4)", () => {
  const edit = (category: EditRecord["category"], severity: EditRecord["severity"]): EditRecord => ({
    caseId: "c1", location: "3.1", category, severity, note: "",
  });

  it("reads a mostly-stylistic edit set as polish", () => {
    const v = verdictOf(
      [edit("stylistic", "trivial"), edit("conciseness", "trivial"), edit("clarification", "moderate"),
       edit("structural", "trivial"), edit("missing_content_addition", "moderate")],
      1,
    );
    expect(v.signal).toBe("polish");
    expect(v.hardFail).toBe(false);
  });

  it("reads methodology and missing-content edits as fundamental", () => {
    const v = verdictOf(
      [edit("methodology_correction", "material"), edit("risk_control_correction", "material"),
       edit("missing_content_addition", "material"), edit("missing_content_addition", "material"),
       edit("stylistic", "trivial")],
      1,
    );
    expect(v.signal).toBe("fundamental");
    expect(v.notes.join(" ")).toContain("material edits per case");
  });

  it("treats one material unsupported claim as a hard fail", () => {
    const v = verdictOf([edit("unsupported_claim_correction", "material")], 1);
    expect(v.hardFail).toBe(true);
  });

  it("does not hard-fail on a trivial unsupported-claim tidy-up", () => {
    const v = verdictOf([edit("unsupported_claim_correction", "trivial")], 1);
    expect(v.hardFail).toBe(false);
  });
});
