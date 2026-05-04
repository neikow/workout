import { describe, expect, it, vi } from "vitest";
import { docExerciseProvider } from "./providers";
import { buildDoc } from "./test-utils";
import type { SuggestionContext } from "./types";
import type { WorkoutContext } from "../types";

const workout: WorkoutContext = {
  warmupMarker: "E",
  dateFormat: "DD/MM[/YYYY]",
  theme: "system",
};

function makeCtx(overrides: Partial<SuggestionContext>): SuggestionContext {
  const fallback = buildDoc([]);
  return {
    doc: fallback.doc,
    linePos: 0,
    lineKind: "exercise",
    lineText: "",
    workout,
    getKind: fallback.getKind,
    ...overrides,
  };
}

function ctxFor(
  built: ReturnType<typeof buildDoc>,
  overrides: Partial<SuggestionContext> = {},
): SuggestionContext {
  return makeCtx({ doc: built.doc, getKind: built.getKind, ...overrides });
}

describe("docExerciseProvider.getSuggestions", () => {
  it("returns [] when lineKind is not exercise", () => {
    const built = buildDoc([
      { kind: "exercise", text: "Squat" },
      { kind: "working-set", text: "100kg x 5" },
    ]);
    expect(
      docExerciseProvider.getSuggestions(
        "squ",
        ctxFor(built, { lineKind: "working-set" }),
      ),
    ).toEqual([]);
  });

  it("returns [] for empty / whitespace query", () => {
    const built = buildDoc([
      { kind: "exercise", text: "Squat" },
      { kind: "working-set", text: "100kg x 5" },
    ]);
    expect(docExerciseProvider.getSuggestions("", ctxFor(built))).toEqual([]);
    expect(docExerciseProvider.getSuggestions("   ", ctxFor(built))).toEqual(
      [],
    );
  });

  it("substring-matches normalized exercise names", () => {
    const built = buildDoc([
      { kind: "exercise", text: "Front Squat" },
      { kind: "working-set", text: "100kg x 5" },
      { kind: "date", text: "03/05/2026" },
      { kind: "exercise", text: "Bench Press" },
      { kind: "working-set", text: "80kg x 5" },
    ]);
    const out = docExerciseProvider.getSuggestions("squ", ctxFor(built));
    expect(out.map((s) => s.label)).toEqual(["Front Squat"]);
  });

  it("ranks startsWith matches before substring matches", () => {
    const built = buildDoc([
      { kind: "exercise", text: "Front Squat" },
      { kind: "working-set", text: "100kg x 5" },
      { kind: "date", text: "03/05/2026" },
      { kind: "exercise", text: "Squat" },
      { kind: "working-set", text: "120kg x 3" },
    ]);
    const out = docExerciseProvider.getSuggestions("squ", ctxFor(built));
    expect(out.map((s) => s.label)).toEqual(["Squat", "Front Squat"]);
  });

  it("alphabetical tiebreak among same-rank matches", () => {
    const built = buildDoc([
      { kind: "exercise", text: "Squat Therapy" },
      { kind: "working-set", text: "60kg x 5" },
      { kind: "date", text: "03/05/2026" },
      { kind: "exercise", text: "Squat" },
      { kind: "working-set", text: "100kg x 5" },
    ]);
    const out = docExerciseProvider.getSuggestions("squ", ctxFor(built));
    expect(out.map((s) => s.label)).toEqual(["Squat", "Squat Therapy"]);
  });

  it("caps results at 8", () => {
    const paragraphs = [];
    for (let i = 0; i < 12; i++) {
      paragraphs.push({ kind: "exercise" as const, text: `Squat ${i}` });
      paragraphs.push({ kind: "working-set" as const, text: "100kg x 5" });
      paragraphs.push({ kind: "date" as const, text: "03/05/2026" });
    }
    const built = buildDoc(paragraphs);
    const out = docExerciseProvider.getSuggestions("squ", ctxFor(built));
    expect(out.length).toBe(8);
  });

  it("includes set-count detail and preview", () => {
    const built = buildDoc([
      { kind: "exercise", text: "Squat" },
      { kind: "working-set", text: "100kg x 5" },
      { kind: "working-set", text: "100kg x 5" },
    ]);
    const out = docExerciseProvider.getSuggestions("squ", ctxFor(built));
    expect(out[0].detail).toBe("2 sets");
    expect(out[0].preview).toEqual(["100kg x 5", "100kg x 5"]);
  });

  it("uses singular form when exactly 1 set", () => {
    const built = buildDoc([
      { kind: "exercise", text: "Squat" },
      { kind: "working-set", text: "100kg x 5" },
    ]);
    const out = docExerciseProvider.getSuggestions("squ", ctxFor(built));
    expect(out[0].detail).toBe("1 set");
  });

  it("omits detail when no sets", () => {
    const built = buildDoc([{ kind: "exercise", text: "Squat" }]);
    const out = docExerciseProvider.getSuggestions("squ", ctxFor(built));
    expect(out[0].detail).toBeUndefined();
  });

  it("apply() inserts paragraph chain via editor", () => {
    const built = buildDoc([
      { kind: "exercise", text: "Squat" },
      { kind: "working-set", text: "100kg x 5" },
    ]);
    const out = docExerciseProvider.getSuggestions("squ", ctxFor(built));

    const insertContentAt = vi.fn().mockReturnThis();
    const focus = vi.fn().mockReturnThis();
    const run = vi.fn();
    const editor = {
      chain: vi.fn(() => ({ focus, insertContentAt, run })),
    };

    out[0].apply(editor as never, { from: 5, to: 10 });

    expect(insertContentAt).toHaveBeenCalledWith({ from: 4, to: 11 }, [
      { type: "paragraph", content: [{ type: "text", text: "Squat" }] },
      {
        type: "paragraph",
        content: [{ type: "text", text: "100kg x 5" }],
      },
    ]);
    expect(run).toHaveBeenCalled();
  });

  it("excludes the in-progress exercise from results", () => {
    const built = buildDoc([
      { kind: "exercise", text: "Squat" },
      { kind: "working-set", text: "100kg x 5" },
    ]);
    const inProgressContentStart = 1;
    const out = docExerciseProvider.getSuggestions(
      "squ",
      ctxFor(built, { linePos: inProgressContentStart }),
    );
    expect(out).toEqual([]);
  });
});
