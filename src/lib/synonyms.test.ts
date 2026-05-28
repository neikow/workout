import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import {
  addSynonymGroup,
  addVariantToGroup,
  canonicalFor,
  findGroupFor,
  getSynonyms,
  normalizeName,
  type SynonymGroup,
} from "./synonyms";

const groups: SynonymGroup[] = [
  {
    id: "1",
    canonical: "Bench Press",
    variants: ["Bench", "Développé couché", "DB Bench"],
  },
];

describe("canonicalFor", () => {
  it("maps a variant to its canonical name", () => {
    expect(canonicalFor("Bench", groups)).toBe("Bench Press");
    expect(canonicalFor("développé couché", groups)).toBe("Bench Press");
  });

  it("is case and whitespace insensitive", () => {
    expect(canonicalFor("  db   bench  ", groups)).toBe("Bench Press");
  });

  it("returns null for the canonical name itself", () => {
    expect(canonicalFor("Bench Press", groups)).toBeNull();
    expect(canonicalFor("bench press", groups)).toBeNull();
  });

  it("returns null for unknown names", () => {
    expect(canonicalFor("Squat", groups)).toBeNull();
    expect(canonicalFor("", groups)).toBeNull();
  });
});

describe("normalizeName", () => {
  it("lowercases and collapses whitespace", () => {
    expect(normalizeName("  Pec   Fly ")).toBe("pec fly");
  });
});

describe("findGroupFor", () => {
  it("matches the canonical name", () => {
    expect(findGroupFor("Bench Press", groups)?.id).toBe("1");
  });
  it("matches a variant", () => {
    expect(findGroupFor("Bench", groups)?.id).toBe("1");
  });
  it("returns null when unknown", () => {
    expect(findGroupFor("Squat", groups)).toBeNull();
    expect(findGroupFor("   ", groups)).toBeNull();
  });
});

describe("addVariantToGroup", () => {
  function setup() {
    const ydoc = new Y.Doc();
    addSynonymGroup(ydoc, "Squat");
    const id = getSynonyms(ydoc).get(0).id;
    return { ydoc, id };
  }

  it("appends a fresh variant", () => {
    const { ydoc, id } = setup();
    const next = addVariantToGroup(ydoc, id, "Back Squat");
    expect(next).toEqual(["Back Squat"]);
    expect(getSynonyms(ydoc).get(0).variants).toEqual(["Back Squat"]);
  });

  it("is idempotent for duplicates (case + whitespace insensitive)", () => {
    const { ydoc, id } = setup();
    addVariantToGroup(ydoc, id, "Back Squat");
    const next = addVariantToGroup(ydoc, id, "  back   squat  ");
    expect(next).toEqual(["Back Squat"]);
  });

  it("ignores the canonical name itself", () => {
    const { ydoc, id } = setup();
    const next = addVariantToGroup(ydoc, id, "squat");
    expect(next).toEqual([]);
  });

  it("returns null for empty input or unknown group id", () => {
    const { ydoc, id } = setup();
    expect(addVariantToGroup(ydoc, id, "   ")).toBeNull();
    expect(addVariantToGroup(ydoc, "nope", "x")).toBeNull();
  });
});
