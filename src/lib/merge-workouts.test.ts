import { describe, expect, it } from "vitest";
import { mergeWorkoutText } from "./merge-workouts";
import { compileDateFormat } from "@/components/editor/date-format";

const re = compileDateFormat("DD/MM[/YYYY]");
const isDate = (line: string) => re.test(line.trim());

describe("mergeWorkoutText", () => {
  it("unions distinct days newest-first", () => {
    const local = "27/05\nBench\n40kg x 8";
    const cloud = "26/05\nSquat\n60kg x 5";
    expect(mergeWorkoutText(local, cloud, isDate)).toBe(
      "27/05\nBench\n40kg x 8\n\n26/05\nSquat\n60kg x 5",
    );
  });

  it("dedupes a shared date, keeping the local version", () => {
    const local = "27/05\nBench\n40kg x 8";
    const cloud = "27/05\nBench\n35kg x 8\n\n26/05\nSquat";
    const out = mergeWorkoutText(local, cloud, isDate);
    expect(out).toContain("40kg x 8");
    expect(out).not.toContain("35kg x 8");
    expect(out).toContain("26/05");
  });

  it("orders mixed days descending", () => {
    const local = "01/05\nA";
    const cloud = "15/05\nB\n\n10/05\nC";
    const out = mergeWorkoutText(local, cloud, isDate);
    expect(out.indexOf("15/05")).toBeLessThan(out.indexOf("10/05"));
    expect(out.indexOf("10/05")).toBeLessThan(out.indexOf("01/05"));
  });

  it("handles an empty side", () => {
    expect(mergeWorkoutText("", "27/05\nBench", isDate)).toBe("27/05\nBench");
    expect(mergeWorkoutText("27/05\nBench", "", isDate)).toBe("27/05\nBench");
  });
});
