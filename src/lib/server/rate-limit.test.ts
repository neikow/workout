import { afterEach, describe, expect, it } from "vitest";
import { _resetRateLimits, _getBucketCount, rateLimit } from "./rate-limit";

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

  it("sweeps expired buckets when Map exceeds 10k entries", () => {
    const t0 = 1_000_000;
    const windowMs = 1000;

    // Create 10,001 expired buckets
    for (let i = 0; i < 10_001; i++) {
      rateLimit(`key_${i}`, 1, windowMs, t0);
    }
    expect(_getBucketCount()).toBe(10_001);

    // All buckets have expired by t0 + windowMs + 1
    const afterExpiry = t0 + windowMs + 1;

    // Calling rateLimit with a new key after expiry should trigger sweep
    rateLimit("new_key", 1, windowMs, afterExpiry);

    // After sweep, Map should only contain the new_key bucket
    expect(_getBucketCount()).toBe(1);
  });
});
