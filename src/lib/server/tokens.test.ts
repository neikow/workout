import { describe, expect, it } from "vitest";
import {
  constantTimeEqual,
  generateOpaqueToken,
  generateOtpCode,
  hashToken,
} from "./tokens";

describe("tokens", () => {
  it("generateOtpCode returns 6 numeric digits with leading zeros preserved", () => {
    for (let i = 0; i < 200; i++) {
      const code = generateOtpCode();
      expect(code).toMatch(/^\d{6}$/);
    }
  });

  it("hashToken is deterministic and 64-char hex", () => {
    const a = hashToken("hello");
    const b = hashToken("hello");
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken("HELLO")).not.toBe(a);
  });

  it("generateOpaqueToken is unique per call and base64url-safe", () => {
    const t1 = generateOpaqueToken();
    const t2 = generateOpaqueToken();
    expect(t1).not.toBe(t2);
    expect(t1).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(t1.length).toBeGreaterThanOrEqual(32);
  });

  it("constantTimeEqual returns true for equal, false for differing or differently-sized", () => {
    expect(constantTimeEqual("abc", "abc")).toBe(true);
    expect(constantTimeEqual("abc", "abd")).toBe(false);
    expect(constantTimeEqual("abc", "abcd")).toBe(false);
    expect(constantTimeEqual("", "")).toBe(true);
  });
});
