import { describe, expect, it } from "vitest";
import {
  classifyLine,
  commentRule,
  dateRule,
  defaultRules,
  exerciseNameRule,
  sortRules,
  warmupSetRule,
  workingSetRule,
} from "./default-rules";
import type { WorkoutContext } from "./types";

const ctx: WorkoutContext = {
  warmupMarker: "E",
  dateFormat: "DD/MM[/YYYY]",
  theme: "system",
};

describe("dateRule", () => {
  it("matches dates per ctx.dateFormat", () => {
    expect(dateRule.match("03/05/2026", ctx)).toBe("date");
    expect(dateRule.match("3/5", ctx)).toBe("date");
  });

  it("trims surrounding whitespace before matching", () => {
    expect(dateRule.match("  03/05  ", ctx)).toBe("date");
  });

  it("rejects non-dates", () => {
    expect(dateRule.match("squat", ctx)).toBeNull();
    expect(dateRule.match("", ctx)).toBeNull();
  });

  it("respects custom date format", () => {
    const custom = { ...ctx, dateFormat: "YYYY-MM-DD" };
    expect(dateRule.match("2026-05-03", custom)).toBe("date");
    expect(dateRule.match("03/05/2026", custom)).toBeNull();
  });
});

describe("commentRule", () => {
  it("matches lines starting with apostrophe", () => {
    expect(commentRule.match("'felt heavy", ctx)).toBe("comment");
    expect(commentRule.match("   'indented", ctx)).toBe("comment");
  });

  it("rejects lines without leading apostrophe", () => {
    expect(commentRule.match("squat", ctx)).toBeNull();
    expect(commentRule.match("not 'a comment", ctx)).toBeNull();
  });
});

describe("workingSetRule", () => {
  it("matches weight x reps", () => {
    expect(workingSetRule.match("100kg x 5", ctx)).toBe("working-set");
    expect(workingSetRule.match("100 x 5", ctx)).toBe("working-set");
    expect(workingSetRule.match("100lbs x 5", ctx)).toBe("working-set");
    expect(workingSetRule.match("100lb x 5", ctx)).toBe("working-set");
    expect(workingSetRule.match("500g x 12", ctx)).toBe("working-set");
  });

  it("matches decimal weights", () => {
    expect(workingSetRule.match("82.5kg x 5", ctx)).toBe("working-set");
  });

  it("matches negative-prefix sets", () => {
    expect(workingSetRule.match("-10kg x 5", ctx)).toBe("working-set");
  });

  it("matches reps in parens", () => {
    expect(workingSetRule.match("100kg x (AMRAP)", ctx)).toBe("working-set");
  });

  it("is case-insensitive on units and x", () => {
    expect(workingSetRule.match("100KG X 5", ctx)).toBe("working-set");
  });

  it("rejects exercise names", () => {
    expect(workingSetRule.match("squat", ctx)).toBeNull();
    expect(workingSetRule.match("bench press", ctx)).toBeNull();
  });
});

describe("warmupSetRule", () => {
  it("matches marker + working-set body", () => {
    expect(warmupSetRule.match("E 60kg x 5", ctx)).toBe("warmup-set");
    expect(warmupSetRule.match("E 60 x 5", ctx)).toBe("warmup-set");
  });

  it("requires the marker", () => {
    expect(warmupSetRule.match("60kg x 5", ctx)).toBeNull();
  });

  it("requires a working-set body after marker", () => {
    expect(warmupSetRule.match("E just stretching", ctx)).toBeNull();
  });

  it("respects custom warmup marker", () => {
    const custom = { ...ctx, warmupMarker: "W" };
    expect(warmupSetRule.match("W 60kg x 5", custom)).toBe("warmup-set");
    expect(warmupSetRule.match("E 60kg x 5", custom)).toBeNull();
  });

  it("escapes regex chars in custom marker", () => {
    const custom = { ...ctx, warmupMarker: "*" };
    expect(warmupSetRule.match("* 60kg x 5", custom)).toBe("warmup-set");
  });
});

describe("exerciseNameRule", () => {
  it("matches any non-empty text", () => {
    expect(exerciseNameRule.match("squat", ctx)).toBe("exercise");
    expect(exerciseNameRule.match("bench press", ctx)).toBe("exercise");
  });

  it("rejects empty / whitespace-only", () => {
    expect(exerciseNameRule.match("", ctx)).toBeNull();
    expect(exerciseNameRule.match("   ", ctx)).toBeNull();
  });
});

describe("sortRules", () => {
  it("sorts by priority descending", () => {
    const sorted = sortRules(defaultRules);
    const priorities = sorted.map((r) => r.priority);
    expect(priorities).toEqual([...priorities].sort((a, b) => b - a));
  });

  it("does not mutate the input", () => {
    const input = [...defaultRules];
    const before = input.map((r) => r.name);
    sortRules(input);
    expect(input.map((r) => r.name)).toEqual(before);
  });
});

describe("classifyLine (full pipeline)", () => {
  const sorted = sortRules(defaultRules);

  it("classifies date over exercise (priority)", () => {
    expect(classifyLine("03/05/2026", sorted, ctx)).toBe("date");
  });

  it("classifies comment over exercise", () => {
    expect(classifyLine("'felt heavy", sorted, ctx)).toBe("comment");
  });

  it("classifies warmup-set over working-set", () => {
    expect(classifyLine("E 60kg x 5", sorted, ctx)).toBe("warmup-set");
  });

  it("classifies working-set", () => {
    expect(classifyLine("100kg x 5", sorted, ctx)).toBe("working-set");
  });

  it("falls through to exercise", () => {
    expect(classifyLine("front squat", sorted, ctx)).toBe("exercise");
  });

  it("returns null on empty line", () => {
    expect(classifyLine("", sorted, ctx)).toBeNull();
    expect(classifyLine("   ", sorted, ctx)).toBeNull();
  });

  it("returns null when no rules match", () => {
    expect(classifyLine("anything", [], ctx)).toBeNull();
  });
});
