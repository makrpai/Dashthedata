const buckets = new Map<string, number[]>();

/** Sliding window in memory. Used when Upstash is not configured. */
export function hitMemoryLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const prev = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (prev.length >= limit) {
    buckets.set(key, prev);
    return false;
  }
  prev.push(now);
  buckets.set(key, prev);
  return true;
}

export async function allowAiRequest(key: string): Promise<boolean> {
  const limit = Number(process.env.AI_RATE_LIMIT_PER_HOUR ?? 20);
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) {
    try {
      const { Ratelimit } = await import('@upstash/ratelimit');
      const { Redis } = await import('@upstash/redis');
      const ratelimit = new Ratelimit({ redis: new Redis({ url, token }), limiter: Ratelimit.slidingWindow(limit, '1 h') });
      const result = await ratelimit.limit(key);
      return result.success;
    } catch {
      /* fall through to memory */
    }
  }
  return hitMemoryLimit(key, limit, 60 * 60 * 1000);
}
