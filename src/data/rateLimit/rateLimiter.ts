/**
 * Token-bucket rate limiter, one bucket per provider. Prevents bursting past
 * free-tier API limits (e.g. Football-Data.org: 10 req/min).
 */
export class TokenBucket {
  private tokens: number;
  private lastRefill: number;

  constructor(
    private readonly capacity: number,
    private readonly refillPerSec: number,
  ) {
    this.tokens = capacity;
    this.lastRefill = Date.now();
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.refillPerSec);
    this.lastRefill = now;
  }

  /** Resolve once a token is available (waiting if necessary). */
  async acquire(): Promise<void> {
    this.refill();
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return;
    }
    const deficit = 1 - this.tokens;
    const waitMs = (deficit / this.refillPerSec) * 1000;
    await new Promise((resolve) => setTimeout(resolve, Math.ceil(waitMs)));
    return this.acquire();
  }
}

const buckets = new Map<string, TokenBucket>();

/** Get (or lazily create) the bucket for a provider. */
export function bucketFor(providerId: string, capacity = 10, refillPerSec = 10 / 60): TokenBucket {
  let bucket = buckets.get(providerId);
  if (!bucket) {
    bucket = new TokenBucket(capacity, refillPerSec);
    buckets.set(providerId, bucket);
  }
  return bucket;
}

/** Fetch with exponential backoff on 429/5xx. */
export async function fetchWithBackoff(
  url: string,
  init: RequestInit,
  { retries = 3, baseDelayMs = 800 }: { retries?: number; baseDelayMs?: number } = {},
): Promise<Response> {
  let attempt = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const res = await fetch(url, init);
    if (res.status !== 429 && res.status < 500) return res;
    if (attempt >= retries) return res;
    const delay = baseDelayMs * 2 ** attempt;
    await new Promise((resolve) => setTimeout(resolve, delay));
    attempt += 1;
  }
}
