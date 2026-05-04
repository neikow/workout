import { describe, expect, it } from "vitest";
import { buildExerciseIndex, normalizeName } from "./doc-index";
import { buildDoc } from "./test-utils";

describe("normalizeName", () => {
  it("lowercases", () => {
    expect(normalizeName("Squat")).toBe("squat");
  });

  it("trims surrounding whitespace", () => {
    expect(normalizeName("  squat  ")).toBe("squat");
  });

  it("collapses internal whitespace", () => {
    expect(normalizeName("front  squat")).toBe("front squat");
    expect(normalizeName("Front\tSquat")).toBe("front squat");
  });

  it("idempotent", () => {
    const a = normalizeName("Front Squat");
    expect(normalizeName(a)).toBe(a);
  });
});

describe("buildExerciseIndex", () => {
  it("builds entries with following sets", () => {
    const { doc, getKind } = buildDoc([
      { kind: "exercise", text: "Squat" },
      { kind: "working-set", text: "100kg x 5" },
      { kind: "working-set", text: "100kg x 5" },
    ]);
    const idx = buildExerciseIndex(doc, getKind);
    const entry = idx.get("squat");
    expect(entry).toBeDefined();
    expect(entry?.displayName).toBe("Squat");
    expect(entry?.lastSets).toEqual(["100kg x 5", "100kg x 5"]);
  });

  it("includes warmup sets", () => {
    const built = buildDoc([
      { kind: "exercise", text: "Bench" },
      { kind: "warmup-set", text: "E 40kg x 5" },
      { kind: "working-set", text: "80kg x 5" },
    ]);
    expect(idxSets(built, "bench")).toEqual(["E 40kg x 5", "80kg x 5"]);
  });

  it("date breaks the current exercise context", () => {
    const built = buildDoc([
      { kind: "exercise", text: "Squat" },
      { kind: "date", text: "03/05/2026" },
      { kind: "working-set", text: "100kg x 5" },
    ]);
    expect(idxSets(built, "squat")).toEqual([]);
  });

  it("comment breaks the current exercise context", () => {
    const built = buildDoc([
      { kind: "exercise", text: "Squat" },
      { kind: "comment", text: "'felt heavy" },
      { kind: "working-set", text: "100kg x 5" },
    ]);
    expect(idxSets(built, "squat")).toEqual([]);
  });

  it("null kind breaks exercise context", () => {
    const built = buildDoc([
      { kind: "exercise", text: "Squat" },
      { kind: null, text: "stray" },
      { kind: "working-set", text: "100kg x 5" },
    ]);
    expect(idxSets(built, "squat")).toEqual([]);
  });

  it("first occurrence wins on duplicate exercise names", () => {
    const built = buildDoc([
      { kind: "exercise", text: "Squat" },
      { kind: "working-set", text: "100kg x 5" },
      { kind: "date", text: "03/05/2026" },
      { kind: "exercise", text: "Squat" },
      { kind: "working-set", text: "120kg x 3" },
    ]);
    expect(idxSets(built, "squat")).toEqual(["100kg x 5"]);
  });

  it("normalizes exercise key but preserves displayName", () => {
    const { doc, getKind } = buildDoc([
      { kind: "exercise", text: "  Front  Squat  " },
      { kind: "working-set", text: "100kg x 5" },
    ]);
    const entry = buildExerciseIndex(doc, getKind).get("front squat");
    expect(entry?.displayName).toBe("Front  Squat");
  });

  it("skips empty exercise names", () => {
    const { doc, getKind } = buildDoc([
      { kind: "exercise", text: "   " },
      { kind: "working-set", text: "100kg x 5" },
    ]);
    expect(buildExerciseIndex(doc, getKind).size).toBe(0);
  });

  it("excludes the exercise at given contentStart", () => {
    const { doc, getKind } = buildDoc([
      { kind: "exercise", text: "Squat" },
      { kind: "working-set", text: "100kg x 5" },
    ]);
    const fullIdx = buildExerciseIndex(doc, getKind);
    const start = fullIdx.get("squat")!.contentStart;

    const filtered = buildExerciseIndex(doc, getKind, start);
    expect(filtered.has("squat")).toBe(false);
  });

  it("indexes multiple exercises", () => {
    const { doc, getKind } = buildDoc([
      { kind: "exercise", text: "Squat" },
      { kind: "working-set", text: "100kg x 5" },
      { kind: "date", text: "03/05/2026" },
      { kind: "exercise", text: "Bench" },
      { kind: "working-set", text: "80kg x 5" },
    ]);
    const idx = buildExerciseIndex(doc, getKind);
    expect(idx.size).toBe(2);
    expect(idx.get("squat")?.lastSets).toEqual(["100kg x 5"]);
    expect(idx.get("bench")?.lastSets).toEqual(["80kg x 5"]);
  });
});

function idxSets(built: ReturnType<typeof buildDoc>, key: string): string[] {
  return buildExerciseIndex(built.doc, built.getKind).get(key)?.lastSets ?? [];
}
