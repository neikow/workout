import { describe, expect, it } from "vitest";
import { compileDateFormat } from "./date-format";

describe("compileDateFormat", () => {
  describe("default DD/MM[/YYYY] format", () => {
    const re = compileDateFormat("DD/MM[/YYYY]");

    it("matches DD/MM with one or two digits", () => {
      expect(re.test("3/5")).toBe(true);
      expect(re.test("03/05")).toBe(true);
      expect(re.test("31/12")).toBe(true);
    });

    it("matches DD/MM/YYYY", () => {
      expect(re.test("3/5/2026")).toBe(true);
      expect(re.test("31/12/1999")).toBe(true);
    });

    it("rejects partial optional segment", () => {
      expect(re.test("3/5/")).toBe(false);
      expect(re.test("3/5/26")).toBe(false);
    });

    it("rejects junk", () => {
      expect(re.test("not a date")).toBe(false);
      expect(re.test("")).toBe(false);
      expect(re.test("3-5")).toBe(false);
    });

    it("anchors start and end (no partial matches)", () => {
      expect(re.test(" 3/5")).toBe(false);
      expect(re.test("3/5 hello")).toBe(false);
    });
  });

  describe("YY support", () => {
    const re = compileDateFormat("DD/MM/YY");
    it("matches exactly 2-digit year", () => {
      expect(re.test("3/5/26")).toBe(true);
      expect(re.test("3/5/2026")).toBe(false);
    });
  });

  describe("alternative separators", () => {
    it("supports dashes", () => {
      const re = compileDateFormat("YYYY-MM-DD");
      expect(re.test("2026-05-03")).toBe(true);
      expect(re.test("2026/05/03")).toBe(false);
    });

    it("supports dots", () => {
      const re = compileDateFormat("DD.MM.YYYY");
      expect(re.test("03.05.2026")).toBe(true);
    });
  });

  describe("optional segments", () => {
    it("handles optional middle segment", () => {
      const re = compileDateFormat("DD[/MM]/YYYY");
      expect(re.test("3/2026")).toBe(true);
      expect(re.test("3/5/2026")).toBe(true);
    });

    it("handles two optional segments", () => {
      const re = compileDateFormat("DD[/MM][/YYYY]");
      expect(re.test("3")).toBe(true);
      expect(re.test("3/5")).toBe(true);
      expect(re.test("3/5/2026")).toBe(true);
    });
  });

  describe("regex literal escaping", () => {
    it("escapes regex special characters in literals", () => {
      const re = compileDateFormat("DD.MM.YYYY");
      expect(re.test("03x05x2026")).toBe(false);
    });
  });
});
