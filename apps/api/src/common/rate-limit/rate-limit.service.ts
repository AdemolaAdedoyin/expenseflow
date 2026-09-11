import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

export type RateLimitDecision = {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
};

@Injectable()
export class RateLimitService {
  private readonly buckets = new Map<string, RateLimitBucket>();

  constructor(private readonly config: ConfigService) {}

  consume(key: string, limit: number, windowMs: number, now = Date.now()): RateLimitDecision {
    const existing = this.buckets.get(key);
    const bucket = !existing || existing.resetAt <= now
      ? { count: 0, resetAt: now + windowMs }
      : existing;

    bucket.count += 1;
    this.buckets.set(key, bucket);

    // Opportunistic cleanup keeps this process-local implementation bounded without
    // adding a timer that would keep test/app processes alive during shutdown.
    if (this.buckets.size > 5_000) {
      this.removeExpired(now);
    }

    return {
      allowed: bucket.count <= limit,
      limit,
      remaining: Math.max(0, limit - bucket.count),
      resetAt: bucket.resetAt,
    };
  }

  generalPolicy() {
    return {
      limit: this.positiveInteger('RATE_LIMIT_REQUESTS', 300),
      windowMs: this.positiveInteger('RATE_LIMIT_WINDOW_MS', 60_000),
    };
  }

  authPolicy() {
    return {
      limit: this.positiveInteger('AUTH_RATE_LIMIT_REQUESTS', 10),
      windowMs: this.positiveInteger('AUTH_RATE_LIMIT_WINDOW_MS', 10 * 60_000),
    };
  }

  private positiveInteger(name: string, fallback: number) {
    const configured = Number(this.config.get<string>(name));
    return Number.isInteger(configured) && configured > 0 ? configured : fallback;
  }

  private removeExpired(now: number) {
    for (const [key, bucket] of this.buckets.entries()) {
      if (bucket.resetAt <= now) {
        this.buckets.delete(key);
      }
    }
  }
}
