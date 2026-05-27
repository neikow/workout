import { describe, expect, it } from "vitest";
import { parseSetLine } from "./set-parser";

describe("parseSetLine", () => {
  it("parses weight x reps", () => {
    const r = parseSetLine("66kg x 8");
    expect(r.ok).toBe(true);
    expect(r.movements).toEqual([
      { weight: { value: 66, unit: "kg", assisted: false }, reps: [8] },
    ]);
    expect(r.totalReps).toBe(8);
    expect(r.totalSets).toBe(1);
    expect(r.volume).toBe(528);
  });

  it("expands weight x reps x sets", () => {
    const r = parseSetLine("66kg x 8 x 3");
    expect(r.ok).toBe(true);
    expect(r.movements[0].reps).toEqual([8, 8, 8]);
    expect(r.totalReps).toBe(24);
    expect(r.totalSets).toBe(3);
  });

  it("handles decimals", () => {
    const r = parseSetLine("34.3kg x 10 x 2");
    expect(r.movements[0].weight?.value).toBe(34.3);
    expect(r.movements[0].reps).toEqual([10, 10]);
  });

  it("marks negative weight as assisted", () => {
    const r = parseSetLine("-9kg x 10 x 3");
    expect(r.movements[0].weight).toEqual({
      value: -9,
      unit: "kg",
      assisted: true,
    });
  });

  it("parses a flat rep list", () => {
    const r = parseSetLine("0kg x (8 + 10 + 12)");
    expect(r.ok).toBe(true);
    expect(r.movements[0].reps).toEqual([8, 10, 12]);
    expect(r.totalSets).toBe(3);
    expect(r.totalReps).toBe(30);
  });

  it("parses reps x sets inside a list", () => {
    const r = parseSetLine("52kg x (10 x 2 + 9 x 1)");
    expect(r.movements[0].reps).toEqual([10, 10, 9]);
  });

  it("parses nested groups", () => {
    const r = parseSetLine("14kg x ((8 x 2) + (4 x 2) + (5 x 2))");
    expect(r.movements[0].reps).toEqual([8, 8, 4, 4, 5, 5]);
    expect(r.totalReps).toBe(34);
  });

  it("repeats a parenthesized group", () => {
    const r = parseSetLine("12kg x (5 x 2) x 2");
    expect(r.movements[0].reps).toEqual([5, 5, 5, 5]);
  });

  it("parses multiple weights (drop set) split by top-level +", () => {
    const r = parseSetLine("73kg x 1 + 66kg x 5");
    expect(r.ok).toBe(true);
    expect(r.movements).toHaveLength(2);
    expect(r.movements[0]).toEqual({
      weight: { value: 73, unit: "kg", assisted: false },
      reps: [1],
    });
    expect(r.movements[1].reps).toEqual([5]);
    expect(r.totalReps).toBe(6);
    expect(r.totalSets).toBe(2);
  });

  it("expands a triple multiplier", () => {
    const r = parseSetLine("39kg x 20 x 1 x 2");
    expect(r.movements[0].reps).toEqual([20, 20]);
  });

  it("strips a trailing note", () => {
    const r = parseSetLine("100kg x 20 x 3 (fin de séance)");
    expect(r.ok).toBe(true);
    expect(r.note).toBe("fin de séance");
    expect(r.movements[0].reps).toEqual([20, 20, 20]);
  });

  it("flags lines with ???", () => {
    const r = parseSetLine("30kg x 10 ???");
    expect(r.ok).toBe(true);
    expect(r.flagged).toBe(true);
    expect(r.movements[0].reps).toEqual([10]);
  });

  it("parses lbs unit", () => {
    const r = parseSetLine("135lbs x 5");
    expect(r.movements[0].weight?.unit).toBe("lbs");
  });

  it("reports an error for unparseable input", () => {
    const r = parseSetLine("5 x 2 levés de genoux");
    expect(r.ok).toBe(false);
    expect(r.error).toBeDefined();
  });
});
