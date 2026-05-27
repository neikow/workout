import { describe, expect, it } from "vitest";
import { canonicalFor, normalizeName, type SynonymGroup } from "./synonyms";

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
