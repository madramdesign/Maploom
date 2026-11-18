import { AppError } from '@maploom/core';

/** In-memory token bucket per key. Good for one node; swap for Redis when scaling out. */
interface Bucket {
  tokens: number;
  at: number;
}
const buckets = new Map<string, Bucket>();

export function rateLimit(key: string, opts: { capacity: number; refillPerSec: number }): void {
  const now = Date.now();
  const b = buckets.get(key) ?? { tokens: opts.capacity, at: now };
  b.tokens = Math.min(opts.capacity, b.tokens + ((now - b.at) / 1000) * opts.refillPerSec);
  b.at = now;
  if (b.tokens < 1) {
    buckets.set(key, b);
    throw new AppError('RATE_LIMITED');
  }
  b.tokens -= 1;
  buckets.set(key, b);
  if (buckets.size > 20_000) for (const [k, v] of buckets) if (now - v.at > 600_000) buckets.delete(k);
}

export const LIMITS = {
  suggest: { capacity: 30, refillPerSec: 2 },
  search: { capacity: 10, refillPerSec: 0.5 },
  geography: { capacity: 8, refillPerSec: 0.1 },
  export: { capacity: 6, refillPerSec: 0.05 },
  save: { capacity: 20, refillPerSec: 0.2 },
  checkout: { capacity: 5, refillPerSec: 0.05 },
  admin: { capacity: 10, refillPerSec: 0.2 },
} as const;

export function resetRateLimits() {
  buckets.clear();
}
