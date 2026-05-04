import { afterEach, describe, expect, it } from "vitest";
import { _resetRateLimits, rateLimit } from "./rate-limit";

describe("rateLimit", () => {
  afterEach(() => {
    _resetRateLimits();
  });

  it("allows up to limit then blocks within the window", () => {
    const t0 = 1_000_000;
    expect(rateLimit("k", 3, 1000, t0).ok).toBe(true);
    expect(rateLimit("k", 3, 1000, t0 + 100).ok).toBe(true);
    expect(rateLimit("k", 3, 1000, t0 + 200).ok).toBe(true);
    const blocked = rateLimit("k", 3, 1000, t0 + 300);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
  });

  it("resets after window expires", () => {
    const t0 = 1_000_000;
    rateLimit("k", 1, 1000, t0);
    expect(rateLimit("k", 1, 1000, t0 + 500).ok).toBe(false);
    expect(rateLimit("k", 1, 1000, t0 + 1500).ok).toBe(true);
  });

  it("uses independent buckets per key", () => {
    const t0 = 1_000_000;
    rateLimit("a", 1, 1000, t0);
    expect(rateLimit("a", 1, 1000, t0).ok).toBe(false);
    expect(rateLimit("b", 1, 1000, t0).ok).toBe(true);
  });
});
