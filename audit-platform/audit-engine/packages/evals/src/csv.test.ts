import { describe, it, expect } from "vitest";
import { parseCsv, toCsv } from "./csv.ts";

describe("csv", () => {
  it("round-trips quoted fields, commas and quotes", () => {
    const csv = toCsv(
      ["caseId", "note"],
      [["r-01", 'says "sales can override", no approval'], ["r-02", "plain"]],
    );
    const rows = parseCsv(csv);
    expect(rows).toHaveLength(2);
    expect(rows[0]!["note"]).toBe('says "sales can override", no approval');
    expect(rows[1]!["caseId"]).toBe("r-02");
  });

  it("ignores blank lines and trims headers", () => {
    expect(parseCsv("a, b\n1,2\n\n3,4\n")).toEqual([{ a: "1", b: "2" }, { a: "3", b: "4" }]);
  });
});
