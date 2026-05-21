import "server-only";

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

// Drop expired buckets opportunistically so the Map can't grow unbounded with
// one entry per distinct key (ip/email) forever — a slow memory-exhaustion DoS.
function sweep(now: number): void {
  for (const [key, b] of buckets) {
    if (b.resetAt <= now) buckets.delete(key);
  }
}

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now = Date.now(),
): { ok: boolean; retryAfterMs: number } {
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    if (buckets.size > 10_000) sweep(now);
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterMs: 0 };
  }
  if (b.count >= limit) {
    return { ok: false, retryAfterMs: b.resetAt - now };
  }
  b.count += 1;
  return { ok: true, retryAfterMs: 0 };
}

export function _resetRateLimits() {
  buckets.clear();
}
