import { describe, expect, it } from "vitest";
import {
  type DocItem,
  type ItemKind,
  findDayBounds,
  findExerciseBlock,
  getBlockText,
  indexInDay,
  listExercisesInDay,
} from "./exercise-block";

/**
 * Build a synthetic item stream — paragraphs are size 2 + textLen (open + text
 * + close), HRs are size 1. Positions tile contiguously so they match what
 * collectDocItems produces from a real PM doc.
 */
function items(...rows: Array<[ItemKind, string]>): DocItem[] {
  const out: DocItem[] = [];
  let pos = 0;
  for (const [kind, text] of rows) {
    const size = kind === "hr" ? 1 : 2 + text.length;
    out.push({
      from: pos,
      to: pos + size,
      kind,
      text: kind === "hr" ? "" : text,
    });
    pos += size;
  }
  return out;
}

describe("findExerciseBlock", () => {
  it("walks back to the exercise and forward over its sets", () => {
    const xs = items(
      ["date", "27/05"],
      ["exercise", "Squat"],
      ["working-set", "100kg x 5"],
      ["working-set", "110kg x 3"],
      ["exercise", "Bench"],
      ["working-set", "80kg x 5"],
    );
    const fromInsideSet = xs[2]!.from + 1;
    const block = findExerciseBlock(xs, fromInsideSet);
    expect(block).toEqual({
      from: xs[1]!.from,
      to: xs[3]!.to,
      firstItemIndex: 1,
      lastItemIndex: 3,
    });
  });

  it("includes trailing comment + warmup paragraphs", () => {
    const xs = items(
      ["date", "27/05"],
      ["exercise", "Squat"],
      ["warmup-set", "E 60kg x 5"],
      ["working-set", "100kg x 5"],
      ["comment", "' felt heavy"],
      ["exercise", "Bench"],
    );
    const block = findExerciseBlock(xs, xs[1]!.from);
    expect(block?.lastItemIndex).toBe(4);
    expect(block?.to).toBe(xs[4]!.to);
  });

  it("returns null when the caret is on a date paragraph", () => {
    const xs = items(["date", "27/05"], ["exercise", "Squat"]);
    expect(findExerciseBlock(xs, xs[0]!.from)).toBeNull();
  });

  it("returns null when the caret is in a gap before any exercise in the day", () => {
    const xs = items(["date", "27/05"], [null, ""], ["exercise", "Squat"]);
    expect(findExerciseBlock(xs, xs[1]!.from)).toBeNull();
  });

  it("does not cross an hr boundary while searching backward", () => {
    const xs = items(
      ["exercise", "Earlier"],
      ["hr", ""],
      ["working-set", "100kg x 5"],
    );
    expect(findExerciseBlock(xs, xs[2]!.from)).toBeNull();
  });

  it("stops forward walk at the next exercise", () => {
    const xs = items(
      ["exercise", "Squat"],
      ["working-set", "100kg x 5"],
      ["exercise", "Bench"],
      ["working-set", "80kg x 5"],
    );
    const block = findExerciseBlock(xs, xs[0]!.from);
    expect(block?.lastItemIndex).toBe(1);
  });
});

describe("findDayBounds", () => {
  it("starts at the date, ends before the next date", () => {
    const xs = items(
      ["date", "27/05"],
      ["exercise", "Squat"],
      ["working-set", "100kg x 5"],
      ["date", "26/05"],
      ["exercise", "Bench"],
    );
    const bounds = findDayBounds(xs, xs[2]!.from);
    expect(bounds).toEqual({
      from: xs[0]!.from,
      to: xs[2]!.to,
      firstItemIndex: 0,
      lastItemIndex: 2,
    });
  });

  it("treats an hr as the end of a day", () => {
    const xs = items(
      ["date", "27/05"],
      ["exercise", "Squat"],
      ["hr", ""],
      ["date", "26/05"],
    );
    const bounds = findDayBounds(xs, xs[1]!.from);
    expect(bounds?.lastItemIndex).toBe(1);
  });

  it("returns null when above the first date", () => {
    const xs = items([null, ""], ["date", "27/05"]);
    expect(findDayBounds(xs, xs[0]!.from)).toBeNull();
  });
});

describe("listExercisesInDay", () => {
  it("returns one entry per exercise, in document order", () => {
    const xs = items(
      ["date", "27/05"],
      ["exercise", "Squat"],
      ["working-set", "100kg x 5"],
      ["exercise", "Bench"],
      ["working-set", "80kg x 5"],
      ["exercise", "Row"],
    );
    const day = findDayBounds(xs, xs[0]!.from)!;
    const list = listExercisesInDay(xs, day);
    expect(list.map((b) => b.firstItemIndex)).toEqual([1, 3, 5]);
    expect(list.map((b) => b.lastItemIndex)).toEqual([2, 4, 5]);
  });

  it("returns empty when the day has no exercises", () => {
    const xs = items(["date", "27/05"], ["comment", "' rest day"]);
    const day = findDayBounds(xs, xs[0]!.from)!;
    expect(listExercisesInDay(xs, day)).toEqual([]);
  });
});

describe("getBlockText", () => {
  it("joins paragraphs with single newlines", () => {
    const xs = items(
      ["exercise", "Squat"],
      ["working-set", "100kg x 5"],
      ["working-set", "110kg x 3"],
    );
    const block = findExerciseBlock(xs, xs[0]!.from)!;
    expect(getBlockText(xs, block)).toBe("Squat\n100kg x 5\n110kg x 3");
  });
});

describe("indexInDay", () => {
  it("locates the block by its from/to coords", () => {
    const xs = items(
      ["date", "27/05"],
      ["exercise", "Squat"],
      ["exercise", "Bench"],
      ["exercise", "Row"],
    );
    const day = findDayBounds(xs, xs[0]!.from)!;
    const list = listExercisesInDay(xs, day);
    expect(indexInDay(list, list[2]!)).toBe(2);
  });
});
