import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "@/lib/settings";
import type { SynonymGroup } from "@/lib/synonyms";
import { segmentDays } from "./segment";
import { aggregate, parseDateToTime, parseDay } from "./aggregate";
import type { ParsedDay } from "./types";

const ctx = DEFAULT_SETTINGS;

function build(text: string, synonyms: SynonymGroup[] = []) {
  const parsed: ParsedDay[] = segmentDays(text, ctx).map((s) =>
    parseDay(s, ctx),
  );
  return aggregate(parsed, synonyms);
}

const SAMPLE = [
  "27/05",
  "Bench press",
  "100kg x 8 x 3",
  "20/05",
  "Bench press",
  "E 60kg x 8",
  "95kg x 5",
  "13/05",
  "Développé couché",
  "90kg x 5",
].join("\n");

describe("parseDateToTime", () => {
  it("parses the configured format and orders chronologically", () => {
    const a = parseDateToTime("13/05/2024", "DD/MM[/YYYY]")!;
    const b = parseDateToTime("27/05/2024", "DD/MM[/YYYY]")!;
    expect(a).toBeLessThan(b);
  });

  it("returns null for non-dates", () => {
    expect(parseDateToTime("Bench press", "DD/MM[/YYYY]")).toBeNull();
  });
});

describe("aggregate", () => {
  it("groups variants under their canonical via synonyms", () => {
    const synonyms: SynonymGroup[] = [
      { id: "1", canonical: "Bench press", variants: ["Développé couché"] },
    ];
    const stats = build(SAMPLE, synonyms);
    expect(stats).toHaveLength(1);
    expect(stats[0].displayName).toBe("Bench press");
    expect(stats[0].sessionCount).toBe(3);
    expect(stats[0].lastDate).toBe("27/05");
  });

  it("keeps unlinked names separate", () => {
    const stats = build(SAMPLE);
    expect(stats.map((s) => s.key).sort()).toEqual(
      ["bench press", "développé couché"].sort(),
    );
  });

  it("excludes warmup sets from session volume but keeps them in the set list", () => {
    const stats = build(SAMPLE);
    const bench = stats.find((s) => s.key === "bench press")!;
    const may20 = bench.sessions.find((s) => s.date === "20/05")!;
    expect(may20.sets).toHaveLength(2); // warmup + working both listed
    expect(may20.sets.some((s) => s.warmup)).toBe(true);
    expect(may20.volume).toBe(95 * 5); // warmup 60x8 excluded
  });

  it("detects all-time PRs and stars the session that set them", () => {
    const synonyms: SynonymGroup[] = [
      { id: "1", canonical: "Bench press", variants: ["Développé couché"] },
    ];
    const bench = build(SAMPLE, synonyms)[0];
    expect(bench.prTopWeight).toEqual({ value: 100, date: "27/05" });
    expect(bench.prVolume).toEqual({ value: 2400, date: "27/05" });
    expect(bench.prEst1RM!.value).toBeCloseTo(100 * (1 + 8 / 30), 5);
    const top = bench.sessions.find((s) => s.date === "27/05")!;
    expect(top.prTopWeight).toBe(true);
  });

  it("is invariant to reordering exercises within a day", () => {
    const reordered = [
      "27/05",
      "Squat",
      "120kg x 5",
      "Bench press",
      "100kg x 8 x 3",
    ].join("\n");
    const original = [
      "27/05",
      "Bench press",
      "100kg x 8 x 3",
      "Squat",
      "120kg x 5",
    ].join("\n");
    const a = build(original);
    const b = build(reordered);
    const benchA = a.find((s) => s.key === "bench press")!;
    const benchB = b.find((s) => s.key === "bench press")!;
    expect(benchB.prTopWeight).toEqual(benchA.prTopWeight);
    expect(benchB.sessions[0].volume).toBe(benchA.sessions[0].volume);
  });
});
