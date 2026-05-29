import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "@/lib/settings";
import { segmentDays } from "./segment";

const ctx = DEFAULT_SETTINGS;

describe("segmentDays", () => {
  it("splits the feed into one segment per dated day", () => {
    const text = [
      "27/05",
      "Bench",
      "100kg x 5",
      "20/05",
      "Squat",
      "120kg x 3",
    ].join("\n");
    const segs = segmentDays(text, ctx);
    expect(segs.map((s) => s.date)).toEqual(["27/05", "20/05"]);
    expect(segs[0].text).toBe("27/05\nBench\n100kg x 5");
  });

  it("treats --- as a hard day separator", () => {
    const text = ["27/05", "Bench", "100kg x 5", "---", "20/05", "Squat"].join(
      "\n",
    );
    const segs = segmentDays(text, ctx);
    expect(segs).toHaveLength(2);
    expect(segs[1].text).toBe("20/05\nSquat");
  });

  it("drops content before the first date and orphaned lines", () => {
    const text = ["stray note", "27/05", "Bench", "---", "orphan"].join("\n");
    const segs = segmentDays(text, ctx);
    expect(segs).toHaveLength(1);
    expect(segs[0].date).toBe("27/05");
  });

  it("gives identical text identical hashes, and changed text a new hash", () => {
    const a = segmentDays("27/05\nBench\n100kg x 5", ctx)[0];
    const b = segmentDays("27/05\nBench\n100kg x 5", ctx)[0];
    const c = segmentDays("27/05\nBench\n101kg x 5", ctx)[0];
    expect(a.hash).toBe(b.hash);
    expect(a.hash).not.toBe(c.hash);
  });
});
