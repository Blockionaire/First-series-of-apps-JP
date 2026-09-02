import { describe, it, expect } from "vitest";
import { loadPack, packStats, REVENUE_PACK_DIR, mandatoryItemIds } from "./index.ts";

describe("revenue pack v0.1.0", () => {
  const pack = loadPack(REVENUE_PACK_DIR);

  it("loads and passes internal validation", () => {
    expect(pack.pack).toBe("revenue");
    expect(pack.version).toBe("0.1.0");
  });

  it("covers all twelve sub-processes", () => {
    expect(pack.subProcesses.map((s) => s.id)).toEqual([
      "R1", "R2", "R3", "R4", "R5", "R6", "R7", "R8", "R9", "R10", "R11", "R12",
    ]);
  });

  it("meets the Phase 0 minimum stated in 07 §7.3", () => {
    const s = packStats(pack);
    expect(s.coverageItems).toBeGreaterThanOrEqual(45);
    expect(s.mandatoryItems).toBeGreaterThanOrEqual(9);
    expect(s.risks).toBeGreaterThanOrEqual(30);
    expect(s.controls).toBeGreaterThanOrEqual(32);
    expect(s.triggers).toBeGreaterThanOrEqual(20);
  });

  it("makes the ISA 240 items mandatory", () => {
    const mandatory = mandatoryItemIds(pack);
    // fraud presumption, override, journals, cut-off, credit notes, recognition
    for (const id of ["R1.3", "R4.1", "R5.3", "R6.1", "R6.5", "R7.1", "R9.1", "R11.1", "R11.2", "R11.3"]) {
      expect(mandatory).toContain(id);
    }
  });

  it("resolves every library reference", () => {
    for (const item of pack.items.values()) {
      for (const r of item.typicalRisks) expect(pack.risks.has(r)).toBe(true);
      for (const c of item.typicalControls) expect(pack.controls.has(c)).toBe(true);
    }
  });
});
